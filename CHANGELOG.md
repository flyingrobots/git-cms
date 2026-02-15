# Changelog

All notable changes to git-cms are documented in this file.

## [1.1.5] — 2026-02-14

### Fixed

- **(Security) Git identity leakage:** Removed `git config --global` from host-level modification in CI workflow (`.github/workflows/ci.yml`). Scripts now use an isolated global config file via `GIT_CONFIG_GLOBAL` redirected to the workspace, preventing accidental modification of host global settings if workflows are executed locally (e.g., via `act`).
- `QUICK_REFERENCE.md`: `revert` command description corrected — sets state to `reverted`, not `draft`
- `QUICK_REFERENCE.md`: state machine diagram now shows draft→reverted transition and fixes reverted block semantics
- `QUICK_REFERENCE.md`: state derivation rule clarified — "draft ref only" requires no `Status` trailer or `Status: draft`
- `QUICK_REFERENCE.md`: `<40-hex>` replaced with `<oid>` for hash-format-agnostic docs
- `QUICK_REFERENCE.md`: `{ slug, sha? }` replaced with explicit `sha (optional)` notation
- `docs/GETTING_STARTED.md`: migration walkthrough clarifies no-dry-run vs idempotency
- `check-doc-drift.sh`: API endpoint matching uses backtick-delimited grep (prevents substring false positives)
- `check-doc-drift.sh`: deleted-file search recurses into docs subdirectories
- `check-doc-drift.sh`: root GS links regex handles `../` relative path prefixes

## [1.1.4] — 2026-02-14

### Changed

- Consolidate and update documentation for M1.1, M1.2, M1.3, CE2, and CE3
- `QUICK_REFERENCE.md` is now the canonical reference for all 9 CLI commands, 10 HTTP API endpoints, and state machine
- `docs/GETTING_STARTED.md` updated with version history, migration, unpublish/revert workflows
- `README.md` updated with missing CLI commands and choose-your-path navigation
- `ROADMAP.md` milestone statuses updated (M1.1, M1.2, M1.3, CE2, CE3 → complete)
- Root `GETTING_STARTED.md` and `REPO_WALKTHROUGH.md` replaced with redirect stubs
- `docs/ADR.md` file tree updated (removed `REPO_WALKTHROUGH.md`, added `CONTENT_ID_POLICY.md` and `LAYOUT_SPEC.md`)

### Added

- `scripts/check-doc-drift.sh` — automated doc drift detection (CLI commands, HTTP endpoints, stale references)
- `npm run check:docs` script

### Fixed

- Doc freshness banners now reference v1.1.4 (was v1.1.3)
- `check-doc-drift.sh`: CLI/API regex broadened to `[a-z0-9_-]+` for future-proofing
- `check-doc-drift.sh`: CLI command matching uses backtick-delimited grep to prevent substring false positives
- `check-doc-drift.sh`: `root_gs_links` check was computed but never evaluated (dead code)

## [1.1.3] — 2026-02-14

### Fixed

- `migrate()` JSDoc now documents TOCTOU / concurrency limitation

## [1.1.2] — 2026-02-14

### Fixed

- `migrate()` computes `to` from applied migrations instead of redundant `readLayoutVersion` re-read

## [1.1.1] — 2026-02-14

### Fixed

- `readLayoutVersion` now rejects empty/whitespace-only config values (`Number('')` was silently treated as version 0)
- `writeLayoutVersion` validates input (rejects NaN, Infinity, floats, negatives) to prevent storing invalid versions
- `MIGRATIONS` array and entries frozen with `Object.freeze` for immutability consistency

## [1.1.0] — 2026-02-14

### Added

- **Layout Specification v1** (`docs/LAYOUT_SPEC.md`): Formalizes ref namespace, state derivation rules, commit format, config keys, and migration policy (M1.3)
- **Migration framework** (`src/lib/LayoutMigration.js`): `readLayoutVersion`, `writeLayoutVersion`, `pendingMigrations`, `migrate` — forward-only, idempotent layout migrations stored in `cms.layout.version` git config
- **CLI commands:** `git-cms migrate` (run pending migrations) and `git-cms layout-version` (print repo + codebase versions)

