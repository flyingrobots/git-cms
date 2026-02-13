# Changelog

All notable changes to git-cms are documented in this file.

## [Unreleased] — git-stunts branch

### Added
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
