#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PROJECT="${MEDIA_PROJECT:-git-cms-media}"
PORT="${MEDIA_PORT:-47639}"

compose() {
  PLAYGROUND_PORT="$PORT" docker compose -p "$PROJECT" "$@"
}

cleanup() {
  compose down -v --remove-orphans > /dev/null 2>&1 || true
}

trap cleanup EXIT INT TERM

cd "$ROOT"
unset NO_COLOR
compose down -v --remove-orphans > /dev/null 2>&1 || true
exec env PLAYGROUND_PORT="$PORT" docker compose -p "$PROJECT" up --build playground
