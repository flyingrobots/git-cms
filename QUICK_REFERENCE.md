# Git CMS Quick Reference

> Validated against v1.2.1 on 2026-03-21.

One-page cheat sheet for Git CMS commands, API endpoints, and concepts.

---

## First-Time Setup

```bash
git clone https://github.com/flyingrobots/git-cms.git
cd git-cms
npm run setup  # Validate Docker prerequisites
npm run demo   # Watch a guided walkthrough
npm run sandbox
```

---

## npm Commands

| Command | Purpose |
|---------|---------|
| `npm run setup` | One-time environment validation |
| `npm run demo` | Guided CLI + Git walkthrough in a disposable isolated repo |
| `npm run sandbox` | Start the seeded long-lived sandbox server on port 4638 |
| `npm run sandbox:shell` | Open a shell in the running sandbox container |
| `npm run sandbox:logs` | Tail sandbox logs |
| `npm run playground` | Compatibility alias for `npm run sandbox` |
| `npm run playground:shell` | Compatibility alias for `npm run sandbox:shell` |
| `npm run playground:logs` | Compatibility alias for `npm run sandbox:logs` |
| `npm run quickstart` | Interactive Docker menu |
| `npm run dev` | Contributor server ([http://localhost:4638](http://localhost:4638)); uses the checkout as the repo |
| `npm run serve` | Start server directly with Node |
| `npm test` | Run integration tests in Docker |
| `npm run test:setup` | Run setup-script tests (BATS) |
| `npm run test:sandbox` | Smoke-test the seeded reader sandbox on the host |
| `npm run test:playground` | Compatibility alias for `npm run test:sandbox` |
| `npm run test:local` | Run Vitest directly on host (advanced) |
| `npm run check:docs` | Check documentation drift against source code |

Mode summary:

- `demo` = reader-safe, guided, ephemeral
- `sandbox` = reader-safe, long-lived, seeded, inspectable
- `dev` = contributor workflow, uses `/app` as the runtime repo

---

## CLI Commands

All 9 commands available via `node bin/git-cms.js <command>` or `git cms <command>` (if linked):

| Command | Usage | Description |
|---------|-------|-------------|
| `draft` | `echo "body" \| git cms draft <slug> "Title"` | Create or update a draft (reads body from stdin) |
| `publish` | `git cms publish <slug>` | Move published ref to the current draft tip |
| `unpublish` | `git cms unpublish <slug>` | Remove from published, keep as unpublished draft |
| `revert` | `git cms revert <slug>` | Move article to 'reverted' state (creates new draft commit with `Status: reverted` trailer) |
| `list` | `git cms list` | List all draft articles |
| `show` | `git cms show <slug>` | Print article title and body |
| `serve` | `git cms serve` | Start HTTP API + Admin UI on port 4638 |
| `migrate` | `git cms migrate` | Run pending layout migrations (forward-only, idempotent) |
| `layout-version` | `git cms layout-version` | Print repo and codebase layout versions |

```bash
# Enter the live sandbox container
npm run sandbox:shell

# Draft an article (reads body from stdin)
echo "# My Post" | node bin/git-cms.js draft my-slug "My Title"

# List drafts
node bin/git-cms.js list

# Publish a draft
node bin/git-cms.js publish my-slug

# Unpublish
node bin/git-cms.js unpublish my-slug

# Revert to 'reverted' state
node bin/git-cms.js revert my-slug

# Read article content
node bin/git-cms.js show my-slug

# Start HTTP API + Admin UI
node bin/git-cms.js serve

# Check layout version
node bin/git-cms.js layout-version

# Run pending migrations
node bin/git-cms.js migrate
```

`node bin/git-cms.js list` does not support `--kind`. Kind filtering is available in the HTTP API (`GET /api/cms/list?kind=published`).

---

## HTTP API

All endpoints are served by `git cms serve` (default port 4638). Slugs are NFKC-normalized on the server.

| Method | Path | Params / Body | Description |
|--------|------|---------------|-------------|
| `GET` | `/api/cms/list` | `?kind=articles\|published` | List articles by kind |
| `GET` | `/api/cms/show` | `?slug=xxx&kind=articles` | Read article content |
| `POST` | `/api/cms/snapshot` | `{ slug, title, body, trailers (optional) }` | Create or update a draft |
| `POST` | `/api/cms/publish` | `{ slug, sha (optional) }` | Publish current draft tip (`sha` acts as optimistic-concurrency token if supplied) |
| `POST` | `/api/cms/unpublish` | `{ slug }` | Unpublish an article |
| `POST` | `/api/cms/revert` | `{ slug }` | Revert to draft state |
| `GET` | `/api/cms/history` | `?slug=xxx&limit=50` | List version history (max 200) |
| `GET` | `/api/cms/reviews` | `?slug=xxx` | List review lanes for one article |
| `GET` | `/api/cms/review` | `?slug=xxx&laneId=yyy` | Read one review lane's visible proposal state |
| `POST` | `/api/cms/review/create` | `{ slug, owner (optional) }` | Create a speculative review lane pinned to the current article state |
| `POST` | `/api/cms/review/snapshot` | `{ slug, laneId, title, body, trailers (optional) }` | Save speculative edits into a review lane without touching the live draft |
| `POST` | `/api/cms/review/apply` | `{ slug, laneId }` | Apply a review lane by writing a new draft commit |
| `GET` | `/api/cms/show-version` | `?slug=xxx&sha=<oid>` | Read a specific historical version |
| `POST` | `/api/cms/restore` | `{ slug, sha }` | Restore a historical version as new draft |
| `POST` | `/api/cms/upload` | `{ slug, filename, data }` | Upload base64-encoded asset (optionally encrypted server-side) |

Historical version endpoints currently assume Git's default SHA-1 object format and therefore validate 40-character hexadecimal commit IDs.

Restore note:

- `POST /api/cms/restore` appends a new draft commit from historical content
- the article must not currently be in the `published` state
- history remains append-only

Review-lane note:

- review lanes use `git-warp` working sets for speculative editorial state
- the live draft stays untouched until `POST /api/cms/review/apply`
- apply writes a new draft commit; it does not replace history or mutate the working set into truth

---

## State Machine

Articles move through four states. Transitions are enforced by `ContentStatePolicy.js`.

```text
States: draft, published, unpublished, reverted

                           revert
         ┌──────────┐ ─────────────────► ┌──────────┐
    ┌───►│  draft    │                    │ reverted  │
    │    └────┬──────┘ ◄──────────────── └──────────┘
    │         │ publish      save
    │         ▼
    │    ┌──────────┐    unpublish    ┌─────────────┐
    │    │ published │───────────────►│ unpublished  │
    │    └────┬──────┘                └──┬────────┬──┘
    │         │ publish (update)         │        │
    │         └──────────┐    publish    │        │
    │                    ▼       │       │        │
    │               ┌──────────┐│       │        │
    │               │ published │◄──────┘        │
    │               └──────────┘                 │
    │                                  save      │
    └────────────────────────────────────────────┘
```

**Effective state** is derived from which refs exist:
- Draft ref only (no `Status` trailer, or `Status: draft`) → `draft`
- Both draft + published refs → `published`
- Draft ref with `Status: unpublished` trailer → `unpublished`
- Draft ref with `Status: reverted` trailer → `reverted`

**Restoring a version creates a new commit — git-cms never rewrites history.**

See [`docs/LAYOUT_SPEC.md`](docs/LAYOUT_SPEC.md) for the full ref namespace and state derivation rules.

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
| `{refPrefix}/published/{slug}` | Published pointer to the current draft tip |
| `{refPrefix}/chunks/{slug}@current` | Current asset-manifest pointer |

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

This replaced older in-repo helpers (`src/lib/git.js`, `src/lib/parse.js`, `src/lib/chunks.js`, `src/lib/secrets.js`).

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

## Testing Surface

| Test File | Coverage |
|-----------|----------|
| `test/git.test.js` | Integration tests — CRUD, publish, unpublish, revert, state machine, content identity |
| `test/chunks.test.js` | Asset encryption and chunking |
| `test/server.test.js` | HTTP API endpoints, validation, error responses |
| `test/git-e2e.test.js` | Real-git smoke tests (subprocess forks) |
| `test/playground-bootstrap.test.js` | Seed/bootstrap behavior and `GIT_CMS_REPO` CLI routing |
| `test/setup.bats` | Setup script tests (BATS) |
| `test/playground-smoke.sh` | Host-side container smoke test for the seeded sandbox |
| `test/run-docker.sh` | Docker test harness |

---

## Troubleshooting

### Cannot find module `@git-stunts/...`

```bash
npm run check:deps
rm -rf node_modules
npm ci
```

### Port 4638 already in use

Override the published port when starting the sandbox:

```bash
PLAYGROUND_PORT=5000 npm run sandbox
```

### Docker daemon not running

Start Docker Desktop (macOS/Windows) or start Docker service on Linux.

---

## Docs Map

| File | Contents |
|------|----------|
| [`README.md`](README.md) | Overview + quick start |
| [`TESTING_GUIDE.md`](TESTING_GUIDE.md) | Safe test workflow |
| [`QUICK_REFERENCE.md`](QUICK_REFERENCE.md) | This file — canonical CLI/API/state machine reference |
| [`ROADMAP.md`](ROADMAP.md) | M0–M6 milestone plan |
| [`docs/GETTING_STARTED.md`](docs/GETTING_STARTED.md) | Full onboarding walkthrough |
| [`docs/ADR.md`](docs/ADR.md) | Architecture decision record |
| [`docs/CONTENT_ID_POLICY.md`](docs/CONTENT_ID_POLICY.md) | Slug validation and content identity rules |
| [`docs/LAYOUT_SPEC.md`](docs/LAYOUT_SPEC.md) | Ref namespace, layout versions, migration policy |
| [`scripts/README.md`](scripts/README.md) | Helper script docs |
| [`test/README.md`](test/README.md) | Test suite docs |

**Removed docs** (redirect stubs remain for one release cycle):
- `GETTING_STARTED.md` (root) — moved to `docs/GETTING_STARTED.md`
- `REPO_WALKTHROUGH.md` — consolidated into this file

**Repository:** [https://github.com/flyingrobots/git-cms](https://github.com/flyingrobots/git-cms)
