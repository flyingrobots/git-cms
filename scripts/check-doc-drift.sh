#!/usr/bin/env bash
#
# check-doc-drift.sh — verify QUICK_REFERENCE.md stays in sync with source code
#
# Checks:
#   1. All CLI commands from bin/git-cms.js appear in QUICK_REFERENCE.md
#   2. All HTTP endpoints from src/server/index.js appear in QUICK_REFERENCE.md
#   3. Deleted file names are not referenced as active links
#   4. docs/ files don't link to root GETTING_STARTED.md (canonical is docs/)
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
cli_commands=$(grep -oE "case '[a-z0-9_-]+'" "$CLI_FILE" | sed "s/case '//;s/'//")

for cmd in $cli_commands; do
  if ! grep -q "\`$cmd\`" "$QUICK_REF"; then
    echo "DRIFT: CLI command '$cmd' missing from QUICK_REFERENCE.md"
    errors=$((errors + 1))
  fi
done

# ── 2. HTTP endpoints ───────────────────────────────────────────────────────
# Extract API paths from src/server/index.js
api_paths=$(grep -oE "pathname === '/api/cms/[a-z0-9_/-]+'" "$SERVER_FILE" | sed "s/pathname === '//;s/'//g" | sort -u)

for ep in $api_paths; do
  if ! grep -q "\`$ep\`" "$QUICK_REF"; then
    echo "DRIFT: HTTP endpoint '$ep' missing from QUICK_REFERENCE.md"
    errors=$((errors + 1))
  fi
done

# ── 3. Deleted-file references ───────────────────────────────────────────────
# These files have been replaced with redirect stubs. No other doc should link to them.
deleted_files=("REPO_WALKTHROUGH.md")

for file in "${deleted_files[@]}"; do
  # Search all markdown files except the stub itself, QUICK_REFERENCE (documents the removal), and CHANGELOG (historical entries)
  offenders=$(grep -rl --include='*.md' "$file" "$ROOT" "$ROOT"/docs 2>/dev/null | grep -v "$ROOT/$file" | grep -v "$ROOT/QUICK_REFERENCE.md" | grep -v "$ROOT/CHANGELOG.md" || true)
  if [ -n "$offenders" ]; then
    echo "DRIFT: Deleted file '$file' still referenced in: $offenders"
    errors=$((errors + 1))
  fi
done

# ── 4. Root GETTING_STARTED.md links from docs/ ─────────────────────────────
# docs/ files should link to docs/GETTING_STARTED.md, not the root redirect stub
root_gs_links=$(grep -rnE '\[.*\]\((\.\.\/)?GETTING_STARTED\.md\)' "$ROOT"/docs/ --include='*.md' 2>/dev/null || true)
if [ -n "$root_gs_links" ]; then
  echo "DRIFT: docs/ files link to root GETTING_STARTED.md instead of docs/GETTING_STARTED.md:"
  echo "$root_gs_links"
  errors=$((errors + 1))
fi

if [ "$errors" -gt 0 ]; then
  echo ""
  echo "FAIL: $errors doc-drift issue(s) found."
  exit 1
fi

echo "OK: All CLI commands and HTTP endpoints documented. No stale references."
