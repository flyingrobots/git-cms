import http from 'node:http';
import url from 'node:url';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { listRefs, readTipMessage, history, writeSnapshot, fastForwardPublished, deleteRef, diffMessages, writeComment, listComments } from '../lib/git.js';
import { parseArticleCommit } from '../lib/parse.js';
import { chunkFileToRef } from '../lib/chunks.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const PORT = process.env.PORT || 4638;
const CWD = process.env.GIT_CMS_REPO || process.cwd();
const ENV = (process.env.GIT_CMS_ENV || 'dev').toLowerCase();
const REF_PREFIX = process.env.CMS_REF_PREFIX || `refs/_blog/${ENV}`;
const PUBLIC_DIR = path.resolve(__dirname, '../../public');

// Minimal static file server helper
const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
};

function serveStatic(req, res) {
  let filePath = path.join(PUBLIC_DIR, req.url === '/' ? 'index.html' : req.url);
  const ext = path.extname(filePath).toLowerCase();
  
  if (!fs.existsSync(filePath)) {
    return false;
  }

  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': contentType });
  fs.createReadStream(filePath).pipe(res);
  return true;
}

function send(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(body);
}

async function handler(req, res) {
  const parsed = url.parse(req.url, true);
  const { pathname, query } = parsed;

  console.log(`${req.method} ${pathname}`);

  // CORS Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    return res.end();
  }

  // API Routes
  try {
    if (pathname.startsWith('/api/cms')) {
      if (req.method === 'GET' && pathname === '/api/cms/list') {
        const kind = query.kind || 'draft';
        return send(res, 200, listRefs(kind, { cwd: CWD, refPrefix: REF_PREFIX }));
      }

      if (req.method === 'GET' && pathname === '/api/cms/show') {
        const slug = query.slug;
        const kind = query.kind || 'draft';
        if (!slug) return send(res, 400, { error: 'slug required' });
        const { sha, message } = readTipMessage(slug, kind, { cwd: CWD, refPrefix: REF_PREFIX });
        const parsedMsg = parseArticleCommit(message);
        return send(res, 200, { sha, ...parsedMsg });
      }

      if (req.method === 'GET' && pathname === '/api/cms/history') {
        const slug = query.slug;
        const limit = Number(query.limit || 20);
        if (!slug) return send(res, 400, { error: 'slug required' });
        const entries = history(slug, { cwd: CWD, limit, refPrefix: REF_PREFIX });
        return send(res, 200, entries);
      }

      if (req.method === 'POST' && pathname === '/api/cms/snapshot') {
        let body = '';
        req.on('data', (c) => (body += c));
        req.on('end', () => {
          const { slug, message, sign } = JSON.parse(body || '{}');
          if (!slug || !message) return send(res, 400, { error: 'slug and message required' });
          if (sign) process.env.CMS_SIGN = '1';
          const result = writeSnapshot({ slug, message, cwd: CWD, refPrefix: REF_PREFIX });
          return send(res, 200, result);
        });
        return;
      }

      if (req.method === 'POST' && pathname === '/api/cms/publish') {
        let body = '';
        req.on('data', (c) => (body += c));
        req.on('end', () => {
          const { slug, sha } = JSON.parse(body || '{}');
          if (!slug) return send(res, 400, { error: 'slug required' });
          const result = fastForwardPublished(slug, sha || readTipMessage(slug, 'draft', { cwd: CWD, refPrefix: REF_PREFIX }).sha, { cwd: CWD, refPrefix: REF_PREFIX });
          return send(res, 200, result);
        });
        return;
      }

      if (req.method === 'POST' && pathname === '/api/cms/upload') {
        let body = '';
        req.on('data', (c) => (body += c));
        req.on('end', async () => {
          try {
            const { slug, filename, data } = JSON.parse(body || '{}');
            if (!slug || !filename || !data) return send(res, 400, { error: 'slug, filename, data required' });
            // In a real app we'd stream this, but for the stunt we assume valid base64 payload
            const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cms-upload-'));
            const filePath = path.join(tmpDir, filename);
            fs.writeFileSync(filePath, Buffer.from(data, 'base64'));
            const result = await chunkFileToRef({ filePath, slug, epoch: 'current', cwd: CWD, filename });
            // We return a "virtual" asset URL that the extractor would handle
            const assetUrl = `/blog/${ENV}/assets/${slug}/${result.firstDigest}`;
            fs.rmSync(tmpDir, { recursive: true, force: true });
            return send(res, 200, { ...result, assetUrl });
          } catch (err) {
            console.error(err);
            return send(res, 500, { error: err.message });
          }
        });
        return;
      }

      send(res, 404, { error: 'API endpoint not found' });
      return;
    }

    // Static Files
    if (serveStatic(req, res)) {
      return;
    }

    send(res, 404, { error: 'Not found' });

  } catch (err) {
    console.error(err);
    send(res, 500, { error: err.message });
  }
}

export function startServer() {
  const server = http.createServer(handler);
  server.listen(PORT, () => {
    console.log(`[git-cms] listening on http://localhost:${PORT}`);
    console.log(`[git-cms] Admin UI: http://localhost:${PORT}/`);
  });
}