#!/usr/bin/env bash
set -euo pipefail

# Scripts to bootstrap a local "Stargate" gateway for development.
# Usage: ./scripts/bootstrap-stargate.sh [path/to/stargate.git]

TARGET=${1:-"$HOME/git/_blog-stargate.git"}

echo "Bootstrapping git-stargate at $TARGET..."

if [ -d "$TARGET" ]; then
  echo "Target already exists. Skipping clone."
else
  # Clone the bare repo template (or just init one if we want to be fully self-contained)
  # For the "How-to", let's clone the official one if possible, or just init a fresh one.
  # Let's init a fresh one to be safe and self-contained.
  git init --bare "$TARGET"
fi

# Install hooks
cat > "$TARGET/hooks/pre-receive" <<'HOOK'
#!/usr/bin/env bash
set -euo pipefail
EMPTY=0000000000000000000000000000000000000000
NS="refs/_blog/*"
while read -r old new ref; do
  case "$ref" in
    $NS)
      if [ "$old" != "$EMPTY" ]; then
        base=$(git merge-base "$old" "$new") || { echo "merge-base failed"; exit 1; }
        if [ "$base" != "$old" ]; then
          echo "Reject $ref: non-fast-forward ($old -> $new)"; exit 1; fi
      fi
      # Uncomment to enforce signatures locally
      # if ! git verify-commit "$new" >/dev/null 2>&1; then
      #   echo "Reject $ref: unsigned or unverified commit $new"; exit 1; fi
    ;;
  esac
done
exit 0
HOOK
chmod +x "$TARGET/hooks/pre-receive"

cat > "$TARGET/hooks/post-receive" <<'HOOK'
#!/usr/bin/env bash
set -euo pipefail
# In a real setup, this mirrors to origin.
# For local dev, we just log it.
echo "[Stargate] Accepted push to $ref"
exit 0
HOOK
chmod +x "$TARGET/hooks/post-receive"

echo "Stargate ready."
echo "Link it to your repo:"
echo "  git remote add stargate $TARGET"
echo "  git config remote.stargate.push +refs/_blog/*:refs/_blog/*"
