// chunks.js
// Minimal git-native chunk writer for assets. Inspired by git-kv chunk layout.
// Uses fixed-size chunking (256 KiB) for simplicity; swap with FastCDC later if needed.

import { createHash, createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { createReadStream, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { resolveSecret } from './secrets.js';

const CHUNK_SIZE = 256 * 1024; // 256 KiB
const EMPTY_TREE = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';
const ENV = (process.env.GIT_CMS_ENV || 'prod').toLowerCase();
const ENC_KEY_RAW = resolveSecret('CHUNK_ENC_KEY', ENV, 'enc-key');
const ENC_KEY = ENC_KEY_RAW ? Buffer.from(ENC_KEY_RAW, 'base64') : null;

function runGit(args, { cwd = process.cwd(), input } = {}) {
  return execFileSync('git', args, {
    cwd,
    input,
    encoding: 'utf8',
    stdio: input ? ['pipe', 'pipe', 'pipe'] : ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function sha256(buf) {
  return createHash('sha256').update(buf).digest('hex');
}

function encryptBuffer(buf) {
  if (!ENC_KEY) return { buf, meta: null };
  const nonce = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', ENC_KEY, nonce);
  const enc = Buffer.concat([cipher.update(buf), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { buf: enc, meta: { algorithm: 'aes-256-gcm', nonce: nonce.toString('base64'), tag: tag.toString('base64'), encrypted: true } };
}

export function decryptBuffer(buf, meta) {
  if (!meta?.encrypted) return buf;
  if (!ENC_KEY) throw new Error('Cannot decrypt chunk: No key found in Keychain/Environment');
  const nonce = Buffer.from(meta.nonce, 'base64');
  const tag = Buffer.from(meta.tag, 'base64');
  const decipher = createDecipheriv('aes-256-gcm', ENC_KEY, nonce);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(buf), decipher.final()]);
}

// Returns { manifestOid, commitSha, ref }
export async function chunkFileToRef({ filePath, slug, epoch = 'current', cwd, filename }) {
  const ref = `refs/_blog/chunks/${slug}@${epoch}`;
  const tmpDir = mkdtempSync(path.join(os.tmpdir(), 'cms-chunks-'));
  try {
    const baseName = filename || path.basename(filePath);
    const manifest = { slug, epoch, filename: baseName, chunks: [], size: 0 };

    // If encrypting, read whole file to buffer, encrypt, then chunk ciphertext
    let sourceBuf = null;
    if (ENC_KEY) {
      sourceBuf = readFileSync(filePath);
      const { buf, meta } = encryptBuffer(sourceBuf);
      manifest.encryption = meta;
      // chunk the encrypted buffer
      let index = 0;
      for (let i = 0; i < buf.length; i += CHUNK_SIZE) {
        const chunk = buf.slice(i, i + CHUNK_SIZE);
        const digest = sha256(chunk);
        const blobOid = runGit(['hash-object', '-w', '--stdin'], { cwd, input: chunk });
        manifest.chunks.push({ index, size: chunk.length, digest, blob: blobOid });
        manifest.size += chunk.length;
        index += 1;
      }
    } else {
      const fd = createReadStream(filePath, { highWaterMark: CHUNK_SIZE });
      let index = 0;
      for await (const chunk of fd) {
        const digest = sha256(chunk);
        const blobOid = runGit(['hash-object', '-w', '--stdin'], { cwd, input: chunk });
        manifest.chunks.push({ index, size: chunk.length, digest, blob: blobOid });
        manifest.size += chunk.length;
        index += 1;
      }
    }
    const manifestJson = JSON.stringify(manifest, null, 2);
    const manifestOid = runGit(['hash-object', '-w', '--stdin'], { cwd, input: manifestJson });

    // Build a flat tree (git mktree does not permit implicit subdirs)
    const treeEntries = [
      `100644 blob ${manifestOid}\tmanifest.json`,
      ...manifest.chunks.map((c) => `100644 blob ${c.blob}\t${c.digest}`),
    ];
    const treeSpec = treeEntries.join('\n') + '\n';
    const treeOid = runGit(['mktree'], { cwd, input: treeSpec });

    let parentSha = null;
    try {
      parentSha = runGit(['rev-parse', ref], { cwd });
    } catch {
      parentSha = null;
    }
    const commitArgs = ['commit-tree', treeOid];
    if (process.env.CMS_SIGN === '1' || process.env.CHUNK_SIGN === '1') {
      commitArgs.push('-S');
    }
    if (parentSha) commitArgs.push('-p', parentSha);
    commitArgs.push('-m', `chunk:${slug}@${epoch}\n\nmanifest: ${manifestOid}`);
    const commitSha = runGit(commitArgs, { cwd });
    if (parentSha) {
      runGit(['update-ref', ref, commitSha, parentSha], { cwd });
    } else {
      runGit(['update-ref', ref, commitSha], { cwd });
    }
    const firstDigest = manifest.chunks[0]?.digest;
    return { ref, commitSha, manifestOid, treeOid, parent: parentSha, manifest, firstDigest };
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

export function readManifestOid(slug, { epoch = 'current', cwd } = {}) {
  const ref = `refs/_blog/chunks/${slug}@${epoch}`;
  const tree = runGit(['rev-parse', `${ref}^{tree}`], { cwd });
  const out = runGit(['ls-tree', tree], { cwd });
  const line = out.split('\n').find((l) => l.endsWith('\tmanifest.json'));
  if (!line) throw new Error('manifest not found');
  return line.split(' ')[2].split('\t')[0];
}

export function readManifest(slug, opts = {}) {
  const oid = readManifestOid(slug, opts);
  const json = runGit(['cat-file', '-p', oid], opts);
  return { oid, manifest: JSON.parse(json) };
}
