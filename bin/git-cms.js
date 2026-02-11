#!/usr/bin/env node

import CmsService from '../src/lib/CmsService.js';
import { canonicalizeSlug } from '../src/lib/ContentIdentityPolicy.js';

async function main() {
  const [,, cmd, ...args] = process.argv;
  const cwd = process.cwd();
  const refPrefix = process.env.CMS_REF_PREFIX || 'refs/_blog/dev';

  const cms = new CmsService({ cwd, refPrefix });

  try {
    switch (cmd) {
      case 'draft': {
        const [rawSlug, title] = args;
        if (!rawSlug || !title) throw new Error('Usage: git cms draft <slug> "Title" < content.md');
        const slug = canonicalizeSlug(rawSlug);
        
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
      case 'list': {
        const items = await cms.listArticles();
        if (items.length === 0) console.log("No articles found.");
        items.forEach(i => console.log(`- ${i.slug}: ${i.sha}`));
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
        startServer();
        break;
      }
      default:
        console.log('Usage: git cms <draft|publish|list|show|serve>');
        process.exit(1);
    }
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

main();
