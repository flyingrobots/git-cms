import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import CmsService from '../src/lib/CmsService.js';

describe('CmsService (Integration)', () => {
  let cwd;
  let cms;
  const refPrefix = 'refs/cms';

  beforeEach(() => {
    cwd = mkdtempSync(path.join(os.tmpdir(), 'git-cms-service-test-'));
    execFileSync('git', ['init'], { cwd });
    execFileSync('git', ['config', 'user.name', 'Test'], { cwd });
    execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd });
    
    cms = new CmsService({ cwd, refPrefix });
  });

  afterEach(() => {
    rmSync(cwd, { recursive: true, force: true });
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
});