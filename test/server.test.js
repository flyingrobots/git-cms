import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';

describe('Server API (Integration)', () => {
  let cwd;
  let server;
  let baseUrl;
  let startServer;
  let leakedFilePath;
  let symlinkPath;
  let previousRepoEnv;
  let previousPortEnv;
  let previousAuthorNameEnv;
  let previousAuthorEmailEnv;
  let previousCommitterNameEnv;
  let previousCommitterEmailEnv;

  beforeAll(async () => {
    cwd = mkdtempSync(path.join(os.tmpdir(), 'git-cms-server-api-test-'));
    execFileSync('git', ['init'], { cwd });
    execFileSync('git', ['config', 'user.name', 'Test'], { cwd });
    execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd });

    previousRepoEnv = process.env.GIT_CMS_REPO;
    previousPortEnv = process.env.PORT;
    previousAuthorNameEnv = process.env.GIT_AUTHOR_NAME;
    previousAuthorEmailEnv = process.env.GIT_AUTHOR_EMAIL;
    previousCommitterNameEnv = process.env.GIT_COMMITTER_NAME;
    previousCommitterEmailEnv = process.env.GIT_COMMITTER_EMAIL;
    process.env.GIT_CMS_REPO = cwd;
    process.env.PORT = '0';
    process.env.GIT_AUTHOR_NAME = 'Test';
    process.env.GIT_AUTHOR_EMAIL = 'test@example.com';
    process.env.GIT_COMMITTER_NAME = 'Test';
    process.env.GIT_COMMITTER_EMAIL = 'test@example.com';

    ({ startServer } = await import('../src/server/index.js'));
    
    server = startServer();
    
    await new Promise((resolve) => {
      if (server.listening) resolve();
      else server.once('listening', resolve);
    });
    
    const port = server.address().port;
    baseUrl = `http://localhost:${port}`;

    const publicDir = path.resolve(process.cwd(), 'public');
    leakedFilePath = path.join(os.tmpdir(), `git-cms-secret-${Date.now()}.txt`);
    symlinkPath = path.join(publicDir, '_test-secret-link.txt');
    writeFileSync(leakedFilePath, 'TOP_SECRET_CONTENT');
    try {
      unlinkSync(symlinkPath);
    } catch {}
    symlinkSync(leakedFilePath, symlinkPath);
  });

  afterAll(async () => {
    if (server) {
      await new Promise(resolve => server.close(resolve));
    }
    try {
      unlinkSync(symlinkPath);
    } catch {}
    if (leakedFilePath) {
      rmSync(leakedFilePath, { force: true });
    }
    if (previousRepoEnv === undefined) {
      delete process.env.GIT_CMS_REPO;
    } else {
      process.env.GIT_CMS_REPO = previousRepoEnv;
    }
    if (previousPortEnv === undefined) {
      delete process.env.PORT;
    } else {
      process.env.PORT = previousPortEnv;
    }
    if (previousAuthorNameEnv === undefined) {
      delete process.env.GIT_AUTHOR_NAME;
    } else {
      process.env.GIT_AUTHOR_NAME = previousAuthorNameEnv;
    }
    if (previousAuthorEmailEnv === undefined) {
      delete process.env.GIT_AUTHOR_EMAIL;
    } else {
      process.env.GIT_AUTHOR_EMAIL = previousAuthorEmailEnv;
    }
    if (previousCommitterNameEnv === undefined) {
      delete process.env.GIT_COMMITTER_NAME;
    } else {
      process.env.GIT_COMMITTER_NAME = previousCommitterNameEnv;
    }
    if (previousCommitterEmailEnv === undefined) {
      delete process.env.GIT_COMMITTER_EMAIL;
    } else {
      process.env.GIT_COMMITTER_EMAIL = previousCommitterEmailEnv;
    }
    rmSync(cwd, { recursive: true, force: true });
  });

  it('lists articles', async () => {
    const res = await fetch(`${baseUrl}/api/cms/list`);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
  });

  it('creates a snapshot via POST', async () => {
    const res = await fetch(`${baseUrl}/api/cms/snapshot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        slug: 'api-test', 
        title: 'API Title', 
        body: 'API Body' 
      })
    });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.sha).toBeDefined();
  });

  it('rejects invalid slugs with 400', async () => {
    const res = await fetch(`${baseUrl}/api/cms/snapshot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slug: 'bad slug',
        title: 'Nope',
        body: 'Body',
      }),
    });
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.code).toBe('slug_invalid_format');
    expect(data.field).toBe('slug');
  });

  it('canonicalizes mixed-case slugs across API ingress', async () => {
    const createRes = await fetch(`${baseUrl}/api/cms/snapshot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slug: 'Api-Mixed',
        title: 'API Canonical',
        body: 'Body',
      }),
    });
    expect(createRes.status).toBe(200);

    const readRes = await fetch(`${baseUrl}/api/cms/show?slug=api-mixed`);
    const article = await readRes.json();
    expect(readRes.status).toBe(200);
    expect(article.title).toBe('API Canonical');
    expect(article.trailers.contentid).toBe('api-mixed');
  });

  it('does not serve symlinked files outside public directory', async () => {
    const res = await fetch(`${baseUrl}/_test-secret-link.txt`);
    expect(res.status).toBe(404);
  });

  it('unpublishes an article via POST /api/cms/unpublish', async () => {
    // Create and publish first
    await fetch(`${baseUrl}/api/cms/snapshot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: 'srv-unpub', title: 'T', body: 'B' }),
    });
    await fetch(`${baseUrl}/api/cms/publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: 'srv-unpub' }),
    });

    const res = await fetch(`${baseUrl}/api/cms/unpublish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: 'srv-unpub' }),
    });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.sha).toBeDefined();
  });

  it('reverts an article via POST /api/cms/revert', async () => {
    // Create two versions so there is a parent
    await fetch(`${baseUrl}/api/cms/snapshot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: 'srv-revert', title: 'v1', body: 'b1' }),
    });
    await fetch(`${baseUrl}/api/cms/snapshot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: 'srv-revert', title: 'v2', body: 'b2' }),
    });

    const res = await fetch(`${baseUrl}/api/cms/revert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: 'srv-revert' }),
    });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.sha).toBeDefined();
  });

  it('returns 400 with invalid_state_transition for bad transitions', async () => {
    // Create a draft, then try to unpublish it (invalid: draft → unpublished)
    await fetch(`${baseUrl}/api/cms/snapshot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: 'srv-bad-trans', title: 'T', body: 'B' }),
    });

    const res = await fetch(`${baseUrl}/api/cms/unpublish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: 'srv-bad-trans' }),
    });
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.code).toBe('invalid_state_transition');
  });
});
