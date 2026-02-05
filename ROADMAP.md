# git-cms Roadmap

## Milestone Overview

| Milestone | Focus | Description |
|-----------|-------|-------------|
| **M0** | Packaging + Infra Guardrails | Ship the engine to npm; hermetic test harness |
| **M1** | Core Content Model + State Machine | Content IDs, slug rules, Draft→Publish transitions |
| **M2** | Editor UX | Preview, autosave, version history |
| **M3** | Delivery | Public API, SSG integration, scheduling |
| **M4** | Media | Media library, drag-and-drop uploads |
| **M5** | Security + Roles | Authentication, multi-user, RBAC |
| **M6** | Polish | Search, keyboard shortcuts, responsive UI |

---

## Blocking Graph

```
PP1, PP2 → PP3 → PP4
M1.1 (Content ID + State Machine) → PD1 → (PD2, PD3)
CM1 → UX3
CM2 → PD3
CE2 → (UX1, CE3)
SEC1 → SEC2
MED1 → MED2
INF3 (UI Redesign) ideally after M1.1
```

---

## M0 — Packaging + Infra Guardrails

### PP1 — Publish @git-stunts/cas to npm *(in progress)*

- **User Story:** As a developer, I can install @git-stunts/cas from npm and rely on semver'd releases.
- **Requirements:** Build + types published; ESM/CJS policy decided; README usage; license; provenance of build (lockfile); CI publish.
- **Acceptance Criteria:** `npm i @git-stunts/cas` works; basic example runs; exports map correct; no `file:` deps.
- **Scope:** Packaging + CI publish.
- **Out of Scope:** API changes unrelated to packaging.
- **Est. Complexity:** ~120–250 LoC
- **Est. Hours:** 2–4h
- **Test Plan:**
  - Golden: install in temp project; run minimal CAS write/read.
  - Failure: missing files in package; wrong exports; types not found.
  - Edges: Node versions; ESM-only consumer.
- **Def of Done:** Published tag; CI green; smoke install verified.
- **Blocking:** PP3
- **Blocked By:** None (but may require minor API stabilization)

---

### PP2 — Publish @git-stunts/empty-graph to npm *(nearly ready)*

- **User Story:** As a dev, I can install empty-graph and run core graph ops from npm.
- **Requirements:** Same packaging checklist; peer deps correct; build artifacts correct.
- **Acceptance Criteria:** Install + run minimal "create graph → write → read → sync" example.
- **Scope:** Packaging + CI release.
- **Out of Scope:** Feature work.
- **Est. Complexity:** ~150–300 LoC
- **Est. Hours:** 3–6h
- **Test Plan:** Smoke install; run minimal integration tests in a fresh project.
- **Def of Done:** Published; release notes; semver tag.
- **Blocking:** PP3
- **Blocked By:** Depends on remaining readiness items in repo

---

### PP3 — Swap file: paths to versioned npm ranges *(blocked by PP1, PP2)*

- **User Story:** As a maintainer, I can build git-cms from clean installs without monorepo path hacks.
- **Requirements:** Replace all `file:`; ensure lockfile updates; CI uses `npm ci`; avoid dependency loops.
- **Acceptance Criteria:** Clean clone + `npm ci` + tests pass.
- **Scope:** Dependency graph + CI.
- **Out of Scope:** Refactors.
- **Est. Complexity:** ~30–80 LoC
- **Est. Hours:** 1–2h
- **Test Plan:**
  - Golden: CI passes.
  - Failure: transitive dependency mismatch.
  - Edges: hoisting differences.
- **Def of Done:** No `file:` remains; green pipeline.
- **Blocking:** PP4
- **Blocked By:** PP1, PP2

---

### PP4 — Publish git-cms to npm *(blocked by PP3)*

