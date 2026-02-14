#!/usr/bin/env node

import CmsService from '../src/lib/CmsService.js';
import { canonicalizeSlug } from '../src/lib/ContentIdentityPolicy.js';

const DEFAULT_REF_PREFIX = 'refs/_blog/dev';

async function main() {
  const [,, cmd, ...args] = process.argv;
  const cwd = process.cwd();
  const refPrefix = process.env.CMS_REF_PREFIX || DEFAULT_REF_PREFIX;

  try {
    const cms = new CmsService({ cwd, refPrefix });
    switch (cmd) {
      case 'draft': {
        const [rawSlug, title] = args;
        if (!rawSlug || !title) throw new Error('Usage: git cms draft <slug> "Title" < content.md');
        const slug = canonicalizeSlug(rawSlug);

        if (process.stdin.isTTY) {
          throw new Error('Usage: git cms draft <slug> "Title" < content.md');
        }

        const chunks = [];
        for await (const chunk of process.stdin) chunks.push(chunk);
        const body = Buffer.concat(chunks).toString('utf8');

        const res = await cms.saveSnapshot({ slug, title, body });
        console.log(`Saved draft: ${res.sha} (${res.ref})`);
        break;
      }
      case 'publish': {
        const [rawSlug] = args;
        if (!rawSlug) throw new Error('Usage: git cms publish <slug>');
        const slug = canonicalizeSlug(rawSlug);

        const res = await cms.publishArticle({ slug });
        console.log(`Published: ${res.sha} (${res.ref})`);
        break;
      }
      case 'unpublish': {
        const [rawSlug] = args;
        if (!rawSlug) throw new Error('Usage: git cms unpublish <slug>');
        const slug = canonicalizeSlug(rawSlug);

        const res = await cms.unpublishArticle({ slug });
        console.log(`Unpublished: ${res.sha} (${res.ref})`);
        break;
      }
      case 'revert': {
        const [rawSlug] = args;
        if (!rawSlug) throw new Error('Usage: git cms revert <slug>');
        const slug = canonicalizeSlug(rawSlug);

        const res = await cms.revertArticle({ slug });
        console.log(`Reverted: ${res.sha} (${res.ref})`);
        break;
      }
      case 'list': {
        const items = await cms.listArticles();
        if (items.length === 0) console.log('No articles found');
        for (const item of items) {
          console.log(`- ${item.slug}: ${item.sha}`);
        }
        break;
      }
      case 'show': {
        const [rawSlug] = args;
        if (!rawSlug) throw new Error('Usage: git cms show <slug>');
        const slug = canonicalizeSlug(rawSlug);
        const article = await cms.readArticle({ slug });
        console.log(`# ${article.title}\n\n${article.body}`);
        break;
      }
      case 'serve': {
        const { startServer } = await import('../src/server/index.js');
        const server = startServer();
        server.on('error', (err) => {
          console.error(`Server error: ${err.message}`);
          process.exit(1);
        });
        break;
      }
      default:
        console.log('Usage: git cms <draft|publish|unpublish|revert|list|show|serve>');
        process.exit(1);
    }
  } catch (err) {
    console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
