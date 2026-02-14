import { describe, it, expect, beforeEach } from 'vitest';
import InMemoryGraphAdapter from '#test/InMemoryGraphAdapter';
import CmsService from '../src/lib/CmsService.js';
import { CmsValidationError } from '../src/lib/ContentIdentityPolicy.js';
import { resolveEffectiveState } from '../src/lib/ContentStatePolicy.js';

function createTestCms() {
  const graph = new InMemoryGraphAdapter();
  return new CmsService({ refPrefix: 'refs/cms', graph });
}

describe('CmsService (Integration)', () => {
  let cms;

  beforeEach(() => {
    cms = createTestCms();
  });

  it('saves a snapshot and reads it back', async () => {
    const slug = 'hello-world';
    const title = 'Title';
    const body = 'Body content';

    const res = await cms.saveSnapshot({ slug, title, body });

    expect(res.sha).toHaveLength(40);

    const article = await cms.readArticle({ slug });
    expect(article.title).toBe(title);
    expect(article.body).toBe(body + '\n');
    expect(article.trailers.status).toBe('draft');
  });

  it('updates an existing article (history)', async () => {
    const slug = 'history-test';

    const v1 = await cms.saveSnapshot({ slug, title: 'v1', body: 'b1' });
    const v2 = await cms.saveSnapshot({ slug, title: 'v2', body: 'b2' });

    expect(v2.parent).toBe(v1.sha);

    const article = await cms.readArticle({ slug });
    expect(article.title).toBe('v2');
  });

  it('lists articles', async () => {
    await cms.saveSnapshot({ slug: 'a', title: 'A', body: 'A' });
    await cms.saveSnapshot({ slug: 'b', title: 'B', body: 'B' });

    const list = await cms.listArticles();
    expect(list).toHaveLength(2);
    expect(list.map(i => i.slug).sort()).toEqual(['a', 'b']);
  });

  it('publishes an article', async () => {
    const slug = 'pub-test';
    const { sha } = await cms.saveSnapshot({ slug, title: 'ready', body: '...' });

    await cms.publishArticle({ slug, sha });

    const pubArticle = await cms.readArticle({ slug, kind: 'published' });
    expect(pubArticle.sha).toBe(sha);
  });

  it('canonicalizes mixed-case slugs and stores contentId trailer', async () => {
    await cms.saveSnapshot({ slug: 'Hello-World', title: 'Title', body: 'Body' });

    const article = await cms.readArticle({ slug: 'hello-world' });
    expect(article.trailers.contentid).toBe('hello-world');
  });

  it('rejects invalid slug format', async () => {
    await expect(
      cms.saveSnapshot({ slug: 'bad slug', title: 'Title', body: 'Body' })
    ).rejects.toThrow(/slug must match/);
  });

  it('rejects reserved slug names', async () => {
    await expect(
      cms.saveSnapshot({ slug: 'api', title: 'Title', body: 'Body' })
    ).rejects.toThrow(/slug "api" is reserved/);
  });

  it('rejects mismatched contentId trailers', async () => {
    await expect(
      cms.saveSnapshot({
        slug: 'policy-test',
        title: 'Title',
        body: 'Body',
        trailers: { contentId: 'another-id' },
      })
    ).rejects.toThrow(/must match canonical slug/);
  });

  it('uploadAsset in DI mode throws unsupported_in_di_mode', async () => {
    await expect(
      cms.uploadAsset({ slug: 'test', filePath: '/tmp/f', filename: 'f.png' })
    ).rejects.toMatchObject({ name: 'CmsValidationError', code: 'unsupported_in_di_mode' });
  });
});

