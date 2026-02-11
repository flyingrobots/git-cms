import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { startServer } from '../src/server/index.js';

describe('Server API (Integration)', () => {
  let cwd;
  let server;
  let baseUrl;

  beforeAll(async () => {
    cwd = mkdtempSync(path.join(os.tmpdir(), 'git-cms-server-api-test-'));
    execFileSync('git', ['init'], { cwd });
    execFileSync('git', ['config', 'user.name', 'Test'], { cwd });
    execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd });

    process.env.GIT_CMS_REPO = cwd;
    process.env.PORT = '0'; 
    
    server = startServer();
    
    await new Promise((resolve) => {
      if (server.listening) resolve();
      else server.once('listening', resolve);
    });
    
    const port = server.address().port;
    baseUrl = `http://localhost:${port}`;
  });

  afterAll(async () => {
    if (server) {
      await new Promise(resolve => server.close(resolve));
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
});
