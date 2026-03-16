#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export GIT_CMS_REPO="${GIT_CMS_REPO:-/data/repo}"

"$ROOT/scripts/prepare-playground.sh" "$GIT_CMS_REPO"

exec node "$ROOT/scripts/run-node-with-disabled-warning.mjs" node "$ROOT/bin/git-cms.js" serve
