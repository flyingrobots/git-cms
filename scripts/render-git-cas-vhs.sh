#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MODE="${1:-inspect}"
GIT_CAS_REPO="${GIT_CAS_REPO:-$HOME/git/git-stunts/git-cas}"
MEDIA_ROOT="${GIT_CAS_MEDIA_ROOT:-/tmp/git-stunts-media}"
MEDIA_REPO="$MEDIA_ROOT/repo"
MEDIA_SRC="$MEDIA_ROOT/git-cas"
OUT_DIR="$ROOT/docs/media/generated/git-cas"
TMP_DIR="$(mktemp -d /tmp/git-cas-vhs-XXXXXX)"
TMP_TAPE="$TMP_DIR/tape.tape"

case "$MODE" in
  inspect)
    TAPE="$ROOT/vhs/git-cas-inspect.tape"
    OUT_FILE="$OUT_DIR/git-cas-inspect.gif"
    ;;
  dashboard|tui)
    TAPE="$ROOT/vhs/git-cas-dashboard.tape"
    OUT_FILE="$OUT_DIR/git-cas-dashboard.gif"
    ;;
  *)
    echo "Usage: $0 [inspect|dashboard]"
    exit 1
    ;;
esac

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
rm -rf "$MEDIA_ROOT"
mkdir -p "$MEDIA_ROOT" "$MEDIA_REPO"
ln -s "$GIT_CAS_REPO" "$MEDIA_SRC"
git init -q "$MEDIA_REPO"
git -C "$MEDIA_REPO" config user.name "VHS Bot"
git -C "$MEDIA_REPO" config user.email "vhs@example.com"
printf 'hello\nhello\nhello\nhello\n' > "$MEDIA_REPO/repetitive.txt"
cat > "$MEDIA_REPO/report.md" <<'EOF'
# Daily Report

- dedupe works
- manifests restore order
- the vault keeps trees reachable
EOF
cat > "$MEDIA_REPO/manual.txt" <<'EOF'
Chunking, manifests, and refs are enough to make Git behave like a storage substrate.
EOF

(
  cd "$MEDIA_SRC"
  node bin/git-cas.js store "$MEDIA_REPO/repetitive.txt" --slug demo/hello --cwd "$MEDIA_REPO" --tree > /dev/null
  node bin/git-cas.js store "$MEDIA_REPO/report.md" --slug demo/report --cwd "$MEDIA_REPO" --tree > /dev/null
  node bin/git-cas.js store "$MEDIA_REPO/manual.txt" --slug docs/manual --cwd "$MEDIA_REPO" --tree > /dev/null
)

(
  cd "$MEDIA_ROOT"
  sed \
    -e "s|__GIT_CAS_OUTPUT__|$OUT_FILE|g" \
    -e "s|__GIT_CAS_SRC__|$MEDIA_SRC|g" \
    "$TAPE" > "$TMP_TAPE"
  vhs "$TMP_TAPE"
)

echo "Saved VHS capture to $OUT_FILE"
