import GitPlumbing, { GitRepositoryService } from '@git-stunts/plumbing';
import WarpGraph, { GitGraphAdapter, projectStateV5 } from '@git-stunts/git-warp';
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
 * @property {import('@git-stunts/git-warp').default} [reviewWarp] - Optional injected warp graph for review lanes.
 * @property {string} [reviewGraphName] - Graph name for the review-lane substrate.
 * @property {string} [reviewWriterId] - Writer ID for the review-lane substrate.
 */

/** Maximum depth for ancestry walks (history listing, validation). */
export const HISTORY_WALK_LIMIT = 200;
const REVIEW_SCOPE_PREFIX = 'article:';
const REVIEW_STATUS_OPEN = 'open';
const REVIEW_STATUS_APPLIED = 'applied';
const SNAPSHOT_RESERVED_TRAILER_KEYS = new Set([
  'contentid',
  'status',
  'updatedat',
]);
const REVIEW_INPUT_RESERVED_TRAILER_KEYS = new Set([
  ...SNAPSHOT_RESERVED_TRAILER_KEYS,
  'restoredfromsha',
  'restoredat',
  'reviewlaneid',
  'reviewappliedat',
  'reviewbasedraftsha',
]);

function normalizeTrailerKey(key) {
  return String(key || '').replace(/[^a-z0-9]/gi, '').toLowerCase();
}

function filterTrailers(trailers, reservedKeys) {
  if (!trailers || typeof trailers !== 'object' || Array.isArray(trailers)) return {};
  const clean = {};
  for (const [key, value] of Object.entries(trailers)) {
    if (!reservedKeys.has(normalizeTrailerKey(key))) {
      clean[key] = value;
    }
  }
  return clean;
}

function parseReviewTrailers(value) {
  if (typeof value !== 'string' || !value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? filterTrailers(parsed, REVIEW_INPUT_RESERVED_TRAILER_KEYS)
      : {};
  } catch {
    return {};
  }
}

function projectionPropsForNode(projection, nodeId) {
  const props = {};
  for (const entry of projection.props) {
    if (entry.node === nodeId) {
      props[entry.key] = entry.value;
    }
  }
  return props;
}

/**
 * CmsService is the core domain orchestrator for Git CMS.
 */