- **User Story:** As a user, I can install git-cms and run it via documented entrypoints.
- **Requirements:** CLI or API entry defined; docs; versioning; minimal example.
- **Acceptance Criteria:** Install + `npx git-cms --help` works; sample repo runs end-to-end.
- **Scope:** Packaging + docs + smoke path.
- **Out of Scope:** New features.
- **Est. Complexity:** ~100–250 LoC
- **Est. Hours:** 2–5h
- **Test Plan:**
  - Golden: quickstart works.
  - Failure: missing assets.
  - Edges: OS differences.
- **Def of Done:** Published; "Getting Started" verified.
- **Blocking:** Unlocks downstream adoption
- **Blocked By:** PP3

---

### INF1 — Integrate docker-guard into test setup

- **User Story:** As a maintainer, I prevent tests from silently depending on host state / flaky env.
- **Requirements:** Dockerized test harness; consistent node version; filesystem guards; CI parity.
- **Acceptance Criteria:** Tests run via docker-guard locally + CI; documented.
- **Scope:** Test harness only.
- **Out of Scope:** Rewriting tests unless required.
- **Est. Complexity:** ~150–400 LoC
- **Est. Hours:** 4–8h
- **Test Plan:**
  - Golden: run tests.
  - Failure: missing docker.
  - Edges: Apple Silicon.
  - Stress: repeated runs.
- **Def of Done:** One command runs tests hermetically; CI uses it.
- **Blocking:** Reduces future pain
- **Blocked By:** None

---

### INF2 — Integrate Alfred resilience policies into CmsService

- **User Story:** As a user, transient git/fs/network failures retry safely instead of corrupting state.
- **Requirements:** Define retry policy per operation; idempotency requirements; structured errors; timeouts.
- **Acceptance Criteria:** Injected policies; visible status; retries don't duplicate publishes/writes.
- **Scope:** Service layer operations (publish, save, sync, media upload).
- **Out of Scope:** UI polish beyond surfaced error states.
- **Est. Complexity:** ~200–500 LoC
- **Est. Hours:** 5–10h
- **Test Plan:**
  - Golden: normal ops.
  - Failure: simulate IO errors.
  - Edges: partial write.
  - Stress: retry storms.
- **Def of Done:** Policies applied + tested; no double-commit behavior.
- **Blocking:** Safer future features
- **Blocked By:** Basic CmsService API stability

---

## M1 — Core Content Model + State Machine

### M1.1 — Define canonical Content IDs + paths *(ADD — MUST EXIST)*

- **User Story:** As a developer, I understand how content is identified and where it lives.
- **Requirements:** Slug rules (charset, length, uniqueness); rename semantics; ref naming conventions; content ID immutability policy.
- **Acceptance Criteria:** Documented spec; validation enforced in CmsService; tests for edge cases.
- **Scope:** Spec + validation + tests.
- **Out of Scope:** Migration of existing content (see M1.3).
- **Est. Complexity:** ~200–500 LoC
- **Est. Hours:** 4–10h
- **Test Plan:**
  - Golden: valid slugs accepted.
  - Failure: invalid slugs rejected with clear error.
  - Edges: unicode, reserved names, collisions.
- **Def of Done:** Spec documented; validation in place.
- **Blocking:** Everything else in content model
- **Blocked By:** None

---

### M1.2 — Draft/Published state machine + transitions *(ADD — MUST EXIST)*

- **User Story:** As a developer, the Draft→Published→Unpublished→Reverted states are explicit and deterministic.
- **Requirements:** State enum; allowed transitions; revert semantics (new commit vs ref move); unpublish semantics (tombstone vs delete).
- **Acceptance Criteria:** State machine documented; CmsService enforces transitions; invalid transitions error clearly.
- **Scope:** State machine spec + enforcement + tests.
- **Out of Scope:** Scheduling (PD2).
- **Est. Complexity:** ~300–700 LoC
- **Est. Hours:** 6–14h
- **Test Plan:**
  - Golden: all valid transitions.
  - Failure: invalid transitions rejected.
  - Edges: concurrent transitions, crash recovery.
- **Def of Done:** State machine is law; no undefined states.
- **Blocking:** PD1, CE3, INF3
- **Blocked By:** M1.1

---

