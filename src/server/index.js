import http from 'node:http';
import url from 'node:url';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import CmsService from '../lib/CmsService.js';
import {
  CmsValidationError,
  canonicalizeKind,
  canonicalizeSlug,
} from '../lib/ContentIdentityPolicy.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const PORT = process.env.PORT || 4638;
const CWD = process.env.GIT_CMS_REPO || process.cwd();
const ENV = (process.env.GIT_CMS_ENV || 'dev').toLowerCase();
const REF_PREFIX = process.env.CMS_REF_PREFIX || `refs/_blog/${ENV}`;
const PUBLIC_DIR = path.resolve(__dirname, '../../public');
const PUBLIC_DIR_REAL = fs.realpathSync(PUBLIC_DIR);

// Initialize the core service
const cms = new CmsService({ cwd: CWD, refPrefix: REF_PREFIX });

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
  const requestedPath = req.url === '/' ? '/index.html' : req.url.split('?')[0];
  const relativePath = requestedPath.replace(/^\/+/, '');
  const filePath = path.resolve(PUBLIC_DIR_REAL, relativePath);

  // Security: Prevent path traversal
  if (filePath !== PUBLIC_DIR_REAL && !filePath.startsWith(`${PUBLIC_DIR_REAL}${path.sep}`)) {
    return false;
  }

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    return false;
  }

  let realFilePath;
  try {
    realFilePath = fs.realpathSync(filePath);
  } catch {
    return false;
  }

  // Security: Prevent symlink escapes outside the static root
  if (realFilePath !== PUBLIC_DIR_REAL && !realFilePath.startsWith(`${PUBLIC_DIR_REAL}${path.sep}`)) {
    return false;
  }

  const ext = path.extname(realFilePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': contentType });
  fs.createReadStream(realFilePath).pipe(res);
  return true;
}

function send(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
    'Access-Control-Allow-Origin': '*', // In prod, replace with config
    'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(body);
}

function sendError(res, err) {
  if (err instanceof CmsValidationError) {
    return send(res, 400, {
      error: err.message,
      code: err.code,
      field: err.field,
    });
  }
  return send(res, 500, { error: err.message });
}

function logError(err) {
  if (!(err instanceof CmsValidationError)) {
    console.error(err);
  }
}

async function handler(req, res) {
  const parsed = url.parse(req.url, true);
  const { pathname, query } = parsed;

  console.log(`[${new Date().toISOString()}] ${req.method} ${pathname}`);

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    return res.end();
  }

  try {
    if (pathname.startsWith('/api/cms')) {
      // GET /api/cms/list?kind=articles|published|comments
      if (req.method === 'GET' && pathname === '/api/cms/list') {
        const kind = canonicalizeKind(query.kind || 'articles');
        return send(res, 200, await cms.listArticles({ kind }));
      }

      // GET /api/cms/show?slug=xxx&kind=articles
      if (req.method === 'GET' && pathname === '/api/cms/show') {
        const { slug: rawSlug, kind } = query;
        if (!rawSlug) return send(res, 400, { error: 'slug required' });
        const slug = canonicalizeSlug(rawSlug);
        const canonicalKind = canonicalizeKind(kind || 'articles');
        return send(res, 200, await cms.readArticle({ slug, kind: canonicalKind }));
      }

      // POST /api/cms/snapshot
      if (req.method === 'POST' && pathname === '/api/cms/snapshot') {
        let body = '';
        req.on('data', (c) => (body += c));
        req.on('end', async () => {
          try {
            const { slug: rawSlug, title, body: content, trailers } = JSON.parse(body || '{}');
            if (!rawSlug || !title) return send(res, 400, { error: 'slug and title required' });
            const slug = canonicalizeSlug(rawSlug);
            const result = await cms.saveSnapshot({ slug, title, body: content, trailers });
            return send(res, 200, result);
          } catch (err) {
            logError(err);
            return sendError(res, err);
          }
        });
        return;
      }

      // POST /api/cms/publish
      if (req.method === 'POST' && pathname === '/api/cms/publish') {
        let body = '';
        req.on('data', (c) => (body += c));
        req.on('end', async () => {
          try {
            const { slug: rawSlug, sha } = JSON.parse(body || '{}');
            if (!rawSlug) return send(res, 400, { error: 'slug required' });
            const slug = canonicalizeSlug(rawSlug);
            const result = await cms.publishArticle({ slug, sha });
            return send(res, 200, result);
          } catch (err) {
            logError(err);
            return sendError(res, err);
          }
        });
        return;
      }

      // POST /api/cms/unpublish
      if (req.method === 'POST' && pathname === '/api/cms/unpublish') {
        let body = '';
        req.on('data', (c) => (body += c));
        req.on('end', async () => {
          try {
            const { slug: rawSlug } = JSON.parse(body || '{}');
            if (!rawSlug) return send(res, 400, { error: 'slug required' });
            const slug = canonicalizeSlug(rawSlug);
            const result = await cms.unpublishArticle({ slug });
            return send(res, 200, result);
          } catch (err) {
            logError(err);
            return sendError(res, err);
          }
        });
        return;
      }

      // POST /api/cms/revert
      if (req.method === 'POST' && pathname === '/api/cms/revert') {
        let body = '';
        req.on('data', (c) => (body += c));
        req.on('end', async () => {
          try {
            const { slug: rawSlug } = JSON.parse(body || '{}');
            if (!rawSlug) return send(res, 400, { error: 'slug required' });
            const slug = canonicalizeSlug(rawSlug);
            const result = await cms.revertArticle({ slug });
            return send(res, 200, result);
          } catch (err) {
            logError(err);
            return sendError(res, err);
          }
        });
        return;
      }

      // POST /api/cms/upload
      if (req.method === 'POST' && pathname === '/api/cms/upload') {
        let body = '';
        req.on('data', (c) => (body += c));
        req.on('end', async () => {
          try {
            const { slug: rawSlug, filename, data } = JSON.parse(body || '{}');
            if (!rawSlug || !filename || !data) return send(res, 400, { error: 'slug, filename, data required' });
            const slug = canonicalizeSlug(rawSlug);
            
            const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cms-upload-'));
            const filePath = path.join(tmpDir, filename);
            fs.writeFileSync(filePath, Buffer.from(data, 'base64'));
            
            const result = await cms.uploadAsset({ slug, filePath, filename });
            const firstChunk = result.manifest?.chunks?.[0];
            if (!firstChunk?.digest) {
              throw new Error('Upload manifest contains no chunks');
            }
            const assetUrl = `/blog/${ENV}/assets/${slug}/${firstChunk.digest}`;
            
            fs.rmSync(tmpDir, { recursive: true, force: true });
            return send(res, 200, { ...result, assetUrl });
          } catch (err) {
            logError(err);
            return sendError(res, err);
          }
        });
        return;
      }

      return send(res, 404, { error: 'API endpoint not found' });
    }

    if (serveStatic(req, res)) return;
    send(res, 404, { error: 'Not found' });
  } catch (err) {
    logError(err);
    sendError(res, err);
  }
}

export function startServer() {
  const server = http.createServer(handler);
  server.listen(PORT, () => {
    const addr = server.address();
    const actualPort = typeof addr === 'string' ? addr : addr.port;
    console.log(`[git-cms] listening on http://localhost:${actualPort}`);
    console.log(`[git-cms] Admin UI: http://localhost:${actualPort}/`);
  });
  return server;
}
