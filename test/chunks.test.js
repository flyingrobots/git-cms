import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { chunkFileToRef, decryptBuffer, readManifest } from '../src/lib/chunks.js';
import { randomBytes } from 'node:crypto';

function run(args, cwd) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

describe('Git Chunks', () => {
  let cwd;

  beforeEach(() => {
    cwd = mkdtempSync(path.join(os.tmpdir(), 'git-cms-chunks-'));
    run(['init'], cwd);
    run(['config', 'user.name', 'Test'], cwd);
    run(['config', 'user.email', 'test@example.com'], cwd);
  });

  afterEach(() => {
    rmSync(cwd, { recursive: true, force: true });
  });

  it('chunks a file without encryption', async () => {
    // Ensure no key
    delete process.env.CHUNK_ENC_KEY;
    
    const filePath = path.join(cwd, 'test.txt');
    writeFileSync(filePath, 'Hello World '.repeat(1000)); // ~12KB
    
    const res = await chunkFileToRef({ filePath, slug: 'test', cwd });
    
    expect(res.ref).toBe('refs/_blog/chunks/test@current');
    
    // Check manifest
    const { manifest } = readManifest('test', { cwd });
    expect(manifest.filename).toBe('test.txt');
    expect(manifest.chunks.length).toBeGreaterThan(0);
    expect(manifest.encryption).toBeUndefined();
  });

  it('chunks and encrypts with key', async () => {
    // Set a random key
    const key = randomBytes(32).toString('base64');
    process.env.CHUNK_ENC_KEY = key;
    
    const filePath = path.join(cwd, 'secret.txt');
    const secretData = 'Top Secret Data';
    writeFileSync(filePath, secretData);
    
    const res = await chunkFileToRef({ filePath, slug: 'secret', cwd });
    
    const { manifest } = readManifest('secret', { cwd });
    expect(manifest.encryption).toBeDefined();
    expect(manifest.encryption.encrypted).toBe(true);
    
    // Verify blobs are encrypted (not plain text)
    const blobOid = manifest.chunks[0].blob;
    const blobContent = execFileSync('git', ['cat-file', '-p', blobOid], { cwd, encoding: null }); // Buffer
    expect(blobContent.toString()).not.toContain('Top Secret');
    
    // Decrypt manually
    const decrypted = decryptBuffer(blobContent, manifest.encryption);
    expect(decrypted.toString()).toBe(secretData);
  });
});