### M1.3 — Migration + repo layout spec *(ADD — MUST EXIST)*

- **User Story:** As a maintainer, I know where content lives and how to migrate between versions.
- **Requirements:** Ref namespace spec; index structure; migration strategy; backward compatibility policy.
- **Acceptance Criteria:** Layout documented; migration script exists (even if no-op for v1).
- **Scope:** Spec + tooling.
- **Out of Scope:** Automatic migrations for external repos.
- **Est. Complexity:** ~150–400 LoC
- **Est. Hours:** 4–8h
- **Test Plan:**
  - Golden: fresh repo + migrated repo both work.
  - Failure: corrupt layout detected.
- **Def of Done:** Spec is versioned; migration path exists.
- **Blocking:** Safe upgrades
- **Blocked By:** M1.1

---

### M1.4 — Backup/restore + integrity verification *(ADD — MUST EXIST)*

- **User Story:** As an admin, I can verify repo integrity and restore from backup.
- **Requirements:** Integrity check command; backup instructions (even if "git clone"); restore procedure; fsck-like verification.
- **Acceptance Criteria:** `git-cms verify` reports issues; documented backup/restore.
- **Scope:** CLI command + docs.
- **Out of Scope:** Automated backups.
- **Est. Complexity:** ~200–500 LoC
- **Est. Hours:** 5–10h
- **Test Plan:**
  - Golden: clean repo passes.
  - Failure: corrupted repo detected.
  - Edges: partial corruption.
- **Def of Done:** Verification exists; backup/restore documented.
- **Blocking:** Production readiness
- **Blocked By:** M1.3

---

### CM1 — Add categories, tags, custom metadata fields

- **User Story:** As a publisher, I can organize and filter content without inventing folder voodoo.
- **Requirements:** Metadata schema (trailers); validation; indexing/search hooks.
- **Acceptance Criteria:** Create/edit metadata; list filters work; metadata persists through publish.
- **Scope:** Metadata storage + basic UI controls + query.
- **Out of Scope:** Advanced taxonomies (hierarchies) unless needed.
- **Est. Complexity:** ~400–1200 LoC
- **Est. Hours:** 10–24h
- **Test Plan:**
  - Golden: add tags, filter list.
  - Failure: invalid metadata.
  - Edges: unicode tags.
  - Fuzz: random meta.
- **Def of Done:** Schema documented; migrations for existing content.
- **Blocking:** UX3
- **Blocked By:** M1.1

---

### CM2 — Support multiple content types (pages, posts, etc.)

- **User Story:** As a publisher, I can model pages vs posts with different fields and routes.
- **Requirements:** Type registry; per-type templates; per-type validation; routing rules.
- **Acceptance Criteria:** At least 2 types supported end-to-end; type-specific fields render and publish.
- **Scope:** Type system + UI select + delivery mapping.
- **Out of Scope:** Plugin marketplace.
- **Est. Complexity:** ~500–1600 LoC
- **Est. Hours:** 12–30h
- **Test Plan:**
  - Golden: create each type.
  - Failure: unknown type.
  - Edges: type change.
  - Stress: many items.
- **Def of Done:** Documented type model; backward compatible default type.
- **Blocking:** PD3
- **Blocked By:** CM1, M1.1

---

## M2 — Editor UX

### INF3 — Redesign browser-based admin UI

- **User Story:** As an editor, the admin feels coherent and fast, not like a dev panel accident.
- **Requirements:** New IA (nav/content list/editor/settings); component library decisions; performance budget.
- **Acceptance Criteria:** New layout shipped; key workflows require fewer clicks; Lighthouse baseline not awful.
- **Scope:** UI structure + styling + routing.
- **Out of Scope:** New backend features.
- **Est. Complexity:** ~600–2000 LoC
- **Est. Hours:** 16–40h
- **Test Plan:**
  - Golden: create/edit/publish.
  - Failure: routing errors.
  - Edges: mobile.
  - Stress: large lists.
- **Def of Done:** Design implemented; no regressions; basic a11y.
- **Blocking:** Makes everything else less miserable
- **Blocked By:** M1.2 (state machine) ideally

