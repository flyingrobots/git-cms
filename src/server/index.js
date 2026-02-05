import http from 'node:http';
import url from 'node:url';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import CmsService from '../lib/CmsService.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const PORT = process.env.PORT || 4638;
const CWD = process.env.GIT_CMS_REPO || process.cwd();
const ENV = (process.env.GIT_CMS_ENV || 'dev').toLowerCase();
const REF_PREFIX = process.env.CMS_REF_PREFIX || `refs/_blog/${ENV}`;
const PUBLIC_DIR = path.resolve(__dirname, '../../public');

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
  let relativePath = req.url === '/' ? 'index.html' : req.url.split('?')[0];
  const filePath = path.join(PUBLIC_DIR, relativePath);

  // Security: Prevent path traversal
  if (!filePath.startsWith(PUBLIC_DIR)) {
    return false;
  }

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    return false;
  }

  const ext = path.extname(filePath).toLowerCase();
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
    'Access-Control-Allow-Origin': '*', // In prod, replace with config
    'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(body);
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
        const kind = query.kind || 'articles';
        return send(res, 200, await cms.listArticles({ kind }));
      }

      // GET /api/cms/show?slug=xxx&kind=articles
      if (req.method === 'GET' && pathname === '/api/cms/show') {
        const { slug, kind } = query;
        if (!slug) return send(res, 400, { error: 'slug required' });
        return send(res, 200, await cms.readArticle({ slug, kind: kind || 'articles' }));
      }

      // POST /api/cms/snapshot
      if (req.method === 'POST' && pathname === '/api/cms/snapshot') {
        let body = '';
        req.on('data', (c) => (body += c));
        req.on('end', async () => {
          try {
            const { slug, title, body: content, trailers } = JSON.parse(body || '{}');
            if (!slug || !title) return send(res, 400, { error: 'slug and title required' });
            const result = await cms.saveSnapshot({ slug, title, body: content, trailers });
            return send(res, 200, result);
          } catch (err) {
            console.error(err);
            return send(res, 500, { error: err.message });
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
            const { slug, sha } = JSON.parse(body || '{}');
            if (!slug) return send(res, 400, { error: 'slug required' });
            const result = await cms.publishArticle({ slug, sha });
            return send(res, 200, result);
          } catch (err) {
            console.error(err);
            return send(res, 500, { error: err.message });
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
            const { slug, filename, data } = JSON.parse(body || '{}');
            if (!slug || !filename || !data) return send(res, 400, { error: 'slug, filename, data required' });
            
            const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cms-upload-'));
            const filePath = path.join(tmpDir, filename);
            fs.writeFileSync(filePath, Buffer.from(data, 'base64'));
            
            const result = await cms.uploadAsset({ slug, filePath, filename });
            const assetUrl = `/blog/${ENV}/assets/${slug}/${result.manifest.chunks[0].digest}`;
            
            fs.rmSync(tmpDir, { recursive: true, force: true });
            return send(res, 200, { ...result, assetUrl });
          } catch (err) {
            console.error(err);
            return send(res, 500, { error: err.message });
          }
        });
        return;
      }

      return send(res, 404, { error: 'API endpoint not found' });
    }

    if (serveStatic(req, res)) return;
    send(res, 404, { error: 'Not found' });
  } catch (err) {
    console.error(err);
    send(res, 500, { error: err.message });
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