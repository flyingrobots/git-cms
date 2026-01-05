#!/usr/bin/env node

/**
 * git-cms: A serverless, database-free CMS built on Git plumbing.
 * 
 * Usage:
 *   git cms draft <slug> "Title" < content.md
 *   git cms publish <slug>
 *   git cms list
 *   git cms show <slug>
 */

const { execFileSync } = require('node:child_process');
const { readFileSync } = require('node:fs');

const EMPTY_TREE = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';
const REF_BASE = process.env.GIT_CMS_REF_BASE || 'refs/_blog';

// --- Git Plumbing Helpers ---

function runGit(args) {
  return execFileSync('git', args, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
}

function getRef(slug, type = 'article') {
  return type === 'published' 
    ? `${REF_BASE}/published/${slug}` 
    : `${REF_BASE}/articles/${slug}`;
}

// --- CMS Logic ---

function writeDraft(slug, title, body) {
  const ref = getRef(slug, 'article');
  
  // 1. Get Parent (if exists)
  let parentSha = null;
  try { parentSha = runGit(['rev-parse', ref]); } catch {}

  // 2. Format Commit Message (Title + Body + Metadata)
  const message = `${title}\n\n${body}\n\nStatus: draft\n`;

  // 3. Commit to Empty Tree
  const args = ['commit-tree', EMPTY_TREE];
  if (parentSha) args.push('-p', parentSha);
  args.push('-m', message);
  
  const newSha = runGit(args);

  // 4. Update Ref (CAS)
  if (parentSha) {
    runGit(['update-ref', ref, newSha, parentSha]);
  } else {
    runGit(['update-ref', ref, newSha]);
  }

  return { slug, sha: newSha, ref };
}

function publishDraft(slug) {
  const draftRef = getRef(slug, 'article');
  const pubRef = getRef(slug, 'published');

  // 1. Get Draft Tip
  let draftSha;
  try {
    draftSha = runGit(['rev-parse', draftRef]);
  } catch {
    throw new Error(`Draft not found: ${slug}`);
  }

  // 2. Fast-Forward Published Ref
  let oldPubSha = null;
  try { oldPubSha = runGit(['rev-parse', pubRef]); } catch {}

  if (oldPubSha) {
    runGit(['update-ref', pubRef, draftSha, oldPubSha]);
  } else {
    runGit(['update-ref', pubRef, draftSha]);
  }

  return { slug, sha: draftSha, published: true };
}

function listArticles() {
  try {
    const raw = runGit(['for-each-ref', '--format=%(refname:short) %(subject)', `${REF_BASE}/articles`]);
    return raw.split('\n').filter(Boolean).map(line => {
      const [ref, ...titleParts] = line.split(' ');
      return { slug: ref.split('/').pop(), title: titleParts.join(' ') };
    });
  } catch (e) {
    return [];
  }
}

function showArticle(slug) {
  const ref = getRef(slug, 'article');
  try {
    const sha = runGit(['rev-parse', ref]);
    const body = runGit(['show', '-s', '--format=%B', sha]);
    return { slug, sha, body };
  } catch {
    throw new Error(`Article not found: ${slug}`);
  }
}

// --- CLI Entry Point ---

async function main() {
  const [,, cmd, ...args] = process.argv;

  try {
    switch (cmd) {
      case 'draft': {
        const [slug, title] = args;
        if (!slug || !title) throw new Error('Usage: git cms draft <slug> "Title" < content.md');
        
        // Read stdin for body
        const chunks = [];
        for await (const chunk of process.stdin) chunks.push(chunk);
        const body = Buffer.concat(chunks).toString('utf8');
        
        const res = writeDraft(slug, title, body);
        console.log(`Saved draft: ${res.sha} (${res.slug})`);
        break;
      }
      case 'publish': {
        const [slug] = args;
        if (!slug) throw new Error('Usage: git cms publish <slug>');
        const res = publishDraft(slug);
        console.log(`Published: ${res.sha} (${res.slug})`);
        break;
      }
      case 'list': {
        const items = listArticles();
        if (items.length === 0) console.log("No articles found.");
        items.forEach(i => console.log(`- ${i.slug}: ${i.title}`));
        break;
      }
      case 'show': {
        const [slug] = args;
        if (!slug) throw new Error('Usage: git cms show <slug>');
        const res = showArticle(slug);
        console.log(res.body);
        break;
      }
      default:
        console.log('Usage: git cms <draft|publish|list|show>');
        process.exit(1);
    }
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

main();
