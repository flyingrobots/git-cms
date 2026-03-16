# Git as CMS Companion

Read the full article here:

- [Git as CMS](https://flyingrobots.dev/git-stunts/git-cms)

This document is the runnable appendix for the article. It keeps the repo-specific commands, inspection steps, and code pointers in one place without duplicating the essay.

## Fastest Safe Path

```bash
git clone https://github.com/flyingrobots/git-cms.git
cd git-cms
npm run setup
npm run demo
npm run sandbox
```

Then, in another terminal:

```bash
npm run sandbox:shell
```

## Inspect The Stunt With Git

Inside the sandbox shell, the live repo is at `$GIT_CMS_REPO`.

Run these:

```bash
git -C "$GIT_CMS_REPO" for-each-ref refs/_blog/
git -C "$GIT_CMS_REPO" log refs/_blog/dev/articles/hello-world -1 --format="%B"
git -C "$GIT_CMS_REPO" log refs/_blog/dev/articles/hello-world -1 --format="tree: %T"
git -C "$GIT_CMS_REPO" log refs/_blog/dev/articles/hello-world --graph --oneline
```

What to notice:

- the article body lives in the commit message
- the commit points at the empty tree
- `published/hello-world` is behind `articles/hello-world`
- history is native Git ancestry, not a separate feature layer

## What The Seeded Repo Shows

The sandbox starts with an intentionally useful state:

- `hello-world` published at v1
- draft v2 and v3 ahead of published
- enough history to make restore interesting immediately

That means the repo and UI are alive on first load. You do not have to create the interesting state by hand before the stunt becomes visible.

## Best UI Walkthrough

With `npm run sandbox` running:

1. Open [http://localhost:4638](http://localhost:4638)
2. Load `hello-world`
3. Compare the current draft with the published ref
4. Open the History panel
5. Preview an older version
6. Restore it and watch a new draft commit appear

The important thing is that restore does not rewrite history. It appends a new commit using older content.

## Key Code Paths

If you want to read the implementation alongside the article, start here:

- [src/lib/CmsService.js](../src/lib/CmsService.js)
  - `saveSnapshot()` for draft creation
  - `publishArticle()` for ref movement
  - `getArticleHistory()` and `restoreVersion()` for version browsing and restore
- [src/server/index.js](../src/server/index.js)
  - thin HTTP layer over `CmsService`
- [scripts/prepare-playground.sh](../scripts/prepare-playground.sh)
  - seeded sandbox bootstrap used for the article/demo path

## Reality Check

This repo demonstrates a narrow architectural stunt, not a feature-complete CMS platform.

Good fit:

- single-author blogs
- docs sites
- low-write publishing systems
- Git-native operators who care about provenance and inspectability

Not the point:

- rich editorial workflows
- search and plugin ecosystems
- collaborative editing
- mainstream CMS feature parity

## Related Series Entries

- [Welcome to Git Stunts](https://flyingrobots.dev/git-stunts/welcome-to-git-stunts)
- [Bad Ideas Deserve Paperwork](https://flyingrobots.dev/git-stunts/bad-ideas-deserve-paperwork)
- [`git-cas`](https://flyingrobots.dev/git-stunts/git-cas)
- [`git-warp`](https://flyingrobots.dev/git-stunts/git-warp)