describe('State Machine', () => {
  let cms;

  beforeEach(() => {
    cms = createTestCms();
  });

  it('draft → draft (re-save) keeps status draft', async () => {
    await cms.saveSnapshot({ slug: 'sm-test', title: 'v1', body: 'b1' });
    await cms.saveSnapshot({ slug: 'sm-test', title: 'v2', body: 'b2' });
    const { state } = await cms.getArticleState({ slug: 'sm-test' });
    expect(state).toBe('draft');
  });

  it('draft → published sets effective state to published', async () => {
    await cms.saveSnapshot({ slug: 'sm-pub', title: 'Title', body: 'Body' });
    await cms.publishArticle({ slug: 'sm-pub' });
    const { state } = await cms.getArticleState({ slug: 'sm-pub' });
    expect(state).toBe('published');
  });

  it('published → unpublished deletes published ref and sets status', async () => {
    await cms.saveSnapshot({ slug: 'sm-unpub', title: 'Title', body: 'Body' });
    await cms.publishArticle({ slug: 'sm-unpub' });
    await cms.unpublishArticle({ slug: 'sm-unpub' });

    const { state } = await cms.getArticleState({ slug: 'sm-unpub' });
    expect(state).toBe('unpublished');

    // Published ref should be gone
    const pubList = await cms.listArticles({ kind: 'published' });
    expect(pubList.find(a => a.slug === 'sm-unpub')).toBeUndefined();
  });

  it('unpublished → draft via re-save', async () => {
    await cms.saveSnapshot({ slug: 'sm-resave', title: 'v1', body: 'b1' });
    await cms.publishArticle({ slug: 'sm-resave' });
    await cms.unpublishArticle({ slug: 'sm-resave' });
    await cms.saveSnapshot({ slug: 'sm-resave', title: 'v2', body: 'b2' });

    const { state } = await cms.getArticleState({ slug: 'sm-resave' });
    expect(state).toBe('draft');
  });

  it('unpublished → published via re-publish', async () => {
    await cms.saveSnapshot({ slug: 'sm-repub', title: 'v1', body: 'b1' });
    await cms.publishArticle({ slug: 'sm-repub' });
    await cms.unpublishArticle({ slug: 'sm-repub' });
    await cms.publishArticle({ slug: 'sm-repub' });

    const { state } = await cms.getArticleState({ slug: 'sm-repub' });
    expect(state).toBe('published');
  });

  it('reverted → draft via re-save', async () => {
    await cms.saveSnapshot({ slug: 'sm-rev-resave', title: 'v1', body: 'b1' });
    await cms.saveSnapshot({ slug: 'sm-rev-resave', title: 'v2', body: 'b2' });
    await cms.revertArticle({ slug: 'sm-rev-resave' });

    const { state: revertedState } = await cms.getArticleState({ slug: 'sm-rev-resave' });
    expect(revertedState).toBe('reverted');

    await cms.saveSnapshot({ slug: 'sm-rev-resave', title: 'v3', body: 'b3' });
    const { state } = await cms.getArticleState({ slug: 'sm-rev-resave' });
    expect(state).toBe('draft');
  });

  it('revert creates new commit with parent content, preserves history', async () => {
    const v1 = await cms.saveSnapshot({ slug: 'sm-rev-content', title: 'Original', body: 'original body' });
    await cms.saveSnapshot({ slug: 'sm-rev-content', title: 'Edited', body: 'edited body' });
    const reverted = await cms.revertArticle({ slug: 'sm-rev-content' });

    // New SHA, not the same as v1
    expect(reverted.sha).not.toBe(v1.sha);

    const article = await cms.readArticle({ slug: 'sm-rev-content' });
    expect(article.title).toBe('Original');
    expect(article.body).toContain('original body');
    expect(article.trailers.status).toBe('reverted');
  });

  it('revert with no parent throws revert_no_parent', async () => {
    await cms.saveSnapshot({ slug: 'sm-no-parent', title: 'First', body: 'only' });

    await expect(cms.revertArticle({ slug: 'sm-no-parent' })).rejects.toMatchObject({
      name: 'CmsValidationError',
      code: 'revert_no_parent',
    });
  });

  it('revert with nonexistent slug throws article_not_found', async () => {
    await expect(cms.revertArticle({ slug: 'no-such-slug' })).rejects.toMatchObject({
      name: 'CmsValidationError',
      code: 'article_not_found',
    });
  });

  it('cannot unpublish a draft', async () => {
    await cms.saveSnapshot({ slug: 'sm-bad-unpub', title: 'T', body: 'B' });

    await expect(cms.unpublishArticle({ slug: 'sm-bad-unpub' })).rejects.toMatchObject({
      name: 'CmsValidationError',
      code: 'invalid_state_transition',
    });
  });

  it('cannot revert a published article', async () => {
    await cms.saveSnapshot({ slug: 'sm-bad-rev', title: 'T', body: 'B' });
    await cms.publishArticle({ slug: 'sm-bad-rev' });

    await expect(cms.revertArticle({ slug: 'sm-bad-rev' })).rejects.toMatchObject({
      name: 'CmsValidationError',
      code: 'invalid_state_transition',
    });
  });

  it('cannot publish a reverted article', async () => {
    await cms.saveSnapshot({ slug: 'sm-bad-pub-rev', title: 'v1', body: 'b1' });
    await cms.saveSnapshot({ slug: 'sm-bad-pub-rev', title: 'v2', body: 'b2' });
    await cms.revertArticle({ slug: 'sm-bad-pub-rev' });

    await expect(cms.publishArticle({ slug: 'sm-bad-pub-rev' })).rejects.toMatchObject({
      name: 'CmsValidationError',
      code: 'invalid_state_transition',
    });
  });

  it('cannot unpublish a reverted article', async () => {
    await cms.saveSnapshot({ slug: 'sm-rev-unpub', title: 'v1', body: 'b1' });
    await cms.saveSnapshot({ slug: 'sm-rev-unpub', title: 'v2', body: 'b2' });
    await cms.revertArticle({ slug: 'sm-rev-unpub' });

    await expect(cms.unpublishArticle({ slug: 'sm-rev-unpub' })).rejects.toMatchObject({
      name: 'CmsValidationError',
      code: 'invalid_state_transition',
    });
  });

  it('cannot revert a reverted article (double revert)', async () => {
    await cms.saveSnapshot({ slug: 'sm-dbl-rev', title: 'v1', body: 'b1' });
    await cms.saveSnapshot({ slug: 'sm-dbl-rev', title: 'v2', body: 'b2' });
    await cms.revertArticle({ slug: 'sm-dbl-rev' });

    await expect(cms.revertArticle({ slug: 'sm-dbl-rev' })).rejects.toMatchObject({
      name: 'CmsValidationError',
      code: 'invalid_state_transition',
    });
  });

  it('cannot revert an unpublished article', async () => {
    await cms.saveSnapshot({ slug: 'sm-unpub-rev', title: 'v1', body: 'b1' });
    await cms.publishArticle({ slug: 'sm-unpub-rev' });
    await cms.unpublishArticle({ slug: 'sm-unpub-rev' });

    await expect(cms.revertArticle({ slug: 'sm-unpub-rev' })).rejects.toMatchObject({
      name: 'CmsValidationError',
      code: 'invalid_state_transition',
    });
  });

  it('publish is idempotent (same SHA)', async () => {
    await cms.saveSnapshot({ slug: 'sm-idem', title: 'T', body: 'B' });
    const first = await cms.publishArticle({ slug: 'sm-idem' });
    const second = await cms.publishArticle({ slug: 'sm-idem' });

    expect(second.sha).toBe(first.sha);
    expect(second.prev).toBe(first.sha);
  });

  it('resolveEffectiveState throws on unknown status', () => {
    expect(() => resolveEffectiveState({ draftStatus: 'bogus', pubSha: null })).toThrow(
      /Unrecognized draft status/
    );
  });
});