export default class CmsService {
  /**
   * @param {CmsServiceOptions} options
   */
  constructor({ cwd, refPrefix, graph, reviewWarp, reviewGraphName = 'git-cms-review', reviewWriterId = 'cms-review' }) {
    this.refPrefix = refPrefix.replace(/\/$/, '');
    this.reviewGraphName = reviewGraphName;
    this.reviewWriterId = reviewWriterId;
    this.reviewWarp = reviewWarp || null;
    this.reviewWarpPromise = null;

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

  _reviewScopeFor(slug) {
    return `${REVIEW_SCOPE_PREFIX}${canonicalizeSlug(slug)}`;
  }

  _reviewLaneNodeId(laneId) {
    return `review:${laneId}`;
  }

  _articleNodeId(slug) {
    return `article:${canonicalizeSlug(slug)}`;
  }

  _makeReviewLaneId(slug) {
    const stamp = Date.now().toString(36);
    const nonce = Math.random().toString(36).slice(2, 8);
    return `${canonicalizeSlug(slug)}--${stamp}-${nonce}`;
  }

  async _getReviewWarp() {
    if (this.reviewWarp) return this.reviewWarp;
    if (!this.reviewWarpPromise) {
      this.reviewWarpPromise = WarpGraph.open({
        persistence: this.graph,
        graphName: this.reviewGraphName,
        writerId: this.reviewWriterId,
      });
    }
    this.reviewWarp = await this.reviewWarpPromise;
    return this.reviewWarp;
  }

  async _readReviewLaneState(reviewWarp, laneId) {
    const descriptor = await reviewWarp.getWorkingSet(laneId);
    if (!descriptor) {
      throw new CmsValidationError(
        `Review lane not found: "${laneId}"`,
        { code: 'review_lane_not_found', field: 'laneId' }
      );
    }

    const state = await reviewWarp.materializeWorkingSet(laneId);
    const projection = projectStateV5(state);
    const nodeId = this._reviewLaneNodeId(laneId);
    if (!projection.nodes.includes(nodeId)) {
      throw new CmsValidationError(
        `Review lane "${laneId}" is missing its review node`,
        { code: 'review_lane_corrupt', field: 'laneId' }
      );
    }

    const props = projectionPropsForNode(projection, nodeId);
    return { descriptor, props, projection };
  }

  _assertReviewScope(descriptor, slug) {
    const expected = this._reviewScopeFor(slug);
    if (descriptor.scope !== expected) {
      throw new CmsValidationError(
        `Review lane "${descriptor.workingSetId}" does not belong to article "${canonicalizeSlug(slug)}"`,
        { code: 'review_lane_scope_mismatch', field: 'laneId' }
      );
    }
  }

  async _syncReviewArticleNode(reviewWarp, slug) {
    const canonicalSlug = canonicalizeSlug(slug);
    const articleState = await this._resolveArticleState(canonicalSlug);
    const article = articleState.draftSha
      ? await this.readArticle({ slug: canonicalSlug })
      : await this.readArticle({ slug: canonicalSlug, kind: 'published' });
    const articleNodeId = this._articleNodeId(canonicalSlug);

    await reviewWarp.patch((p) => {
      p.addNode(articleNodeId)
        .setProperty(articleNodeId, 'kind', 'article')
        .setProperty(articleNodeId, 'slug', canonicalSlug)
        .setProperty(articleNodeId, 'title', article.title)
        .setProperty(articleNodeId, 'draftSha', articleState.draftSha || '')
        .setProperty(articleNodeId, 'publishedSha', articleState.pubSha || '')
        .setProperty(articleNodeId, 'effectiveState', articleState.effectiveState)
        .setProperty(articleNodeId, 'updatedAt', new Date().toISOString());
    });

    return { article, articleState, articleNodeId };
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
    const rawTrailers = trailers && typeof trailers === 'object' ? trailers : {};
    const identity = resolveContentIdentity({ slug, trailers: rawTrailers });
    const safeTrailers = filterTrailers(rawTrailers, SNAPSHOT_RESERVED_TRAILER_KEYS);
    const ref = this._refFor(identity.slug, 'articles');
    const parentSha = await this.graph.readRef(ref);

    // Guard: validate state transition if article already exists
    if (parentSha) {
      const { effectiveState } = await this._resolveArticleState(identity.slug);
      const targetState = effectiveState === STATES.PUBLISHED ? STATES.PUBLISHED : STATES.DRAFT;
      validateTransition(effectiveState, targetState);
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
    const draftSha = await this.graph.readRef(draftRef);
    if (!draftSha) {
      throw new CmsValidationError(
        `Cannot publish "${canonicalSlug}": no draft ref exists`,
        { code: 'no_draft', field: 'slug' }
      );
    }
    if (sha && sha !== draftSha) {
      throw new CmsValidationError(
        `Draft tip advanced for "${canonicalSlug}": expected ${sha}, found ${draftSha}`,
        { code: 'stale_draft_sha', field: 'sha' }
      );
    }
    const targetSha = draftSha;

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
    const walkLimit = HISTORY_WALK_LIMIT;
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
    const effectiveLimit = Math.max(1, Math.min(limit, HISTORY_WALK_LIMIT));
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

    while (current && versions.length < effectiveLimit) {
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
    return { sha, title: decoded.title, body: decoded.body, trailers: decoded.trailers || {} };
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
    // trailer-codec normalizes keys to lowercase on decode; destructure the
    // lowercase forms so the subsequent camelCase writes create fresh keys.
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
   * Creates a durable review lane for an article using git-warp working sets.
   * The live article stays in commit/ref space; the review lane holds speculative
   * proposal state until it is explicitly applied back as a new draft commit.
   */
  async createReviewLane({ slug, owner = null }) {
    const canonicalSlug = canonicalizeSlug(slug);
    const reviewWarp = await this._getReviewWarp();
    const { article, articleState, articleNodeId } = await this._syncReviewArticleNode(reviewWarp, canonicalSlug);
    const laneId = this._makeReviewLaneId(canonicalSlug);
    const reviewNodeId = this._reviewLaneNodeId(laneId);
    const now = new Date().toISOString();
    const trailersJson = JSON.stringify(article.trailers || {});

    await reviewWarp.patch((p) => {
      p.addNode(reviewNodeId)
        .setProperty(reviewNodeId, 'kind', 'reviewLane')
        .setProperty(reviewNodeId, 'laneId', laneId)
        .setProperty(reviewNodeId, 'articleSlug', canonicalSlug)
        .setProperty(reviewNodeId, 'title', article.title)
        .setProperty(reviewNodeId, 'body', article.body)
        .setProperty(reviewNodeId, 'trailersJson', trailersJson)
        .setProperty(reviewNodeId, 'status', REVIEW_STATUS_OPEN)
        .setProperty(reviewNodeId, 'baseDraftSha', articleState.draftSha || '')
        .setProperty(reviewNodeId, 'basePublishedSha', articleState.pubSha || '')
        .setProperty(reviewNodeId, 'createdAt', now)
        .setProperty(reviewNodeId, 'updatedAt', now);
      if (owner) {
        p.setProperty(reviewNodeId, 'owner', owner);
      }
      p.addEdge(reviewNodeId, articleNodeId, 'reviews');
    });

    const descriptor = await reviewWarp.createWorkingSet({
      workingSetId: laneId,
      owner,
      scope: this._reviewScopeFor(canonicalSlug),
    });

    return {
      laneId,
      slug: canonicalSlug,
      owner: descriptor.owner,
      status: REVIEW_STATUS_OPEN,
      title: article.title,
      body: article.body,
      trailers: filterTrailers(article.trailers || {}, REVIEW_INPUT_RESERVED_TRAILER_KEYS),
      baseDraftSha: articleState.draftSha,
      basePublishedSha: articleState.pubSha,
      patchCount: descriptor.overlay.patchCount,
      createdAt: descriptor.createdAt,
      updatedAt: descriptor.updatedAt,
    };
  }

  /**
   * Lists review lanes for one article.
   */
  async listReviewLanes({ slug }) {
    const canonicalSlug = canonicalizeSlug(slug);
    const reviewWarp = await this._getReviewWarp();
    const descriptors = await reviewWarp.listWorkingSets();
    const relevant = descriptors.filter((descriptor) => descriptor.scope === this._reviewScopeFor(canonicalSlug));

    const lanes = await Promise.all(relevant.map(async (descriptor) => {
      const { props } = await this._readReviewLaneState(reviewWarp, descriptor.workingSetId);
      return {
        laneId: descriptor.workingSetId,
        owner: descriptor.owner,
        status: typeof props.status === 'string' ? props.status : REVIEW_STATUS_OPEN,
        title: typeof props.title === 'string' ? props.title : '',
        baseDraftSha: typeof props.baseDraftSha === 'string' && props.baseDraftSha ? props.baseDraftSha : null,
        basePublishedSha: typeof props.basePublishedSha === 'string' && props.basePublishedSha ? props.basePublishedSha : null,
        patchCount: descriptor.overlay.patchCount,
        createdAt: descriptor.createdAt,
        updatedAt: typeof props.updatedAt === 'string' ? props.updatedAt : descriptor.updatedAt,
        appliedAt: typeof props.appliedAt === 'string' ? props.appliedAt : null,
        appliedDraftSha: typeof props.appliedDraftSha === 'string' && props.appliedDraftSha ? props.appliedDraftSha : null,
      };
    }));

    return lanes.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  }

  /**
   * Reads the visible proposal state of one review lane.
   */
  async readReviewLane({ slug, laneId }) {
    const canonicalSlug = canonicalizeSlug(slug);
    const reviewWarp = await this._getReviewWarp();
    const { descriptor, props } = await this._readReviewLaneState(reviewWarp, laneId);
    this._assertReviewScope(descriptor, canonicalSlug);

    return {
      laneId: descriptor.workingSetId,
      slug: canonicalSlug,
      owner: descriptor.owner,
      scope: descriptor.scope,
      status: typeof props.status === 'string' ? props.status : REVIEW_STATUS_OPEN,
      title: typeof props.title === 'string' ? props.title : '',
      body: typeof props.body === 'string' ? props.body : '',
      trailers: parseReviewTrailers(props.trailersJson),
      baseDraftSha: typeof props.baseDraftSha === 'string' && props.baseDraftSha ? props.baseDraftSha : null,
      basePublishedSha: typeof props.basePublishedSha === 'string' && props.basePublishedSha ? props.basePublishedSha : null,
      patchCount: descriptor.overlay.patchCount,
      createdAt: typeof props.createdAt === 'string' ? props.createdAt : descriptor.createdAt,
      updatedAt: typeof props.updatedAt === 'string' ? props.updatedAt : descriptor.updatedAt,
      appliedAt: typeof props.appliedAt === 'string' ? props.appliedAt : null,
      appliedDraftSha: typeof props.appliedDraftSha === 'string' && props.appliedDraftSha ? props.appliedDraftSha : null,
    };
  }

  /**
   * Saves speculative review-lane content without touching the live article refs.
   */
  async saveReviewLaneSnapshot({ slug, laneId, title, body, trailers = {} }) {
    const canonicalSlug = canonicalizeSlug(slug);
    const reviewWarp = await this._getReviewWarp();
    const { descriptor, props } = await this._readReviewLaneState(reviewWarp, laneId);
    this._assertReviewScope(descriptor, canonicalSlug);

    if (props.status === REVIEW_STATUS_APPLIED) {
      throw new CmsValidationError(
        `Review lane "${laneId}" is already applied`,
        { code: 'review_lane_closed', field: 'laneId' }
      );
    }

    const reviewNodeId = this._reviewLaneNodeId(laneId);
    const safeTrailers = filterTrailers(trailers, REVIEW_INPUT_RESERVED_TRAILER_KEYS);
    const now = new Date().toISOString();
    await reviewWarp.patchWorkingSet(laneId, (p) => {
      p.setProperty(reviewNodeId, 'title', title)
        .setProperty(reviewNodeId, 'body', body)
        .setProperty(reviewNodeId, 'trailersJson', JSON.stringify(safeTrailers))
        .setProperty(reviewNodeId, 'status', REVIEW_STATUS_OPEN)
        .setProperty(reviewNodeId, 'updatedAt', now);
    });

    return {
      laneId: descriptor.workingSetId,
      slug: canonicalSlug,
      owner: descriptor.owner,
      scope: descriptor.scope,
      status: REVIEW_STATUS_OPEN,
      title,
      body,
      trailers: safeTrailers,
      baseDraftSha: typeof props.baseDraftSha === 'string' && props.baseDraftSha ? props.baseDraftSha : null,
      basePublishedSha: typeof props.basePublishedSha === 'string' && props.basePublishedSha ? props.basePublishedSha : null,
      patchCount: descriptor.overlay.patchCount + 1,
      createdAt: typeof props.createdAt === 'string' ? props.createdAt : descriptor.createdAt,
      updatedAt: now,
      appliedAt: null,
      appliedDraftSha: null,
    };
  }

  /**
   * Applies a review lane back into the live article by writing a new draft commit.
   */
  async applyReviewLane({ slug, laneId }) {
    const canonicalSlug = canonicalizeSlug(slug);
    const reviewWarp = await this._getReviewWarp();
    const { descriptor, props } = await this._readReviewLaneState(reviewWarp, laneId);
    this._assertReviewScope(descriptor, canonicalSlug);

    if (props.status === REVIEW_STATUS_APPLIED) {
      throw new CmsValidationError(
        `Review lane "${laneId}" is already applied`,
        { code: 'review_lane_closed', field: 'laneId' }
      );
    }

    const { draftSha } = await this._resolveArticleState(canonicalSlug);
    const baseDraftSha = typeof props.baseDraftSha === 'string' && props.baseDraftSha ? props.baseDraftSha : null;
    if (!draftSha || draftSha !== baseDraftSha) {
      throw new CmsValidationError(
        `Review lane "${laneId}" is stale for article "${canonicalSlug}"`,
        { code: 'stale_review_lane', field: 'laneId' }
      );
    }

    const now = new Date().toISOString();
    const result = await this.saveSnapshot({
      slug: canonicalSlug,
      title: typeof props.title === 'string' ? props.title : '',
      body: typeof props.body === 'string' ? props.body : '',
      trailers: {
        ...parseReviewTrailers(props.trailersJson),
        reviewLaneId: laneId,
        reviewAppliedAt: now,
        reviewBaseDraftSha: draftSha,
      },
    });

    const reviewNodeId = this._reviewLaneNodeId(laneId);
    await reviewWarp.patchWorkingSet(laneId, (p) => {
      p.setProperty(reviewNodeId, 'status', REVIEW_STATUS_APPLIED)
        .setProperty(reviewNodeId, 'appliedAt', now)
        .setProperty(reviewNodeId, 'appliedDraftSha', result.sha)
        .setProperty(reviewNodeId, 'updatedAt', now);
    });

    await this._syncReviewArticleNode(reviewWarp, canonicalSlug);

    return {
      laneId,
      slug: canonicalSlug,
      sha: result.sha,
      prev: result.parent,
      appliedAt: now,
    };
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
