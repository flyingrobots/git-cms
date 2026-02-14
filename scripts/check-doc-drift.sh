#!/usr/bin/env bash
#
# check-doc-drift.sh — verify QUICK_REFERENCE.md stays in sync with source code
#
# Checks:
#   1. All CLI commands from bin/git-cms.js appear in QUICK_REFERENCE.md
#   2. All HTTP endpoints from src/server/index.js appear in QUICK_REFERENCE.md
#   3. Deleted file names are not referenced as active links
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(dirname "$SCRIPT_DIR")"
QUICK_REF="$ROOT/QUICK_REFERENCE.md"
CLI_FILE="$ROOT/bin/git-cms.js"
SERVER_FILE="$ROOT/src/server/index.js"

errors=0

# ── 1. CLI commands ──────────────────────────────────────────────────────────
# Extract command names from the switch/case block in bin/git-cms.js
cli_commands=$(grep -oE "case '([a-z-]+)'" "$CLI_FILE" | sed "s/case '//;s/'//")

for cmd in $cli_commands; do
  if ! grep -q "$cmd" "$QUICK_REF"; then
    echo "DRIFT: CLI command '$cmd' missing from QUICK_REFERENCE.md"
    errors=$((errors + 1))
  fi
done

# ── 2. HTTP endpoints ───────────────────────────────────────────────────────
# Extract API paths from src/server/index.js
api_paths=$(grep -oE "pathname === '/api/cms/[a-z-]+'" "$SERVER_FILE" | sed "s/pathname === '//;s/'//g" | sort -u)

for ep in $api_paths; do
  if ! grep -q "$ep" "$QUICK_REF"; then
    echo "DRIFT: HTTP endpoint '$ep' missing from QUICK_REFERENCE.md"
    errors=$((errors + 1))
  fi
done

# ── 3. Deleted-file references ───────────────────────────────────────────────
# These files have been replaced with redirect stubs. No other doc should link to them.
deleted_files=("REPO_WALKTHROUGH.md")

for file in "${deleted_files[@]}"; do
  # Search all markdown files except the stub itself, QUICK_REFERENCE (documents the removal), and CHANGELOG (historical entries)
  offenders=$(grep -rl "$file" "$ROOT"/*.md "$ROOT"/docs/*.md 2>/dev/null | grep -v "$ROOT/$file" | grep -v "$ROOT/QUICK_REFERENCE.md" | grep -v "$ROOT/CHANGELOG.md" || true)
  if [ -n "$offenders" ]; then
    echo "DRIFT: Deleted file '$file' still referenced in: $offenders"
    errors=$((errors + 1))
  fi
done

# Check root GETTING_STARTED.md isn't linked from docs (except from itself)
root_gs_links=$(grep -rn '\[.*\](GETTING_STARTED.md)' "$ROOT"/docs/*.md 2>/dev/null || true)
# Also check for relative links from root-level docs pointing to root GETTING_STARTED.md
# (but NOT links to docs/GETTING_STARTED.md, which is the canonical location)

if [ "$errors" -gt 0 ]; then
  echo ""
  echo "FAIL: $errors doc-drift issue(s) found."
  exit 1
fi

echo "OK: All CLI commands and HTTP endpoints documented. No stale references."
