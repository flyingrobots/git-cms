import GitPlumbing, { GitRepositoryService } from '@git-stunts/plumbing';
import { GitGraphAdapter } from '@git-stunts/git-warp';
import { createMessageHelpers } from '@git-stunts/trailer-codec';
import ContentAddressableStore from '@git-stunts/git-cas';
import VaultResolver from './VaultResolver.js';
import ShellRunner from '@git-stunts/plumbing/ShellRunner';
import {
  CmsValidationError,
  canonicalizeKind,
  canonicalizeSlug,
  resolveContentIdentity,
} from './ContentIdentityPolicy.js';
import {
  STATES,
  resolveEffectiveState,
  validateTransition,
} from './ContentStatePolicy.js';

/**
 * @typedef {Object} CmsServiceOptions
 * @property {string} [cwd] - The working directory of the git repo.
 * @property {string} refPrefix - The namespace for git refs (e.g. refs/_blog/dev).
 * @property {import('@git-stunts/git-warp').GraphPersistencePort} [graph] - Optional injected graph adapter (skips git subprocess setup).
 */

/**
 * CmsService is the core domain orchestrator for Git CMS.
 */
export default class CmsService {
  /**
   * @param {CmsServiceOptions} options
   */
  constructor({ cwd, refPrefix, graph }) {
    this.refPrefix = refPrefix.replace(/\/$/, '');

    const helpers = createMessageHelpers({
      bodyFormatOptions: { keepTrailingNewline: true }
    });
    this.codec = { decode: helpers.decodeMessage, encode: helpers.encodeMessage };

    if (graph) {
      // DI mode — caller provides a GraphPersistencePort (e.g. InMemoryGraphAdapter)
      this.graph = graph;
      this.plumbing = null;
      this.repo = null;
      this.cas = null;
      this.vault = null;
    } else {
      // Production mode — wire up real git subprocess infrastructure
      this.cwd = cwd;
      this.plumbing = new GitPlumbing({
        runner: ShellRunner.run,
        cwd
      });
      this.repo = new GitRepositoryService({ plumbing: this.plumbing });
      this.graph = new GitGraphAdapter({ plumbing: this.plumbing });
      this.cas = new ContentAddressableStore({ plumbing: this.plumbing });
      this.vault = new VaultResolver();
    }
  }

