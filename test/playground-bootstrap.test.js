import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import CmsService from '../src/lib/CmsService.js';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const prepareScript = fileURLToPath(new URL('../scripts/prepare-playground.sh', import.meta.url));
const cliEntrypoint = fileURLToPath(new URL('../bin/git-cms.js', import.meta.url));
const refPrefix = 'refs/_blog/dev';

function run(cmd, args, options = {}) {
  return execFileSync(cmd, args, {
    encoding: 'utf8',
    ...options,
  });
}

describe('playground bootstrap', () => {
  let repoDir;
  let callerDir;

  beforeEach(() => {
    repoDir = mkdtempSync(path.join(os.tmpdir(), 'git-cms-playground-repo-'));
    callerDir = mkdtempSync(path.join(os.tmpdir(), 'git-cms-playground-caller-'));
  });

  afterEach(() => {
    rmSync(repoDir, { recursive: true, force: true });
    rmSync(callerDir, { recursive: true, force: true });
  });

  it('creates a repo and seeds a published/article history split', async () => {
    run('bash', [prepareScript, repoDir], {
      cwd: repoRoot,
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: 'Playground Bot',
        GIT_AUTHOR_EMAIL: 'playground@example.com',
        GIT_COMMITTER_NAME: 'Playground Bot',
        GIT_COMMITTER_EMAIL: 'playground@example.com',
      },
    });

    expect(run('git', ['rev-parse', '--git-dir'], { cwd: repoDir }).trim()).toBe('.git');

    const draftSha = run('git', ['rev-parse', `${refPrefix}/articles/hello-world`], { cwd: repoDir }).trim();
    const publishedSha = run('git', ['rev-parse', `${refPrefix}/published/hello-world`], { cwd: repoDir }).trim();
    expect(draftSha).toHaveLength(40);
    expect(publishedSha).toHaveLength(40);
    expect(draftSha).not.toBe(publishedSha);

    const cms = new CmsService({ cwd: repoDir, refPrefix });
    const draft = await cms.readArticle({ slug: 'hello-world' });
    const published = await cms.readArticle({ slug: 'hello-world', kind: 'published' });
    const history = await cms.getArticleHistory({ slug: 'hello-world', limit: 10 });

    expect(draft.title).toBe('Hello World (Draft)');
    expect(published.title).toBe('Hello World');
    expect(history).toHaveLength(3);
    expect(history.map((entry) => entry.title)).toEqual([
      'Hello World (Draft)',
      'Hello World (Edited)',
      'Hello World',
    ]);
  }, 30000);

  it('is idempotent once seeded', () => {
    const env = {
      ...process.env,
      GIT_AUTHOR_NAME: 'Playground Bot',
      GIT_AUTHOR_EMAIL: 'playground@example.com',
      GIT_COMMITTER_NAME: 'Playground Bot',
      GIT_COMMITTER_EMAIL: 'playground@example.com',
    };

    run('bash', [prepareScript, repoDir], { cwd: repoRoot, env });

    const beforeDraft = run('git', ['rev-parse', `${refPrefix}/articles/hello-world`], { cwd: repoDir }).trim();
    const beforePublished = run('git', ['rev-parse', `${refPrefix}/published/hello-world`], { cwd: repoDir }).trim();

    run('bash', [prepareScript, repoDir], { cwd: repoRoot, env });

    const afterDraft = run('git', ['rev-parse', `${refPrefix}/articles/hello-world`], { cwd: repoDir }).trim();
    const afterPublished = run('git', ['rev-parse', `${refPrefix}/published/hello-world`], { cwd: repoDir }).trim();

    expect(afterDraft).toBe(beforeDraft);
    expect(afterPublished).toBe(beforePublished);
  }, 30000);

  it('repairs incomplete seeded state instead of silently accepting it', async () => {
    run('bash', [prepareScript, repoDir], {
      cwd: repoRoot,
      env: {
        ...process.env,
        GIT_CMS_SKIP_SEED: '1',
        GIT_AUTHOR_NAME: 'Playground Bot',
        GIT_AUTHOR_EMAIL: 'playground@example.com',
        GIT_COMMITTER_NAME: 'Playground Bot',
        GIT_COMMITTER_EMAIL: 'playground@example.com',
      },
    });

    run('node', [cliEntrypoint, 'draft', 'hello-world', 'Partial Seed'], {
      cwd: callerDir,
      env: {
        ...process.env,
        GIT_CMS_REPO: repoDir,
        CMS_REF_PREFIX: refPrefix,
        GIT_AUTHOR_NAME: 'Playground Bot',
        GIT_AUTHOR_EMAIL: 'playground@example.com',
        GIT_COMMITTER_NAME: 'Playground Bot',
        GIT_COMMITTER_EMAIL: 'playground@example.com',
      },
      input: '# Partial Seed\n',
    });

    run('bash', [prepareScript, repoDir], {
      cwd: repoRoot,
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: 'Playground Bot',
        GIT_AUTHOR_EMAIL: 'playground@example.com',
        GIT_COMMITTER_NAME: 'Playground Bot',
        GIT_COMMITTER_EMAIL: 'playground@example.com',
      },
    });

    const cms = new CmsService({ cwd: repoDir, refPrefix });
    const draft = await cms.readArticle({ slug: 'hello-world' });
    const published = await cms.readArticle({ slug: 'hello-world', kind: 'published' });
    const history = await cms.getArticleHistory({ slug: 'hello-world', limit: 10 });

    expect(draft.title).toBe('Hello World (Draft)');
    expect(published.title).toBe('Hello World');
    expect(history).toHaveLength(3);
  }, 30000);

  it('does not delete existing refs when seeding is explicitly skipped', () => {
    const skipSeedEnv = {
      ...process.env,
      GIT_CMS_SKIP_SEED: '1',
      GIT_AUTHOR_NAME: 'Playground Bot',
      GIT_AUTHOR_EMAIL: 'playground@example.com',
      GIT_COMMITTER_NAME: 'Playground Bot',
      GIT_COMMITTER_EMAIL: 'playground@example.com',
    };

    run('bash', [prepareScript, repoDir], {
      cwd: repoRoot,
      env: skipSeedEnv,
    });

    const draftOutput = run('node', [cliEntrypoint, 'draft', 'hello-world', 'Demo Draft'], {
      cwd: callerDir,
      env: {
        ...process.env,
        GIT_CMS_REPO: repoDir,
        CMS_REF_PREFIX: refPrefix,
        GIT_AUTHOR_NAME: 'Playground Bot',
        GIT_AUTHOR_EMAIL: 'playground@example.com',
        GIT_COMMITTER_NAME: 'Playground Bot',
        GIT_COMMITTER_EMAIL: 'playground@example.com',
      },
      input: '# Demo Draft\n',
    });
    const draftSha = draftOutput.match(/Saved draft: ([0-9a-f]+)/)?.[1];

    expect(draftSha).toBeTruthy();

    run('bash', [prepareScript, repoDir], {
      cwd: repoRoot,
      env: skipSeedEnv,
    });

    const afterDraft = run('git', ['rev-parse', `${refPrefix}/articles/hello-world`], { cwd: repoDir }).trim();
    expect(afterDraft).toBe(draftSha);
  }, 30000);

  it('cli honors GIT_CMS_REPO outside the current working directory', async () => {
    run('git', ['init'], { cwd: repoDir });
    run('git', ['config', 'user.name', 'CLI Test'], { cwd: repoDir });
    run('git', ['config', 'user.email', 'cli@example.com'], { cwd: repoDir });

    run('node', [cliEntrypoint, 'draft', 'env-cli', 'From Env'], {
      cwd: callerDir,
      env: {
        ...process.env,
        GIT_CMS_REPO: repoDir,
        CMS_REF_PREFIX: refPrefix,
        GIT_AUTHOR_NAME: 'CLI Test',
        GIT_AUTHOR_EMAIL: 'cli@example.com',
        GIT_COMMITTER_NAME: 'CLI Test',
        GIT_COMMITTER_EMAIL: 'cli@example.com',
      },
      input: '# From Env\n',
    });

    run('node', [cliEntrypoint, 'publish', 'env-cli'], {
      cwd: callerDir,
      env: {
        ...process.env,
        GIT_CMS_REPO: repoDir,
        CMS_REF_PREFIX: refPrefix,
        GIT_AUTHOR_NAME: 'CLI Test',
        GIT_AUTHOR_EMAIL: 'cli@example.com',
        GIT_COMMITTER_NAME: 'CLI Test',
        GIT_COMMITTER_EMAIL: 'cli@example.com',
      },
    });

    run('node', [cliEntrypoint, 'draft', 'env-cli', 'From Env v2'], {
      cwd: callerDir,
      env: {
        ...process.env,
        GIT_CMS_REPO: repoDir,
        CMS_REF_PREFIX: refPrefix,
        GIT_AUTHOR_NAME: 'CLI Test',
        GIT_AUTHOR_EMAIL: 'cli@example.com',
        GIT_COMMITTER_NAME: 'CLI Test',
        GIT_COMMITTER_EMAIL: 'cli@example.com',
      },
      input: '# From Env v2\n',
    });

    const cms = new CmsService({ cwd: repoDir, refPrefix });
    const draft = await cms.readArticle({ slug: 'env-cli' });
    const published = await cms.readArticle({ slug: 'env-cli', kind: 'published' });
    const history = await cms.getArticleHistory({ slug: 'env-cli', limit: 10 });

    expect(draft.title).toBe('From Env v2');
    expect(published.title).toBe('From Env');
    expect(history).toHaveLength(2);
  }, 30000);
});
