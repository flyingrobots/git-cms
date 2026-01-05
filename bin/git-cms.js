#!/usr/bin/env node

import { writeSnapshot, fastForwardPublished, listRefs, readTipMessage } from '../src/lib/git.js';
import { parseArticleCommit } from '../src/lib/parse.js';
import { startServer } from '../src/server/index.js';

async function main() {
  const [,, cmd, ...args] = process.argv;
  const cwd = process.cwd();
  const refPrefix = process.env.CMS_REF_PREFIX;

  try {
    switch (cmd) {
      case 'draft': {
        const [slug, title] = args;
        if (!slug || !title) throw new Error('Usage: git cms draft <slug> "Title" < content.md');
        
        const chunks = [];
        for await (const chunk of process.stdin) chunks.push(chunk);
        const body = Buffer.concat(chunks).toString('utf8');
        const message = `${title}\n\n${body}\n\nStatus: draft\n`;
        
        const res = writeSnapshot({ slug, message, cwd, refPrefix });
        console.log(`Saved draft: ${res.sha} (${res.ref})`);
        break;
      }
      case 'publish': {
        const [slug] = args;
        if (!slug) throw new Error('Usage: git cms publish <slug>');
        
        const tip = readTipMessage(slug, 'draft', { cwd, refPrefix });
        const res = fastForwardPublished(slug, tip.sha, { cwd, refPrefix });
        console.log(`Published: ${res.sha} (${res.ref})`);
        break;
      }
      case 'list': {
        const items = listRefs('draft', { cwd, refPrefix });
        if (items.length === 0) console.log("No articles found.");
        items.forEach(i => console.log(`- ${i.slug}: ${i.ref}`));
        break;
      }
      case 'show': {
        const [slug] = args;
        if (!slug) throw new Error('Usage: git cms show <slug>');
        const { message } = readTipMessage(slug, 'draft', { cwd, refPrefix });
        const { title, body } = parseArticleCommit(message);
        console.log(`# ${title}\n\n${body}`);
        break;
      }
      case 'serve': {
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