  /**
   * Routes ref updates to the correct backend.
   * @private
   */
  async _updateRef({ ref, newSha, oldSha }) {
    if (this.repo) {
      await this.repo.updateRef({ ref, newSha, oldSha });
    } else {
      // DI mode — manual CAS: verify current value matches expected oldSha
      if (oldSha) {
        const current = await this.graph.readRef(ref);
        if (current !== oldSha) {
          throw new Error(
            `CAS conflict on ${ref}: expected ${oldSha}, found ${current}`
          );
        }
      }
      await this.graph.updateRef(ref, newSha);
    }
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
   * Resolves the effective content state for an article.
   * @private
   * @returns {{ effectiveState: string, draftSha: string|null, pubSha: string|null, draftStatus: string }}
   */
  async _resolveArticleState(slug) {
    const draftRef = this._refFor(slug, 'articles');
    const pubRef = this._refFor(slug, 'published');

    const draftSha = await this.graph.readRef(draftRef);
    const pubSha = await this.graph.readRef(pubRef);

    if (!draftSha && !pubSha) {
      throw new CmsValidationError(
        `Article not found: "${slug}"`,
        { code: 'article_not_found', field: 'slug' }
      );
    }

    let draftStatus = STATES.DRAFT;
    if (draftSha) {
      const message = await this.graph.showNode(draftSha);
      const decoded = this.codec.decode(message);
      draftStatus = decoded.trailers?.status || STATES.DRAFT;
    }

    const effectiveState = resolveEffectiveState({ draftStatus, pubSha });
    return { effectiveState, draftSha, pubSha, draftStatus };
  }

  /**
   * Returns the effective state of an article.
   */
  async getArticleState({ slug }) {
    const canonicalSlug = canonicalizeSlug(slug);
    const state = await this._resolveArticleState(canonicalSlug);
    return { slug: canonicalSlug, state: state.effectiveState };
  }

  /**
   * Lists all articles of a certain kind.
   */
  async listArticles({ kind = 'articles' } = {}) {
    const canonicalKind = canonicalizeKind(kind);
    const ns = `${this.refPrefix}/${canonicalKind}/`;

    if (this.plumbing) {
      const out = await this.plumbing.execute({
        args: ['for-each-ref', ns, '--format=%(refname) %(objectname)'],
      });

      return out
        .split('\n')
        .filter(Boolean)
        .map((line) => {
          const [ref, sha] = line.split(' ');
          const slug = ref.replace(ns, '');
          return { ref, sha, slug };
        });
    }

    // DI mode — use graph.listRefs + readRef
    const refs = await this.graph.listRefs(ns);
    return Promise.all(refs.map(async (ref) => {
      const sha = await this.graph.readRef(ref);
      const slug = ref.replace(ns, '');
      return { ref, sha, slug };
    }));
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

    // Guard: validate state transition if article already exists
    if (parentSha) {
      const { effectiveState } = await this._resolveArticleState(identity.slug);
      validateTransition(effectiveState, STATES.DRAFT);
    }

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

    await this._updateRef({ ref, newSha, oldSha: parentSha });
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

    // Guard: validate state transition
    const { effectiveState, pubSha } = await this._resolveArticleState(canonicalSlug);
    validateTransition(effectiveState, STATES.PUBLISHED);

    // Idempotent: re-publishing the same SHA is a no-op
    if (pubSha === targetSha) {
      return { ref: pubRef, sha: targetSha, prev: pubSha };
    }

    await this._updateRef({ ref: pubRef, newSha: targetSha, oldSha: pubSha });
    return { ref: pubRef, sha: targetSha, prev: pubSha };
  }

  /**
   * Unpublishes an article: deletes the published ref and marks draft as unpublished.
   */
  async unpublishArticle({ slug }) {
    const canonicalSlug = canonicalizeSlug(slug);
    const draftRef = this._refFor(canonicalSlug, 'articles');
    const pubRef = this._refFor(canonicalSlug, 'published');

    const { effectiveState, draftSha } = await this._resolveArticleState(canonicalSlug);
    validateTransition(effectiveState, STATES.UNPUBLISHED);

    if (!draftSha) {
      throw new CmsValidationError(
        `Cannot unpublish "${canonicalSlug}": no draft ref exists`,
        { code: 'no_draft', field: 'slug' }
      );
    }

    // Read current draft content and re-commit with status: unpublished
    const message = await this.graph.showNode(draftSha);
    const decoded = this.codec.decode(message);
    const { updatedat: _, ...restTrailers } = decoded.trailers || {};
    const newMessage = this.codec.encode({
      title: decoded.title,
      body: decoded.body,
      trailers: { ...restTrailers, status: STATES.UNPUBLISHED, updatedAt: new Date().toISOString() },
    });

    const newSha = await this.graph.commitNode({
      message: newMessage,
      parents: [draftSha],
      sign: process.env.CMS_SIGN === '1',
    });

    // Update draft ref FIRST, delete published ref LAST for atomicity.
    // If deleteRef fails, the published ref survives (safe).
    await this._updateRef({ ref: draftRef, newSha, oldSha: draftSha });
    await this.graph.deleteRef(pubRef);

    return { ref: draftRef, sha: newSha, prev: draftSha };
  }

  /**
   * Reverts an article to its parent's content, preserving full history.
   */
  async revertArticle({ slug }) {
    const canonicalSlug = canonicalizeSlug(slug);
    const draftRef = this._refFor(canonicalSlug, 'articles');

    const { effectiveState, draftSha } = await this._resolveArticleState(canonicalSlug);
    validateTransition(effectiveState, STATES.REVERTED);

    if (!draftSha) {
      throw new CmsValidationError(
        `Cannot revert "${canonicalSlug}": no draft ref exists`,
        { code: 'no_draft', field: 'slug' }
      );
    }

    const info = await this.graph.getNodeInfo(draftSha);
    if (!info.parents || info.parents.length === 0 || !info.parents[0]) {
      throw new CmsValidationError(
        `Cannot revert "${canonicalSlug}": no parent commit exists`,
        { code: 'revert_no_parent', field: 'slug' }
      );
    }

    const parentCommitSha = info.parents[0];
    const parentMessage = await this.graph.showNode(parentCommitSha);
    const parentDecoded = this.codec.decode(parentMessage);
    const { updatedat: _u, ...restParentTrailers } = parentDecoded.trailers || {};

    const newMessage = this.codec.encode({
      title: parentDecoded.title,
      body: parentDecoded.body,
      trailers: { ...restParentTrailers, status: STATES.REVERTED, updatedAt: new Date().toISOString() },
    });

    const newSha = await this.graph.commitNode({
      message: newMessage,
      parents: [draftSha],
      sign: process.env.CMS_SIGN === '1',
    });

    await this._updateRef({ ref: draftRef, newSha, oldSha: draftSha });
    return { ref: draftRef, sha: newSha, prev: draftSha };
  }

  /**
   * Validates that a target SHA exists in an article's ancestry chain.
   * @private
   */
  async _validateAncestry(tipSha, targetSha, slug) {
    let walk = tipSha;
    let steps = 0;
    const walkLimit = 200;
    while (walk && steps < walkLimit) {
      if (walk === targetSha) return;
      const info = await this.graph.getNodeInfo(walk);
      walk = info.parents?.[0] || null;
      steps++;
    }
    if (steps >= walkLimit) {
      throw new CmsValidationError(
        `History walk limit (${walkLimit}) exceeded for article "${slug}"; SHA "${targetSha}" may exist beyond the search window`,
        { code: 'history_walk_limit_exceeded', field: 'sha' }
      );
    }
    throw new CmsValidationError(
      `SHA "${targetSha}" is not in the history of article "${slug}"`,
      { code: 'invalid_version_for_article', field: 'sha' }
    );
  }

  /**
   * Returns version history for an article by walking the parent chain.
   * @param {{ slug: string, limit?: number }} options
   * @returns {Promise<Array<{ sha: string, title: string, status: string, author: string, date: string }>>}
   */
  async getArticleHistory({ slug, limit = 50 }) {
    const canonicalSlug = canonicalizeSlug(slug);
    const draftRef = this._refFor(canonicalSlug, 'articles');
    const pubRef = this._refFor(canonicalSlug, 'published');
    const sha = await this.graph.readRef(draftRef) || await this.graph.readRef(pubRef);

    if (!sha) {
      throw new CmsValidationError(
        `Article not found: "${canonicalSlug}"`,
        { code: 'article_not_found', field: 'slug' }
      );
    }

    const versions = [];
    let current = sha;

    while (current && versions.length < limit) {
      const [info, message] = await Promise.all([
        this.graph.getNodeInfo(current),
        this.graph.showNode(current),
      ]);
      const decoded = this.codec.decode(message);

      versions.push({
        sha: current,
        title: decoded.title,
        status: decoded.trailers?.status || 'draft',
        author: info.author,
        date: info.date,
      });

      current = info.parents?.[0] || null;
    }

    return versions;
  }

  /**
   * Reads full content of a specific commit by SHA.
   * @param {{ slug: string, sha: string }} options
   * @returns {Promise<{ sha: string, title: string, body: string, trailers: object }>}
   */
  async readVersion({ slug, sha }) {
    const canonicalSlug = canonicalizeSlug(slug);
    const draftRef = this._refFor(canonicalSlug, 'articles');
    const pubRef = this._refFor(canonicalSlug, 'published');
    const tipSha = await this.graph.readRef(draftRef) || await this.graph.readRef(pubRef);

    if (!tipSha) {
      throw new CmsValidationError(
        `Article not found: "${canonicalSlug}"`,
        { code: 'article_not_found', field: 'slug' }
      );
    }

    // Ancestry validation: verify SHA belongs to this article's lineage
    await this._validateAncestry(tipSha, sha, canonicalSlug);

    const message = await this.graph.showNode(sha);
    const decoded = this.codec.decode(message);
    return { sha, title: decoded.title, body: decoded.body, trailers: decoded.trailers };
  }

  /**
   * Restores content from a historical SHA as a new draft commit.
   * @param {{ slug: string, sha: string }} options
   * @returns {Promise<{ ref: string, sha: string, prev: string }>}
   */
  async restoreVersion({ slug, sha }) {
    const canonicalSlug = canonicalizeSlug(slug);
    const draftRef = this._refFor(canonicalSlug, 'articles');

    const { effectiveState, draftSha } = await this._resolveArticleState(canonicalSlug);
    validateTransition(effectiveState, STATES.DRAFT);

    if (!draftSha) {
      throw new CmsValidationError(
        `Cannot restore "${canonicalSlug}": no draft ref exists`,
        { code: 'no_draft', field: 'slug' }
      );
    }

    // Ancestry validation: walk parent chain to verify target SHA belongs to this article
    await this._validateAncestry(draftSha, sha, canonicalSlug);

    // Read target SHA content
    const targetMessage = await this.graph.showNode(sha);
    const decoded = this.codec.decode(targetMessage);
    const trailers = decoded.trailers || {};
    const { updatedat: _, restoredfromsha: _r, restoredat: _ra, ...restTrailers } = trailers;

    const now = new Date().toISOString();
    const newMessage = this.codec.encode({
      title: decoded.title,
      body: decoded.body,
      trailers: {
        ...restTrailers,
        status: STATES.DRAFT,
        updatedAt: now,
        restoredFromSha: sha,
        restoredAt: now,
      },
    });

    const newSha = await this.graph.commitNode({
      message: newMessage,
      parents: [draftSha],
      sign: process.env.CMS_SIGN === '1',
    });

    await this._updateRef({ ref: draftRef, newSha, oldSha: draftSha });
    return { ref: draftRef, sha: newSha, prev: draftSha };
  }

  /**
   * Uploads an asset and returns its manifest and CAS info.
   */
  async uploadAsset({ slug, filePath, filename }) {
    if (!this.cas || !this.vault) {
      throw new CmsValidationError(
        'uploadAsset is not supported in DI mode',
        { code: 'unsupported_in_di_mode' }
      );
    }
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
    
    const ref = `${this.refPrefix}/chunks/${canonicalSlug}@current`;
    const commitSha = await this.graph.commitNode({
      message: `asset:${filename}\n\nmanifest: ${treeOid}`,
    });

    await this._updateRef({ ref, newSha: commitSha });
    
    return { manifest, treeOid, commitSha };
  }
}