## [Unreleased] — git-stunts branch

### Added

- **Version History Browser (CE3):** Browse prior versions of an article, preview old content, and restore a selected version as a new draft commit
  - `CmsService.getArticleHistory()` — walk parent chain to list version summaries (SHA, title, status, author, date)
  - `CmsService.readVersion()` — read full content of a specific commit by SHA
  - `CmsService.restoreVersion()` — restore historical content as a new draft with ancestry validation and provenance trailers (`restoredFromSha`, `restoredAt`)
  - `GET /api/cms/history`, `GET /api/cms/show-version`, `POST /api/cms/restore` server endpoints
  - Admin UI: collapsible history panel with lazy-fetch, version preview, and restore button

- **Content Identity Policy (M1.1):** Canonical slug validation with NFKC normalization, reserved word rejection, and `CmsValidationError` contract (`ContentIdentityPolicy.js`)
- **State Machine (M1.2):** Explicit draft/published/unpublished/reverted states with enforced transition rules (`ContentStatePolicy.js`)
- **Admin UI overhaul:** Split/edit/preview markdown editor (via `marked`), autosave, toast notifications, skeleton loading, drag-and-drop file uploads, metadata trailer editor, keyboard shortcuts (`Cmd+S`, `Esc`), dark mode token system
- **DI seam in CmsService:** Optional `graph` constructor param enables `InMemoryGraphAdapter` injection for zero-subprocess tests
- **In-memory test adapter:** Unit tests run in ~11ms instead of hundreds of ms (no `git init`/subprocess forks)
- **E2E test separation:** Real-git smoke tests in `test/git-e2e.test.js`, excluded from default `test:local` runs
- **`test:git-e2e` script:** Run real-git integration tests independently
- **`@git-stunts/alfred` dependency:** Resilience policy library (wired but not yet integrated)
- **`@git-stunts/docker-guard` dependency:** Docker isolation helpers
- **ROADMAP.md:** M0–M6 milestone plan with blocking graph
- **Formal LaTeX ADR** (`docs/adr-tex-2/`)
- **Onboarding scripts:** `setup.sh`, `demo.sh`, `quickstart.sh` with interactive menus
- **Dependency integrity check:** `check-dependency-integrity.mjs` prevents `file:` path regressions

### Changed

- CmsService now uses `@git-stunts/git-warp` `GitGraphAdapter` and `@git-stunts/plumbing` `GitRepositoryService` instead of raw plumbing calls
- All `repo.updateRef()` calls routed through `CmsService._updateRef()` for DI/production dual-path
- `listArticles()` supports both plumbing (`for-each-ref`) and in-memory (`graph.listRefs`) paths
- Server endpoints return structured `{ code, field }` errors for validation failures
- Swapped all `file:` dependency paths to versioned npm ranges (PP3)

### Fixed