---

### CE1 — Add markdown preview/rendering to editor

- **User Story:** As an author, I can see rendered Markdown as I write.
- **Requirements:** Renderer (remark/markdown-it); sanitization policy; preview toggle/split view.
- **Acceptance Criteria:** Preview matches published rendering; no XSS injection.
- **Scope:** Editor preview only.
- **Out of Scope:** Custom MD extensions unless required.
- **Est. Complexity:** ~200–600 LoC
- **Est. Hours:** 4–10h
- **Test Plan:**
  - Golden: headings/lists/code.
  - Failure: invalid MD.
  - Edges: huge docs.
  - Fuzz: random markdown.
- **Def of Done:** Stable preview; security checks.
- **Blocking:** Improves authoring
- **Blocked By:** INF3

---

### CE2 — Add autosave for drafts

- **User Story:** As an author, my draft is never lost because I sneezed near a browser tab.
- **Requirements:** Debounce; conflict strategy; "last saved" indicator; local vs repo save decision.
- **Acceptance Criteria:** Changes persist across refresh; no publish commits triggered by autosave.
- **Scope:** Draft save path.
- **Out of Scope:** Scheduled publishing.
- **Est. Complexity:** ~250–700 LoC
- **Est. Hours:** 6–12h
- **Test Plan:**
  - Golden: type → autosave.
  - Failure: disk full.
  - Edges: offline.
  - Stress: rapid edits.
- **Def of Done:** Robust autosave; telemetry/logging optional.
- **Blocking:** CE3, UX1
- **Blocked By:** M1.2

---

### CE3 — Add version history browser

- **User Story:** As an editor, I can browse and diff prior versions and restore one.
- **Requirements:** Map commits to content IDs; diff view; restore action creates new commit; permissions later.
- **Acceptance Criteria:** Select version → view diff → restore → new head reflects restored content.
- **Scope:** History + restore for one content item.
- **Out of Scope:** Cross-item history; multi-user audit (later).
- **Est. Complexity:** ~400–1200 LoC
- **Est. Hours:** 10–24h
- **Test Plan:**
  - Golden: restore.
  - Failure: missing commit.
  - Edges: rename.
  - Stress: long history.
- **Def of Done:** History UI + tested restore semantics.
- **Blocking:** Publishing rollback UX
- **Blocked By:** M1.2, CE2

---

## M3 — Delivery

### PD1 — Published articles list + management (unpublish, revert to draft)

- **User Story:** As an editor, I can manage what's live without manual git archaeology.
- **Requirements:** Publish state machine; unpublish semantics; revert to draft semantics; UI list.
- **Acceptance Criteria:** Published list accurate; unpublish removes from public API; revert creates new draft.
- **Scope:** Management UI + service operations.
- **Out of Scope:** Scheduling.
- **Est. Complexity:** ~400–1200 LoC
- **Est. Hours:** 10–22h
- **Test Plan:**
  - Golden: publish/unpublish.
  - Failure: conflict.
  - Edges: deleted item.
  - Stress: many publishes.
- **Def of Done:** State transitions are deterministic + tested.
- **Blocking:** PD2, PD3
- **Blocked By:** M1.2

---

### PD2 — Scheduled publishing

- **User Story:** As a publisher, I can schedule content to go live automatically.
- **Requirements:** Scheduler (cron-like); time zone policy (UTC); persistence; retry; idempotent publish.
- **Acceptance Criteria:** Schedule → content publishes at time; missed schedule recovers on restart.
- **Scope:** Schedule storage + runner.
- **Out of Scope:** Complex editorial calendars.
- **Est. Complexity:** ~350–900 LoC
- **Est. Hours:** 8–18h
- **Test Plan:**
  - Golden: schedule soon.
  - Failure: system clock skew.
  - Edges: DST.
  - Stress: lots of schedules.
- **Def of Done:** Deterministic behavior; tests use fake timers.
- **Blocking:** "Real CMS" vibes
- **Blocked By:** PD1

