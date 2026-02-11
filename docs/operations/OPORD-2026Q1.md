UNCLASSIFIED

# OPORD Packet: git-cms (2026Q1)

- Effective Date: 2026-02-11
- Campaign Intent: Move `git-cms` from prototype-stable to release-grade baseline.
- Planning Reference: `ROADMAP.md`

## OPORD Set Summary

| OPORD | Codename | Primary Objective | Roadmap Alignment | Status |
|---|---|---|---|---|
| OPORD-01 | CLEAN-LIFT | Complete reproducible packaging/install baseline | PP3, PP4 precondition | Executed (2026-02-11) |
| OPORD-02 | SLUG-LAW | Define and enforce canonical Content ID + slug policy | M1.1 | Planned |
| OPORD-03 | STATE-RAIL | Implement explicit content state machine and transitions | M1.2, PD1 | Planned |
| OPORD-04 | RESILIENT-EDGE | Add retry/resilience policy to write paths | INF2 | Planned |

## OPORD-01: CLEAN-LIFT (PP3 Closure)

### 1. Situation

Core dependencies were migrated to npm ranges, but environment-linked lockfile entries previously indicated unresolved clean-install reproducibility risk.

### 2. Mission

Establish a deterministic clean clone/install/test pipeline that passes without any local sibling repo dependency.

### 3. Execution

Phase 1:
- Rebuild lockfile in a clean environment.
- Remove link-based package resolution from lockfile output.

Phase 2:
- Validate with:
  - `npm ci`
  - `npm run test:local`
  - Docker test path (`npm test`)

Phase 3:
- Add automated guard checks in CI:
  - fail on lockfile link entries to local paths
  - fail on `file:` dependency regressions

### 4. Sustainment

- Required tooling: Node/npm, Docker
- Required artifacts: `package-lock.json`, CI workflow updates, test logs

### 5. Command and Signal

Go Criteria:
- No local link/path dependency leakage in lockfile.
- Clean clone install and tests pass in CI and local clean environment.

No-Go Criteria:
- Any required package resolves via local filesystem sibling path.

### 6. Execution Status (2026-02-11)

- `package.json` + `package-lock.json` migrated to npm-published `@git-stunts/*` packages.
- Added dependency integrity guard script: `scripts/check-dependency-integrity.mjs`.
- Added CI gate: `.github/workflows/ci.yml` `dependency-guard` job with pre/post-install checks.
- Docker/compose moved to repository-local build context; Node 22 baseline applied.
- Setup/demo/quickstart scripts updated to remove stale sibling repo assumptions.
- Validation completed:
  - `npm run check:deps` passed
  - `npm run test:setup` passed
  - `npm run test:local` passed
  - `npm test` passed

## OPORD-02: SLUG-LAW (M1.1)

### 1. Situation

Core draft/publish flow works, but content identity policy is not formalized and enforced as a first-class contract.

### 2. Mission

Define and enforce canonical slug/content ID policy across CLI and API ingress paths.

### 3. Execution

Phase 1:
- Produce spec document:
  - Allowed character set
  - Length bounds
  - Reserved names
  - Collision policy
  - Rename semantics

Phase 2:
- Implement validation at all entry points:
  - CLI commands
  - HTTP handlers
  - service-level guard in `CmsService`

Phase 3:
- Add test matrix:
  - valid inputs
  - invalid charset
  - unicode/normalization edge cases
  - collision and reserved-name behavior

### 4. Sustainment

- Required artifacts: spec doc, validation module, integration tests, user-facing error map

### 5. Command and Signal

Go Criteria:
- Spec is versioned and referenced in docs.
- Invalid slugs are rejected deterministically with clear errors.

No-Go Criteria:
- Different behavior between CLI and API validation outcomes.

## OPORD-03: STATE-RAIL (M1.2)

### 1. Situation

Current operations support draft and publish but not a complete explicit state machine with enforced transition policy.

### 2. Mission

Implement deterministic state transition enforcement for Draft, Published, Unpublished, and Reverted flows.

### 3. Execution

Phase 1:
- Publish state model document:
  - states
  - allowed transitions
  - forbidden transitions
  - revert semantics (new commit vs pointer move)

Phase 2:
- Service implementation:
  - transition guards in `CmsService`
  - explicit transition errors
  - no silent mutation paths

Phase 3:
- API/CLI updates:
  - add `unpublish` and `revert` operations
  - ensure responses expose transition result clearly

Phase 4:
- Concurrency tests:
  - conflicting updates
  - stale oldSha handling
  - idempotent publish behavior

### 4. Sustainment

- Required artifacts: state model spec, service tests, API tests, CLI behavior tests

### 5. Command and Signal

Go Criteria:
- Transition matrix fully enforced by tests.
- Invalid transitions fail loudly and consistently.

No-Go Criteria:
- Any transition occurs without explicit state policy evaluation.

## OPORD-04: RESILIENT-EDGE (INF2)

### 1. Situation

Technical debt indicates retry/resilience policy is not yet integrated in write-critical paths.

### 2. Mission

Integrate deterministic retry policy for transient failures without introducing duplicate writes or state divergence.

### 3. Execution

Phase 1:
- Define operation classes and retry policy matrix:
  - read-only operations
  - write operations (CAS-sensitive)
  - non-retryable failures

Phase 2:
- Implement `@git-stunts/alfred` policy integration in `CmsService` pathways:
  - save snapshot
  - publish
  - upload asset ref updates

Phase 3:
- Add deterministic tests:
  - injected transient failures
  - retry exhaustion behavior
  - duplicate-write prevention assertions

Phase 4:
- Add operational logging:
  - retry count
  - terminal failure reason
  - trace correlation key

### 4. Sustainment

- Required artifacts: retry policy definition, injected-failure test harness, error taxonomy

### 5. Command and Signal

Go Criteria:
- Transient failures recover within policy bounds.
- No duplicate commits or ref corruption under retry.

No-Go Criteria:
- Retry behavior masks permanent errors or causes write amplification.

## Sequencing and Control Measures

Execution sequence:
1. OPORD-01
2. OPORD-02
3. OPORD-03
4. OPORD-04

Rationale:
- Packaging reproducibility first prevents unstable substrate.
- Identity and state contracts second prevent semantic drift.
- Resilience hardening last applies to a stabilized behavior model.

Decision Gates:
- Gate A (post OPORD-01): clean-install confidence achieved
- Gate B (post OPORD-02): content identity contract enforced
- Gate C (post OPORD-03): transition semantics deterministic
- Gate D (post OPORD-04): operational reliability baseline achieved

## Commander’s Intent (Operational End State)

By end state, `git-cms` can be cleanly installed, has enforceable content/state rules, and tolerates expected transient failures without data integrity regression. At that point, M2/M3 feature velocity can increase without accumulating foundational risk.
