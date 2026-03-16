#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
GIT_CAS_REPO="${GIT_CAS_REPO:-$HOME/git/git-stunts/git-cas}"
MEDIA_REPO="${GIT_CAS_MEDIA_REPO:-/tmp/git-cas-vhs-demo}"
OUT_DIR="$ROOT/docs/media/generated/git-cas"
TAPE="$ROOT/vhs/git-cas-inspect.tape"
TMP_DIR="$(mktemp -d /tmp/git-cas-vhs-XXXXXX)"
TMP_TAPE="$TMP_DIR/tape.tape"
OUT_FILE="$OUT_DIR/git-cas-inspect.gif"

cleanup() {
  rm -rf "$TMP_DIR"
}

trap cleanup EXIT

if ! command -v vhs > /dev/null 2>&1; then
  echo "❌ VHS is not installed. Install https://github.com/charmbracelet/vhs first."
  exit 1
fi

if [ ! -f "$GIT_CAS_REPO/package.json" ]; then
  echo "❌ Could not find git-cas repo at $GIT_CAS_REPO"
  echo "   Set GIT_CAS_REPO=/absolute/path/to/git-cas and try again."
  exit 1
fi

mkdir -p "$OUT_DIR"
rm -rf "$MEDIA_REPO"
mkdir -p "$MEDIA_REPO"
git init -q "$MEDIA_REPO"
git -C "$MEDIA_REPO" config user.name "VHS Bot"
git -C "$MEDIA_REPO" config user.email "vhs@example.com"
printf 'hello\nhello\nhello\nhello\n' > "$MEDIA_REPO/repetitive.txt"

(
  cd "$GIT_CAS_REPO"
  node bin/git-cas.js store "$MEDIA_REPO/repetitive.txt" --slug demo/hello --cwd "$MEDIA_REPO" --tree > /dev/null
)

(
  cd "$ROOT"
  sed \
    -e "s|__GIT_CAS_OUTPUT__|$OUT_FILE|g" \
    -e "s|__GIT_CAS_REPO__|$GIT_CAS_REPO|g" \
    -e "s|__GIT_CAS_MEDIA_REPO__|$MEDIA_REPO|g" \
    "$TAPE" > "$TMP_TAPE"
  vhs "$TMP_TAPE"
)

echo "Saved VHS capture to $OUT_DIR/git-cas-inspect.gif"
