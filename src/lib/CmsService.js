import GitPlumbing, { GitRepositoryService } from '@git-stunts/plumbing';
import { GitGraphAdapter } from '@git-stunts/git-warp';
import { createMessageHelpers } from '@git-stunts/trailer-codec';
import ContentAddressableStore from '@git-stunts/git-cas';
import VaultResolver from './VaultResolver.js';
import ShellRunner from '@git-stunts/plumbing/ShellRunner';
import {
  canonicalizeKind,
  canonicalizeSlug,
  resolveContentIdentity,
} from './ContentIdentityPolicy.js';

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
    this.repo = new GitRepositoryService({ plumbing: this.plumbing });
    
    this.graph = new GitGraphAdapter({ plumbing: this.plumbing });
    const helpers = createMessageHelpers({
      bodyFormatOptions: { keepTrailingNewline: true }
    });
    this.codec = { decode: helpers.decodeMessage, encode: helpers.encodeMessage };
    this.cas = new ContentAddressableStore({ plumbing: this.plumbing });
    this.vault = new VaultResolver();
  }

  /**
   * Helper to resolve a full ref path.
   * @private
   */
  _refFor(slug, kind = 'articles') {
    const canonicalSlug = canonicalizeSlug(slug);
    const canonicalKind = canonicalizeKind(kind);
    return `${this.refPrefix}/${canonicalKind}/${canonicalSlug}`;
  }

  /**
   * Lists all articles of a certain kind.
   */
  async listArticles({ kind = 'articles' } = {}) {
    const canonicalKind = canonicalizeKind(kind);
    const ns = `${this.refPrefix}/${canonicalKind}/`;
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
    const sha = await this.graph.readRef(ref);
    if (!sha) throw new Error(`Article not found: ${slug} (${kind})`);
    
    const message = await this.graph.showNode(sha);
    return { sha, ...this.codec.decode(message) };
  }

  /**
   * Saves a new version (snapshot) of an article.
   */
  async saveSnapshot({ slug, title, body, trailers = {} }) {
    const safeTrailers = trailers && typeof trailers === 'object' ? trailers : {};
    const identity = resolveContentIdentity({ slug, trailers: safeTrailers });
    const ref = this._refFor(identity.slug, 'articles');
    const parentSha = await this.graph.readRef(ref);
    
    const finalTrailers = {
      ...safeTrailers,
      contentid: identity.contentId,
      status: 'draft',
      updatedAt: new Date().toISOString(),
    };
    const message = this.codec.encode({ title, body, trailers: finalTrailers });
    
    const newSha = await this.graph.commitNode({
      message,
      parents: parentSha ? [parentSha] : [],
      sign: process.env.CMS_SIGN === '1'
    });

    await this.repo.updateRef({ ref, newSha, oldSha: parentSha });
    return { ref, sha: newSha, parent: parentSha };
  }

  /**
   * Publishes an article by fast-forwarding the 'published' ref.
   */
  async publishArticle({ slug, sha }) {
    const canonicalSlug = canonicalizeSlug(slug);
    const draftRef = this._refFor(canonicalSlug, 'articles');
    const pubRef = this._refFor(canonicalSlug, 'published');
    
    const targetSha = sha || await this.graph.readRef(draftRef);
    if (!targetSha) throw new Error(`Nothing to publish for ${canonicalSlug}`);

    const oldSha = await this.graph.readRef(pubRef);
    await this.repo.updateRef({ ref: pubRef, newSha: targetSha, oldSha });
    
    return { ref: pubRef, sha: targetSha, prev: oldSha };
  }

  /**
   * Uploads an asset and returns its manifest and CAS info.
   */
  async uploadAsset({ slug, filePath, filename }) {
    const canonicalSlug = canonicalizeSlug(slug);
    const ENV = (process.env.GIT_CMS_ENV || 'dev').toLowerCase();
    const encryptionKeyRaw = await this.vault.resolveSecret({
      envKey: 'CHUNK_ENC_KEY',
      vaultTarget: `git-cms-${ENV}-enc-key`
    });
    
    const encryptionKey = encryptionKeyRaw ? Buffer.from(encryptionKeyRaw, 'base64') : null;

    const manifest = await this.cas.storeFile({
      filePath,
      slug: canonicalSlug,
      filename,
      encryptionKey
    });

    const treeOid = await this.cas.createTree({ manifest });
    
    const ref = `refs/_blog/chunks/${canonicalSlug}@current`;
    const commitSha = await this.graph.commitNode({
      message: `asset:${filename}\n\nmanifest: ${treeOid}`,
    });

    await this.repo.updateRef({ ref, newSha: commitSha });
    
    return { manifest, treeOid, commitSha };
  }
}
