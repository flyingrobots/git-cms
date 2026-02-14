import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import CmsService from '../src/lib/CmsService.js';
import { migrate, readLayoutVersion, LAYOUT_VERSION_KEY } from '../src/lib/LayoutMigration.js';

describe('Layout Migration (E2E — real git)', () => {
  let cwd;
  const refPrefix = 'refs/cms';

  beforeEach(() => {
    cwd = mkdtempSync(path.join(os.tmpdir(), 'git-cms-layout-e2e-'));
    execFileSync('git', ['init'], { cwd });
    execFileSync('git', ['config', 'user.name', 'Test'], { cwd });
    execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd });
  });

  afterEach(() => {
    rmSync(cwd, { recursive: true, force: true });
  });

  it('stamps version readable via raw git config', async () => {
    const cms = new CmsService({ cwd, refPrefix });
    const result = await migrate({ graph: cms.graph, refPrefix });

    expect(result.from).toBe(0);
    expect(result.to).toBe(1);

    // Verify via raw git config (not through adapter)
    const raw = execFileSync('git', ['config', '--get', LAYOUT_VERSION_KEY], { cwd }).toString().trim();
    expect(raw).toBe('1');
  });

  it('existing articles survive migration', async () => {
    const cms = new CmsService({ cwd, refPrefix });
    await cms.saveSnapshot({ slug: 'survive-test', title: 'Before', body: 'Content' });

    await migrate({ graph: cms.graph, refPrefix });

    const article = await cms.readArticle({ slug: 'survive-test' });
    expect(article.title).toBe('Before');
    expect(article.body).toContain('Content');
    expect(await readLayoutVersion(cms.graph)).toBe(1);
  });
});
