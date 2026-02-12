# Git CMS Quick Reference

One-page cheat sheet for Git CMS commands and concepts.

---

## First-Time Setup

```bash
git clone https://github.com/flyingrobots/git-cms.git
cd git-cms
npm run setup  # Validate Docker prerequisites
npm run demo   # Watch a guided walkthrough
```

---

## npm Commands

| Command | Purpose |
|---------|---------|
| `npm run setup` | One-time environment validation |
| `npm run demo` | Guided CLI + Git walkthrough |
| `npm run quickstart` | Interactive Docker menu |
| `npm run dev` | Start HTTP server ([http://localhost:4638](http://localhost:4638)) |
| `npm run serve` | Start server directly with Node |
| `npm test` | Run integration tests in Docker |
| `npm run test:setup` | Run setup-script tests (BATS) |
| `npm run test:local` | Run Vitest directly on host (advanced) |

---

## CLI Commands (Inside Container)

```bash
# Enter container
docker compose run --rm app sh

# Draft an article (reads body from stdin)
echo "# My Post" | node bin/git-cms.js draft my-slug "My Title"

# List drafts
node bin/git-cms.js list

# Publish a draft
node bin/git-cms.js publish my-slug

# Read article content
node bin/git-cms.js show my-slug

# Start HTTP API + Admin UI
node bin/git-cms.js serve

# Exit container
exit
```

`node bin/git-cms.js list` does not support `--kind`. Kind filtering is available in the HTTP API (`GET /api/cms/list?kind=published`).

---

## Core Concept

### Traditional CMS

```text
Article -> Database Row -> SQL Query
```

### Git CMS

```text
Article -> Commit Message -> git log
```

The trick: content lives in commit messages while commits point at the repo's empty tree object.

---

## Key Refs

`refPrefix` defaults to `refs/_blog/dev` and is configurable via `CMS_REF_PREFIX`.

| Ref Pattern | Purpose |
|-------------|---------|
| `{refPrefix}/articles/{slug}` | Draft pointer (moves on every save) |
| `{refPrefix}/published/{slug}` | Published pointer (fast-forward only) |
| `{refPrefix}/chunks/{slug}@current` | Current asset-manifest pointer |

---

## Inspecting with Git

```bash
# View all CMS refs for default dev namespace
git for-each-ref refs/_blog/dev/

# Read an article from commit message
git log refs/_blog/dev/articles/hello-world -1 --format="%B"

# View article history
git log refs/_blog/dev/articles/hello-world --oneline

# Compute empty tree OID for this repo's object format
git hash-object -t tree /dev/null
```

---

## Architecture (Lego Blocks)

```text
git-cms
  -> CmsService (orchestrator)
     -> @git-stunts/plumbing (Git execution)
     -> @git-stunts/trailer-codec (trailer encode/decode)
     -> @git-stunts/git-warp (commit graph primitives)
     -> @git-stunts/git-cas (asset chunk + manifest storage)
     -> @git-stunts/vault (secret/key resolution)
```

---

## Commit Message Shape

```text
# My Article Title

This is the article body.

Status: draft
Author: Example Author
Tags: git, cms
Slug: my-article
UpdatedAt: 2026-01-11T12:34:56Z
```

Trailers are parsed by `@git-stunts/trailer-codec`.

---

## Troubleshooting

### Cannot find module `@git-stunts/...`

```bash
npm run check:deps
rm -rf node_modules
npm ci
```

### Port 4638 already in use

Edit `docker-compose.yml`:

```yaml
ports:
  - "5000:4638"
```

### Docker daemon not running

Start Docker Desktop (macOS/Windows) or start Docker service on Linux.

---

## Docs Map

- `README.md`: overview + quick start
- `TESTING_GUIDE.md`: safe test workflow
- `docs/GETTING_STARTED.md`: full walkthrough
- `docs/ADR.md`: architecture decision record
- `scripts/README.md`: helper script docs
- `test/README.md`: test suite docs