---

### PD3 — Public-facing content API / SSG integration

- **User Story:** As a site builder, I can fetch published content for SSR/SSG without poking internals.
- **Requirements:** Stable read API; pagination; filtering; caching headers; content type mapping; auth later.
- **Acceptance Criteria:** Next/SSG sample pulls content; API returns only published unless auth.
- **Scope:** Read-only API + example integration.
- **Out of Scope:** Comments, search backend.
- **Est. Complexity:** ~500–1500 LoC
- **Est. Hours:** 12–28h
- **Test Plan:**
  - Golden: list + get.
  - Failure: missing content.
  - Edges: large payloads.
  - Fuzz: random queries.
- **Def of Done:** Documented API + versioned response schema.
- **Blocking:** "People can use it"
- **Blocked By:** PD1, CM2 (strongly recommended)

---

## M4 — Media

### MED1 — Build a media library

- **User Story:** As an editor, I can see and reuse uploaded images/files.
- **Requirements:** Storage strategy (git-lfs? CAS blobs?); metadata (size/type/hash); listing + delete policy.
- **Acceptance Criteria:** Upload appears in library; can insert reference into content.
- **Scope:** Media index + UI.
- **Out of Scope:** Transformations/CDN.
- **Est. Complexity:** ~600–1800 LoC
- **Est. Hours:** 16–40h
- **Test Plan:**
  - Golden: upload & reuse.
  - Failure: unsupported type.
  - Edges: huge files.
  - Stress: many items.
- **Def of Done:** Storage documented; integrity checks.
- **Blocking:** MED2
- **Blocked By:** PD3 decisions (public delivery), CAS integration maturity

---

### MED2 — Drag-and-drop file uploads

- **User Story:** As an editor, I can drop files into the UI and they just work.
- **Requirements:** DnD UX; progress; cancellation; retry; validation.
- **Acceptance Criteria:** Drag → upload → available; errors clear.
- **Scope:** UI + API endpoint + persistence.
- **Out of Scope:** Batch transformations.
- **Est. Complexity:** ~300–900 LoC
- **Est. Hours:** 8–18h
- **Test Plan:**
  - Golden: drag upload.
  - Failure: network drop.
  - Edges: duplicate name.
  - Stress: big uploads.
- **Def of Done:** Robust UX; no partial-corrupt artifacts.
- **Blocking:** Improves author velocity
- **Blocked By:** MED1

---

## M5 — Security + Roles

### SEC1 — Add authentication

- **User Story:** As an admin, only authorized users can access the CMS.
- **Requirements:** Auth method (session/cookie/JWT); login/logout; protected routes; CSRF policy.
- **Acceptance Criteria:** Unauth users blocked; login persists; logout clears session.
- **Scope:** Auth layer + route guards.
- **Out of Scope:** Roles/permissions beyond "logged in".
- **Est. Complexity:** ~400–1200 LoC
- **Est. Hours:** 12–24h
- **Test Plan:**
  - Golden: login.
  - Failure: invalid creds.
  - Edges: token expiry.
  - Stress: brute attempts (rate limit optional).
- **Def of Done:** Threat model notes; security basics in place.
- **Blocking:** SEC2
- **Blocked By:** Delivery architecture decisions (API boundary)

---

### SEC2 — Multi-user support + roles *(blocked by SEC1)*

- **User Story:** As an org, multiple editors can work with controlled permissions.
- **Requirements:** User model; roles; permission checks in service + UI; audit trail (at least attribution).
- **Acceptance Criteria:** At least 3 roles (admin/editor/viewer) enforced; actions denied correctly.
- **Scope:** RBAC enforcement + UI gating.
- **Out of Scope:** SSO/SCIM.
- **Est. Complexity:** ~600–1800 LoC
- **Est. Hours:** 18–45h
- **Test Plan:**
  - Golden: role actions.
  - Failure: privilege escalation attempts.
  - Edges: role change mid-session.
  - Stress: many users.