describe('Version History', () => {
  let cms;

  beforeEach(() => {
    cms = createTestCms();
  });

  it('getArticleHistory returns versions newest-first', async () => {
    await cms.saveSnapshot({ slug: 'hist-order', title: 'v1', body: 'b1' });
    await cms.saveSnapshot({ slug: 'hist-order', title: 'v2', body: 'b2' });
    await cms.saveSnapshot({ slug: 'hist-order', title: 'v3', body: 'b3' });

    const history = await cms.getArticleHistory({ slug: 'hist-order' });
    expect(history).toHaveLength(3);
    expect(history[0].title).toBe('v3');
    expect(history[1].title).toBe('v2');
    expect(history[2].title).toBe('v1');
  });

  it('getArticleHistory includes correct status per version', async () => {
    await cms.saveSnapshot({ slug: 'hist-status', title: 'v1', body: 'b1' });
    await cms.saveSnapshot({ slug: 'hist-status', title: 'v2', body: 'b2' });
    await cms.revertArticle({ slug: 'hist-status' });

    const history = await cms.getArticleHistory({ slug: 'hist-status' });
    expect(history[0].status).toBe('reverted');
    expect(history[1].status).toBe('draft');
    expect(history[2].status).toBe('draft');
  });

  it('getArticleHistory respects limit', async () => {
    await cms.saveSnapshot({ slug: 'hist-limit', title: 'v1', body: 'b1' });
    await cms.saveSnapshot({ slug: 'hist-limit', title: 'v2', body: 'b2' });
    await cms.saveSnapshot({ slug: 'hist-limit', title: 'v3', body: 'b3' });

    const history = await cms.getArticleHistory({ slug: 'hist-limit', limit: 2 });
    expect(history).toHaveLength(2);
    expect(history[0].title).toBe('v3');
    expect(history[1].title).toBe('v2');
  });

  it('getArticleHistory throws for nonexistent article', async () => {
    await expect(cms.getArticleHistory({ slug: 'no-such-article' })).rejects.toMatchObject({
      name: 'CmsValidationError',
      code: 'article_not_found',
    });
  });

  it('getArticleHistory returns single entry for 1-version article', async () => {
    await cms.saveSnapshot({ slug: 'hist-single', title: 'only', body: 'one' });

    const history = await cms.getArticleHistory({ slug: 'hist-single' });
    expect(history).toHaveLength(1);
    expect(history[0].title).toBe('only');
  });

  it('readVersion returns full content for a specific SHA', async () => {
    const v1 = await cms.saveSnapshot({ slug: 'rv-test', title: 'First', body: 'first body' });
    await cms.saveSnapshot({ slug: 'rv-test', title: 'Second', body: 'second body' });

    const version = await cms.readVersion({ slug: 'rv-test', sha: v1.sha });
    expect(version.sha).toBe(v1.sha);
    expect(version.title).toBe('First');
    expect(version.body).toContain('first body');
  });

  it('restoreVersion creates new commit with old content', async () => {
    const v1 = await cms.saveSnapshot({ slug: 'restore-test', title: 'Original', body: 'original body' });
    await cms.saveSnapshot({ slug: 'restore-test', title: 'Edited', body: 'edited body' });

    const result = await cms.restoreVersion({ slug: 'restore-test', sha: v1.sha });
    expect(result.sha).not.toBe(v1.sha);

    const article = await cms.readArticle({ slug: 'restore-test' });
    expect(article.title).toBe('Original');
    expect(article.body).toContain('original body');
    expect(article.trailers.status).toBe('draft');
  });

  it('restoreVersion preserves history chain (commit count)', async () => {
    await cms.saveSnapshot({ slug: 'restore-chain', title: 'v1', body: 'b1' });
    const v1 = await cms.saveSnapshot({ slug: 'restore-chain', title: 'v1', body: 'b1' });
    await cms.saveSnapshot({ slug: 'restore-chain', title: 'v2', body: 'b2' });

    await cms.restoreVersion({ slug: 'restore-chain', sha: v1.sha });

    // After 3 saves + 1 restore = 4 versions in history
    const history = await cms.getArticleHistory({ slug: 'restore-chain' });
    expect(history).toHaveLength(4);
  });

  it('restoreVersion blocks on published articles', async () => {
    const v1 = await cms.saveSnapshot({ slug: 'restore-pub', title: 'v1', body: 'b1' });
    await cms.saveSnapshot({ slug: 'restore-pub', title: 'v2', body: 'b2' });
    await cms.publishArticle({ slug: 'restore-pub' });

    await expect(cms.restoreVersion({ slug: 'restore-pub', sha: v1.sha })).rejects.toMatchObject({
      name: 'CmsValidationError',
      code: 'invalid_state_transition',
    });
  });

  it('restoreVersion works on unpublished articles', async () => {
    const v1 = await cms.saveSnapshot({ slug: 'restore-unpub', title: 'v1', body: 'b1' });
    await cms.saveSnapshot({ slug: 'restore-unpub', title: 'v2', body: 'b2' });
    await cms.publishArticle({ slug: 'restore-unpub' });
    await cms.unpublishArticle({ slug: 'restore-unpub' });

    const result = await cms.restoreVersion({ slug: 'restore-unpub', sha: v1.sha });
    expect(result.sha).toBeDefined();

    const article = await cms.readArticle({ slug: 'restore-unpub' });
    expect(article.title).toBe('v1');
  });

  it('restoreVersion works on reverted articles', async () => {
    const v1 = await cms.saveSnapshot({ slug: 'restore-rev', title: 'v1', body: 'b1' });
    await cms.saveSnapshot({ slug: 'restore-rev', title: 'v2', body: 'b2' });
    await cms.revertArticle({ slug: 'restore-rev' });

    const result = await cms.restoreVersion({ slug: 'restore-rev', sha: v1.sha });
    expect(result.sha).toBeDefined();

    const article = await cms.readArticle({ slug: 'restore-rev' });
    expect(article.title).toBe('v1');
  });

  it('restoreVersion throws for SHA outside article lineage', async () => {
    await cms.saveSnapshot({ slug: 'restore-lineage-a', title: 'A', body: 'a' });
    const other = await cms.saveSnapshot({ slug: 'restore-lineage-b', title: 'B', body: 'b' });

    await expect(cms.restoreVersion({ slug: 'restore-lineage-a', sha: other.sha })).rejects.toMatchObject({
      name: 'CmsValidationError',
      code: 'invalid_version_for_article',
    });
  });

  it('restoreVersion includes provenance trailers (restoredFromSha, restoredAt)', async () => {
    const v1 = await cms.saveSnapshot({ slug: 'restore-prov', title: 'v1', body: 'b1' });
    await cms.saveSnapshot({ slug: 'restore-prov', title: 'v2', body: 'b2' });

    await cms.restoreVersion({ slug: 'restore-prov', sha: v1.sha });

    const article = await cms.readArticle({ slug: 'restore-prov' });
    expect(article.trailers.restoredfromsha).toBe(v1.sha);
    expect(article.trailers.restoredat).toBeDefined();
  });
});