- Symlink traversal hardening in static file serving
- Slug canonicalization enforced at all API ingress points
- Admin UI API calls aligned with server contract (query params, response shapes)
- Server integration test environment stabilized for CI
- **(P1) Stored XSS via markdown preview:** Sanitize `marked.parse()` output with DOMPurify
- **(P1) Unpublish atomicity:** Reorder `unpublishArticle` so draft ref updates before published ref deletion
- **(P2) XSS via slug/badge rendering:** Use `textContent` and DOM APIs instead of `innerHTML` interpolation
- **(P2) SRI hashes:** Add `integrity` + `crossorigin` to marked and DOMPurify CDN script tags
- **(P2) Null guards:** `revertArticle` and `unpublishArticle` throw `no_draft` when draft ref is missing; `_resolveArticleState` throws `article_not_found` when both draft and published refs are missing
- **(P2) uploadAsset DI guard:** Throw `unsupported_in_di_mode` when `cas`/`vault` are null
- **(P1) Path traversal in upload handler:** Sanitize user-controlled `filename` to `path.basename()` preventing writes outside tmpDir
- **(P1) readVersion lineage scoping:** `readVersion` now validates SHA ancestry (prevents cross-article content leakage)
- **(P1) readVersion published fallback:** `readVersion` checks both draft and published refs (consistent with `getArticleHistory`)
- **(P2) Trailer key casing:** Use camelCase `updatedAt` in `unpublishArticle` and `revertArticle` (was lowercase `updatedat` which broke `renderBadges` lookups); destructure out decoded lowercase key before spreading to avoid `TrailerInvalidError`
- **(P2) XSS in `escAttr`:** Escape single quotes (`'` → `&#39;`) to prevent injection into single-quoted attributes
- **(P2) Supply-chain hardening:** Vendor Open Props CSS files locally (`public/css/`) instead of `@import` from unpkg, eliminating CDN dependency and SRI gap
- **(P2) Monkey-patch safety:** E2E test restores `plumbing.execute` in `finally` block
- Unknown `draftStatus` in `resolveEffectiveState` now throws `unknown_status` instead of silently falling through to draft
- Removed double-canonicalization in `_resolveArticleState`
- Replaced sequential `readRef` loop with `Promise.all` in `listArticles` DI path
- Admin UI: fixed `removeTrailerRow` redundant positional removal, FileReader error handling, autosave-while-saving guard, Escape key scoped to editor panel, drag-and-drop scoped to drop zone
- Test cleanup: extracted `createTestCms()` helper, converted try/catch assertions to `.rejects.toMatchObject()`, added guard-path tests
- `TRANSITIONS` Sets now `Object.freeze`d to prevent mutation via `.add()`/`.delete()`
- DI-mode `_updateRef` now performs manual CAS check against `oldSha`
- Server tests assert setup call status codes to surface silent failures
- Vitest exclude glob `test/git-e2e*` → `test/git-e2e**` to cover future subdirectories
- Admin UI: reset history panel state (versions list, preview, selection) when creating a new article to prevent stale data
- Defensive `|| {}` guard on `decoded.trailers` destructuring in `unpublishArticle` and `revertArticle` (prevents TypeError if trailers is undefined)
- `readVersion` now returns `trailers: decoded.trailers || {}` ensuring callers always receive an object
- Upload handler: moved tmpDir cleanup to `finally` block preventing temp directory leaks on failure
- **(P1) sendError info leak:** 500 responses now return generic 'Internal server error' instead of raw `err.message` (prevents leaking file paths, git subprocess details, or internal state)
- **(P2) readBody O(n²):** `readBody` now accumulates chunks in an array and uses `Buffer.concat` instead of repeated string concatenation
- Admin UI: `loadArticle` unconditionally resets `historyVersions` and `selectedVersion` to prevent stale history state when switching articles with the panel closed
- Admin UI: `selectVersion` guards against out-of-order async responses (prevents stale preview flash from rapid clicks)
- **(P2) walkLimit divergence:** Extracted `HISTORY_WALK_LIMIT` as a shared exported constant used by both `_validateAncestry` and the server's history limit clamp

[Unreleased]: https://github.com/flyingrobots/git-cms/compare/main...git-stunts
[1.1.4]: https://github.com/flyingrobots/git-cms/compare/v1.1.3...v1.1.4
[1.1.3]: https://github.com/flyingrobots/git-cms/compare/v1.1.2...v1.1.3
[1.1.2]: https://github.com/flyingrobots/git-cms/compare/v1.1.1...v1.1.2
[1.1.1]: https://github.com/flyingrobots/git-cms/compare/v1.1.0...v1.1.1
[1.1.0]: https://github.com/flyingrobots/git-cms/compare/v1.0.2...v1.1.0
