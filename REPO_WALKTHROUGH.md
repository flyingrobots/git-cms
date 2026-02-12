# Git CMS Repository Walkthrough

Technical orientation for the current codebase architecture.

---

## 1. Core Model

Git CMS stores article state in Git commits and refs, not SQL tables.

- Entry point for orchestration: `src/lib/CmsService.js`
- Draft ref pattern: `{refPrefix}/articles/{slug}`
- Published ref pattern: `{refPrefix}/published/{slug}`
- Default `refPrefix`: `refs/_blog/dev` (overridable via `CMS_REF_PREFIX`)

The service writes commit messages as content payloads and moves refs atomically with compare-and-swap semantics.

---

## 2. Composition Layer

`CmsService` composes the `@git-stunts/*` packages:

- `@git-stunts/plumbing`: Git command execution and repository helpers
- `@git-stunts/trailer-codec`: trailer parsing/encoding
- `@git-stunts/git-warp`: commit graph primitives (`commitNode`, `showNode`)
- `@git-stunts/git-cas`: chunked asset storage and retrieval
- `@git-stunts/vault`: secret resolution for encryption keys

This replaced older in-repo helpers such as `src/lib/git.js`, `src/lib/parse.js`, `src/lib/chunks.js`, and `src/lib/secrets.js`.

---

## 3. Interfaces

### CLI

- File: `bin/git-cms.js`
- Commands: `draft`, `publish`, `list`, `show`, `serve`
- `draft` expects body from `stdin`

### HTTP API

- File: `src/server/index.js`
- Endpoints: `/api/cms/snapshot`, `/api/cms/publish`, `/api/cms/list`, `/api/cms/show`, `/api/cms/upload`
- Static UI served from `public/`

### Admin UI

- Files: `public/index.html`, `public/app.js`
- Uses the HTTP API for article lifecycle operations

---

## 4. Testing Surface

- Integration tests: `test/git.test.js`, `test/chunks.test.js`, `test/server.test.js`
- Setup script tests: `test/setup.bats`
- Docker test harness: `test/run-docker.sh`, `test/Dockerfile.bats`

Key regressions covered include:

- Ref-prefix correctness for chunk refs
- Error propagation from Git plumbing
- Symlink traversal hardening in static serving

---

## 5. Operational Docs

- Main overview: `README.md`
- Safety/testing operations: `TESTING_GUIDE.md`
- Deep architecture decisions: `docs/ADR.md`
- Detailed onboarding: `docs/GETTING_STARTED.md`
- Planning/status docs: `ROADMAP.md`, `docs/operations/`

---

## 6. Repository Coordinates

Canonical repository URL for this codebase:

- <https://github.com/flyingrobots/git-cms>
