# Changelog

All notable changes to git-cms are documented in this file.

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

[Unreleased]: https://github.com/flyingrobots/git-cms/compare/main...git-stunts
