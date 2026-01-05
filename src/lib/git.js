// git.js
// Git helpers for storing articles as commit messages on dedicated refs.
// No external deps; uses git CLI. All operations are fast-forward only.

import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const EMPTY_TREE = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';

function runGit(args, { cwd = process.cwd(), input } = {}) {
  return execFileSync('git', args, {
    cwd,
    input,
    encoding: 'utf8',
    stdio: input ? ['pipe', 'pipe', 'pipe'] : ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function refFor(slug, kind = 'draft', refPrefix = 'refs/_blog') {
  const base = refPrefix.replace(///$/, '');
  if (kind === 'published') return `${base}/published/${slug}`;
  if (kind === 'comments') return `${base}/comments/${slug}`;
  return `${base}/articles/${slug}`;
}

export function readTip(slug, kind = 'draft', { cwd, refPrefix } = {}) {
  const ref = refFor(slug, kind, refPrefix);
  const sha = runGit(['rev-parse', ref], { cwd });
  const message = runGit(['show', '-s', '--format=%B', sha], { cwd });
  return { ref, sha, message };
}

export function history(slug, { cwd, limit = 20, refPrefix } = {}) {
  const ref = refFor(slug, 'draft', refPrefix);
  const format = ['%H', '%an', '%ad', '%B', '--END--'].join('%n');
  const out = runGit(['log', `-${limit}`, '--date=iso-strict', `--format=${format}`, ref], { cwd });
  const entries = [];
  const blocks = out.split('--END--\n').filter(Boolean);
  for (const block of blocks) {
    const [sha, author, date, ...msgLines] = block.split('\n');
    const message = msgLines.join('\n').replace(/\n?--END--\s*$/, '');
    entries.push({ sha, author, date, message });
  }
  return entries;
}

export function writeSnapshot({ slug, message, cwd, refPrefix }) {
  if (!slug) throw new Error('slug required');
  if (!message) throw new Error('message required');
  const ref = refFor(slug, 'draft', refPrefix);
  let parentSha = null;
  try {
    parentSha = runGit(['rev-parse', ref], { cwd });
  } catch {
    parentSha = null;
  }
  const args = ['commit-tree', EMPTY_TREE];
  if (parentSha) args.push('-p', parentSha);
  if (process.env.CMS_SIGN === '1') args.push('-S'); // sign with default key if configured
  args.push('-m', message);
  const newSha = runGit(args, { cwd });
  if (parentSha) {
    runGit(['update-ref', ref, newSha, parentSha], { cwd });
  } else {
    runGit(['update-ref', ref, newSha], { cwd });
  }
  return { ref, sha: newSha, parent: parentSha };
}

export function fastForwardPublished(slug, targetSha, { cwd, refPrefix }) {
  const pubRef = refFor(slug, 'published', refPrefix);
  let oldSha = null;
  try {
    oldSha = runGit(['rev-parse', pubRef], { cwd });
  } catch {
    oldSha = null;
  }
  if (oldSha) {
    runGit(['update-ref', pubRef, targetSha, oldSha], { cwd });
  } else {
    runGit(['update-ref', pubRef, targetSha], { cwd });
  }
  return { ref: pubRef, sha: targetSha, prev: oldSha };
}

export function diffMessages(leftSha, rightSha, { cwd, structured = false } = {}) {
  const tmp = mkdtempSync(path.join(os.tmpdir(), 'cmsdiff-'));
  try {
    const left = runGit(['show', '-s', '--format=%B', leftSha], { cwd });
    const right = runGit(['show', '-s', '--format=%B', rightSha], { cwd });
    const aPath = path.join(tmp, 'a.md');
    const bPath = path.join(tmp, 'b.md');
    writeFileSync(aPath, left, 'utf8');
    writeFileSync(bPath, right, 'utf8');
    const diff = runGit(['diff', '--no-index', '--unified=50', '--color=never', aPath, bPath], { cwd });
    if (!structured) return { diff };
    // simple hunk parser
    const hunks = [];
    const lines = diff.split('\n');
    let current = null;
    lines.forEach((line) => {
      if (line.startsWith('@@')) {
        const m = line.match(/@@ -(\d+),(\d+) \+(\d+),(\d+) @@/);
        if (m) {
          current = { header: line, oldStart: Number(m[1]), oldLines: Number(m[2]), newStart: Number(m[3]), newLines: Number(m[4]), lines: [] };
          hunks.push(current);
        }
      } else if (current) {
        current.lines.push(line);
      }
    });
    return { diff, hunks };
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

export function writeComment({ slug, message, parent, cwd }) {
  if (!slug) throw new Error('slug required');
  if (!message) throw new Error('message required');
  const ref = refFor(slug, 'comments');
  const trailers = parent ? `\nParent: ${parent}` : '';
  const fullMessage = `${message.trim()}\n${trailers}`.trimEnd() + '\n';
  const args = ['commit-tree', EMPTY_TREE, '-m', fullMessage];
  // Comments are linear per ref (append)
  let parentSha = null;
  try {
    parentSha = runGit(['rev-parse', ref], { cwd });
  } catch {
    parentSha = null;
  }
  if (parentSha) args.push('-p', parentSha);
  const newSha = runGit(args, { cwd });
  if (parentSha) {
    runGit(['update-ref', ref, newSha, parentSha], { cwd });
  } else {
    runGit(['update-ref', ref, newSha], { cwd });
  }
  return { ref, sha: newSha, parent: parentSha };
}

export function listComments(slug, { cwd } = {}) {
  const ref = refFor(slug, 'comments');
  let out = '';
  try {
    out = runGit(['log', '-50', '--date=iso-strict', '--format=%H%n%an%n%ae%n%ad%n%B%n--END--', ref], { cwd });
  } catch {
    return [];
  }
  return out
    .split('--END--\n')
    .filter(Boolean)
    .map((block) => {
      const [sha, author, email, date, ...rest] = block.split('\n');
      const message = rest.join('\n').trim();
      const parentMatch = message.match(/Parent:\s*(\w+)/i);
      return { sha, author, email, date, message, parent: parentMatch ? parentMatch[1] : null };
    });
}

export function readMessageBySha(sha, { cwd } = {}) {
  const message = runGit(['show', '-s', '--format=%B', sha], { cwd });
  return { sha, message };
}

export function readTipMessage(slug, kind = 'draft', { cwd, refPrefix } = {}) {
  const { sha, message } = readTip(slug, kind, { cwd, refPrefix });
  return { sha, message };
}

export function deleteRef(slug, kind = 'draft', { cwd } = {}) {
  const ref = refFor(slug, kind);
  runGit(['update-ref', '-d', ref], { cwd });
  return { ref };
}

export function listRefs(kind = 'draft', { cwd, refPrefix } = {}) {
  const base = (refPrefix || 'refs/_blog').replace(///$/, '');
  const ns =
    kind === 'published'
      ? `${base}/published/`
      : kind === 'comments'
        ? `${base}/comments/`
        : `${base}/articles/`;
  let out = '';
  try {
    out = runGit(['for-each-ref', ns, '--format=%(refname) %(objectname)'], { cwd });
  } catch {
    return [];
  }
  return out
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [ref, sha] = line.split(' ');
      const slug = ref.replace(ns, '').replace(/^refs\/[^/]+\/(articles|published|comments)\//, '');
      return { ref, sha, slug };
    });
}