- **Def of Done:** Permissions tested; no "UI-only security."
- **Blocking:** "Real multi-user CMS"
- **Blocked By:** SEC1

---

## M6 — Polish

### UX1 — Unsaved changes confirmation

- **User Story:** As an editor, I don't accidentally lose edits.
- **Requirements:** Dirty state tracking; route change intercept; close-tab warning.
- **Acceptance Criteria:** Navigating away prompts; saving clears prompt.
- **Scope:** Editor pages.
- **Out of Scope:** Global app.
- **Est. Complexity:** ~80–200 LoC
- **Est. Hours:** 2–4h
- **Test Plan:**
  - Golden: prompt appears.
  - Failure: false positives.
  - Edges: programmatic nav.
- **Def of Done:** No regressions in navigation.
- **Blocking:** Pairs with autosave
- **Blocked By:** CE2

---

### UX2 — Error handling + loading states in UI

- **User Story:** As a user, I understand what's happening instead of staring at a frozen vibe.
- **Requirements:** Standard error boundary; retry UI; skeletons/spinners; consistent toasts.
- **Acceptance Criteria:** No blank screens; actionable errors; loading visible for async ops.
- **Scope:** UI patterns across app.
- **Out of Scope:** Pixel-perfect redesign.
- **Est. Complexity:** ~200–700 LoC
- **Est. Hours:** 6–14h
- **Test Plan:**
  - Golden: happy path.
  - Failure: simulate API 500.
  - Edges: slow network.
  - Stress: repeated actions.
- **Def of Done:** Consistent system-wide pattern.
- **Blocking:** Everything feels better
- **Blocked By:** Stable service API (CmsService)

---

### UX3 — Search + filtering

- **User Story:** As an editor, I can find content fast.
- **Requirements:** Filter by title/tag/category/type/status; fuzzy search optional; pagination.
- **Acceptance Criteria:** Filters work and persist in URL.
- **Scope:** Admin list view.
- **Out of Scope:** Full-text search across bodies (later).
- **Est. Complexity:** ~250–800 LoC
- **Est. Hours:** 6–16h
- **Test Plan:**
  - Golden: filter combos.
  - Failure: invalid query params.
  - Edges: unicode.
  - Stress: large datasets.
- **Def of Done:** Performant on 10k items (or documented limit).
- **Blocking:** Usability
- **Blocked By:** CM1, CM2, PD1

---

### UX4 — Keyboard shortcuts

- **User Story:** As a power user, I can publish/save/navigate without the mouse.
- **Requirements:** Shortcut map; conflict avoidance; discoverability (help modal).
- **Acceptance Criteria:** Save/publish shortcuts work; no broken browser shortcuts.
- **Scope:** Editor + list.
- **Out of Scope:** Fully customizable shortcuts.
- **Est. Complexity:** ~150–400 LoC
- **Est. Hours:** 4–8h
- **Test Plan:**
  - Golden: shortcuts trigger.
  - Failure: focus issues.
  - Edges: input fields.
  - Stress: rapid use.
- **Def of Done:** Docs + UI hint.
- **Blocking:** Polish tier
- **Blocked By:** Core actions stable (save/publish)

---

### UX5 — Responsive mobile UI

- **User Story:** As a user, I can do basic admin tasks on mobile.
- **Requirements:** Responsive layout; touch targets; editor experience at least usable.
- **Acceptance Criteria:** List + edit + publish works on small screens.
- **Scope:** Responsiveness pass.
- **Out of Scope:** Perfect mobile-first editor.
- **Est. Complexity:** ~300–1200 LoC
- **Est. Hours:** 10–24h
- **Test Plan:**
  - Golden: key flows.
  - Failure: overflow.
  - Edges: landscape.
  - Stress: long content.
- **Def of Done:** No broken layouts; basic a11y.
- **Blocking:** Adoption
- **Blocked By:** INF3 (UI redesign) ideally

---

## Already Published

- `@git-stunts/plumbing`
- `@git-stunts/trailer-codec`
- `@git-stunts/vault`
