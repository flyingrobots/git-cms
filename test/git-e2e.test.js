import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import CmsService from '../src/lib/CmsService.js';

describe('CmsService (E2E — real git)', () => {
  let cwd;
  let cms;
  const refPrefix = 'refs/cms';

  beforeEach(() => {
    cwd = mkdtempSync(path.join(os.tmpdir(), 'git-cms-e2e-'));
    execFileSync('git', ['init'], { cwd });
    execFileSync('git', ['config', 'user.name', 'Test'], { cwd });
    execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd });
    cms = new CmsService({ cwd, refPrefix });
  });

  afterEach(() => {
    rmSync(cwd, { recursive: true, force: true });
  });

  it('save → read → publish round-trip against real repo', async () => {
    const slug = 'e2e-smoke';
    const title = 'E2E Title';
    const body = 'E2E body content';

    const saved = await cms.saveSnapshot({ slug, title, body });
    expect(saved.sha).toHaveLength(40);

    const article = await cms.readArticle({ slug });
    expect(article.title).toBe(title);
    expect(article.body).toBe(body + '\n');
    expect(article.trailers.status).toBe('draft');

    await cms.publishArticle({ slug, sha: saved.sha });
    const pub = await cms.readArticle({ slug, kind: 'published' });
    expect(pub.sha).toBe(saved.sha);
  });

  it('propagates underlying git errors while listing', async () => {
    const originalExecute = cms.plumbing.execute;
    cms.plumbing.execute = async () => {
      throw new Error('fatal: permission denied');
    };

    await expect(cms.listArticles()).rejects.toThrow('fatal: permission denied');
    cms.plumbing.execute = originalExecute;
  });
});
