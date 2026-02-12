import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import CmsService from '../src/lib/CmsService.js';
import { randomBytes } from 'node:crypto';

describe('CmsService Assets (Integration)', () => {
  let cwd;
  let cms;
  const refPrefix = 'refs/cms';

  beforeEach(() => {
    cwd = mkdtempSync(path.join(os.tmpdir(), 'git-cms-assets-test-'));
    execFileSync('git', ['init'], { cwd });
    execFileSync('git', ['config', 'user.name', 'Test'], { cwd });
    execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd });
    cms = new CmsService({ cwd, refPrefix });
  });

  afterEach(() => {
    delete process.env.CHUNK_ENC_KEY;
    rmSync(cwd, { recursive: true, force: true });
  });

  it('uploads a file and creates a manifest ref', async () => {
    const filePath = path.join(cwd, 'test.png');
    writeFileSync(filePath, 'fake-binary-data'.repeat(100));
    
    const result = await cms.uploadAsset({ 
      slug: 'test-image', 
      filePath, 
      filename: 'test.png' 
    });
    
    expect(result.commitSha).toHaveLength(40);
    expect(result.manifest.chunks.length).toBeGreaterThan(0);
    
    // Verify ref exists
    const resolved = execFileSync('git', ['rev-parse', `${refPrefix}/chunks/test-image@current`], { cwd, encoding: 'utf8' }).trim();
    expect(resolved).toBe(result.commitSha);
  });

  it('handles encrypted uploads', async () => {
    const key = randomBytes(32).toString('base64');
    process.env.CHUNK_ENC_KEY = key;
    
    const filePath = path.join(cwd, 'secret.txt');
    writeFileSync(filePath, 'Top Secret Content');
    
    const result = await cms.uploadAsset({ 
      slug: 'secret', 
      filePath 
    });
    
    expect(result.manifest.encryption.encrypted).toBe(true);
    
    // Check if git blob is encrypted
    const blobOid = result.manifest.chunks[0].blob;
    const blobContent = execFileSync('git', ['cat-file', '-p', blobOid], { cwd, encoding: 'utf8' });
    expect(blobContent).not.toContain('Top Secret');
    
  });
});
