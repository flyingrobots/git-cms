#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REPO_DIR="${1:-${GIT_CMS_REPO:-$ROOT/test-repo}}"
ENV_NAME="${GIT_CMS_ENV:-dev}"
REF_PREFIX="${CMS_REF_PREFIX:-refs/_blog/${ENV_NAME}}"
AUTHOR_NAME="${GIT_AUTHOR_NAME:-Git CMS Playground}"
AUTHOR_EMAIL="${GIT_AUTHOR_EMAIL:-playground@git-cms.local}"
COMMITTER_NAME="${GIT_COMMITTER_NAME:-$AUTHOR_NAME}"
COMMITTER_EMAIL="${GIT_COMMITTER_EMAIL:-$AUTHOR_EMAIL}"
SKIP_SEED="${GIT_CMS_SKIP_SEED:-0}"

mkdir -p "$REPO_DIR"

if [ ! -d "$REPO_DIR/.git" ]; then
  git init "$REPO_DIR" > /dev/null
fi

git -C "$REPO_DIR" config user.name "$AUTHOR_NAME"
git -C "$REPO_DIR" config user.email "$AUTHOR_EMAIL"

existing_refs="$(git -C "$REPO_DIR" for-each-ref "${REF_PREFIX}/" --format='%(refname)' || true)"
if [ -n "$existing_refs" ]; then
  echo "Playground repo already contains refs under ${REF_PREFIX}; leaving existing state intact."
  exit 0
fi

if [ "$SKIP_SEED" = "1" ]; then
  echo "Initialized repo at ${REPO_DIR} without seeding."
  exit 0
fi

run_cms() {
  GIT_CMS_REPO="$REPO_DIR" \
  CMS_REF_PREFIX="$REF_PREFIX" \
  GIT_AUTHOR_NAME="$AUTHOR_NAME" \
  GIT_AUTHOR_EMAIL="$AUTHOR_EMAIL" \
  GIT_COMMITTER_NAME="$COMMITTER_NAME" \
  GIT_COMMITTER_EMAIL="$COMMITTER_EMAIL" \
  node "$ROOT/bin/git-cms.js" "$@"
}

echo "Seeding playground repo at ${REPO_DIR}..."

cat <<'EOF' | run_cms draft hello-world "Hello World"
# Hello World

This is the first published version of the demo article.

It exists to show that Git can act like a tiny CMS without touching the working tree.
EOF

run_cms publish hello-world

cat <<'EOF' | run_cms draft hello-world "Hello World (Edited)"
# Hello World (Edited)

This draft is ahead of the published ref.

- Every save creates a commit
- Publishing moves a ref
- History is the storage model
EOF

cat <<'EOF' | run_cms draft hello-world "Hello World (Draft)"
# Hello World (Draft)

This is the current draft head in the seeded playground.

Try these next:

- inspect refs
- inspect the commit message
- browse history
- restore an older version
EOF

echo "Playground repo seeded under ${REF_PREFIX}."
