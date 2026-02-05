import GitPlumbing from '@git-stunts/plumbing';
import EmptyGraph from '@git-stunts/empty-graph';
import { createMessageHelpers } from '@git-stunts/trailer-codec';
import ContentAddressableStore from '@git-stunts/cas';
import Vault from '@git-stunts/vault';
import ShellRunner from '@git-stunts/plumbing/ShellRunner';

/**
 * @typedef {Object} CmsServiceOptions
 * @property {string} cwd - The working directory of the git repo.
 * @property {string} refPrefix - The namespace for git refs (e.g. refs/_blog/dev).
 */

/**
 * CmsService is the core domain orchestrator for Git CMS.
 */
export default class CmsService {
  /**
   * @param {CmsServiceOptions} options
   */
  constructor({ cwd, refPrefix }) {
    this.cwd = cwd;
    this.refPrefix = refPrefix.replace(/\/$/, '');
    
    // Initialize Lego Blocks with ShellRunner as the substrate
    this.plumbing = new GitPlumbing({
      runner: ShellRunner.run,
      cwd
    });
    
    this.graph = new EmptyGraph({ plumbing: this.plumbing });
    const helpers = createMessageHelpers();
    this.codec = { decode: helpers.decodeMessage, encode: helpers.encodeMessage };
    this.cas = new ContentAddressableStore({ plumbing: this.plumbing });
    this.vault = new Vault();
  }

  /**
   * Helper to resolve a full ref path.
   * @private
   */
  _refFor(slug, kind = 'articles') {
    return `${this.refPrefix}/${kind}/${slug}`;
  }

  /**
   * Lists all articles of a certain kind.
   */
  async listArticles({ kind = 'articles' } = {}) {
    const ns = `${this.refPrefix}/${kind}/`;
    let out = '';
    try {
      out = await this.plumbing.execute({ args: ['for-each-ref', ns, '--format=%(refname) %(objectname)'] });
    } catch {
      return [];
    }

    return out
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const [ref, sha] = line.split(' ');
        const slug = ref.replace(ns, '');
        return { ref, sha, slug };
      });
  }

  /**
   * Reads an article's data.
   */
  async readArticle({ slug, kind = 'articles' }) {
    const ref = this._refFor(slug, kind);
    const sha = await this.plumbing.revParse({ revision: ref });
    if (!sha) throw new Error(`Article not found: ${slug} (${kind})`);
    
    const message = await this.graph.readNode({ sha });
    return { sha, ...this.codec.decode({ message }) };
  }

  /**
   * Saves a new version (snapshot) of an article.
   */
  async saveSnapshot({ slug, title, body, trailers = {} }) {
    const ref = this._refFor(slug, 'articles');
    const parentSha = await this.plumbing.revParse({ revision: ref });
    
    const finalTrailers = { ...trailers, status: 'draft', updatedAt: new Date().toISOString() };
    const message = this.codec.encode({ title, body, trailers: finalTrailers });
    
    const newSha = await this.graph.createNode({
      message,
      parents: parentSha ? [parentSha] : [],
      sign: process.env.CMS_SIGN === '1'
    });

    await this.plumbing.updateRef({ ref, newSha, oldSha: parentSha });
    return { ref, sha: newSha, parent: parentSha };
  }

  /**
   * Publishes an article by fast-forwarding the 'published' ref.
   */
  async publishArticle({ slug, sha }) {
    const draftRef = this._refFor(slug, 'articles');
    const pubRef = this._refFor(slug, 'published');
    
    const targetSha = sha || await this.plumbing.revParse({ revision: draftRef });
    if (!targetSha) throw new Error(`Nothing to publish for ${slug}`);

    const oldSha = await this.plumbing.revParse({ revision: pubRef });
    await this.plumbing.updateRef({ ref: pubRef, newSha: targetSha, oldSha });
    
    return { ref: pubRef, sha: targetSha, prev: oldSha };
  }

  /**
   * Uploads an asset and returns its manifest and CAS info.
   */
  async uploadAsset({ slug, filePath, filename }) {
    const ENV = (process.env.GIT_CMS_ENV || 'dev').toLowerCase();
    const encryptionKeyRaw = this.vault.resolveSecret({
      envKey: 'CHUNK_ENC_KEY',
      vaultTarget: `git-cms-${ENV}-enc-key`
    });
    
    const encryptionKey = encryptionKeyRaw ? Buffer.from(encryptionKeyRaw, 'base64') : null;

    const manifest = await this.cas.storeFile({
      filePath,
      slug,
      filename,
      encryptionKey
    });

    const treeOid = await this.cas.createTree({ manifest });
    
    const ref = `refs/_blog/chunks/${slug}@current`;
    const commitSha = await this.graph.createNode({
      message: `asset:${filename}\n\nmanifest: ${treeOid}`,
    });

    await this.plumbing.updateRef({ ref, newSha: commitSha });
    
    return { manifest, treeOid, commitSha };
  }
}