import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { writeSnapshot, readTipMessage, listRefs, fastForwardPublished } from '../src/lib/git.js';

function run(args, cwd) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

describe('Git CMS Core', () => {
  let cwd;

  beforeEach(() => {
    cwd = mkdtempSync(path.join(os.tmpdir(), 'git-cms-test-'));
    run(['init'], cwd);
    run(['config', 'user.name', 'Test'], cwd);
    run(['config', 'user.email', 'test@example.com'], cwd);
  });

  afterEach(() => {
    rmSync(cwd, { recursive: true, force: true });
  });

  it('writes a snapshot to a new ref', () => {
    const slug = 'hello-world';
    const message = 'Title\n\nBody content\n\nStatus: draft';
    
    const res = writeSnapshot({ slug, message, cwd, refPrefix: 'refs/cms' });
    
    expect(res.sha).toHaveLength(40);
    expect(res.ref).toBe('refs/cms/articles/hello-world');
    
    // Verify in git
    const log = run(['show', '-s', '--format=%B', res.sha], cwd);
    expect(log.trim()).toBe(message);
  });

  it('updates an existing ref (history)', () => {
    const slug = 'history-test';
    
    const v1 = writeSnapshot({ slug, message: 'v1', cwd, refPrefix: 'refs/cms' });
    const v2 = writeSnapshot({ slug, message: 'v2', cwd, refPrefix: 'refs/cms' });
    
    expect(v2.parent).toBe(v1.sha);
    
    const tip = readTipMessage(slug, 'draft', { cwd, refPrefix: 'refs/cms' });
    expect(tip.sha).toBe(v2.sha);
    expect(tip.message).toBe('v2');
  });

  it('lists refs', () => {
    writeSnapshot({ slug: 'a', message: 'A', cwd, refPrefix: 'refs/cms' });
    writeSnapshot({ slug: 'b', message: 'B', cwd, refPrefix: 'refs/cms' });
    
    const list = listRefs('draft', { cwd, refPrefix: 'refs/cms' });
    expect(list).toHaveLength(2);
    expect(list.map(i => i.slug).sort()).toEqual(['a', 'b']);
  });

  it('publishes (fast-forward)', () => {
    const slug = 'pub-test';
    const { sha } = writeSnapshot({ slug, message: 'ready', cwd, refPrefix: 'refs/cms' });
    
    fastForwardPublished(slug, sha, { cwd, refPrefix: 'refs/cms' });
    
    const pubTip = readTipMessage(slug, 'published', { cwd, refPrefix: 'refs/cms' });
    expect(pubTip.sha).toBe(sha);
  });
});
