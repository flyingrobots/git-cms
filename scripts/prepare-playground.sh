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
DRAFT_REF="${REF_PREFIX}/articles/hello-world"
PUBLISHED_REF="${REF_PREFIX}/published/hello-world"

mkdir -p "$REPO_DIR"

if [ ! -d "$REPO_DIR/.git" ]; then
  git init "$REPO_DIR" > /dev/null
fi

git -C "$REPO_DIR" config user.name "$AUTHOR_NAME"
git -C "$REPO_DIR" config user.email "$AUTHOR_EMAIL"

seed_is_complete() {
  local draft_sha published_sha history_count
  draft_sha="$(git -C "$REPO_DIR" rev-parse -q --verify "$DRAFT_REF" 2>/dev/null || true)"
  published_sha="$(git -C "$REPO_DIR" rev-parse -q --verify "$PUBLISHED_REF" 2>/dev/null || true)"

  if [ -z "$draft_sha" ] || [ -z "$published_sha" ]; then
    return 1
  fi

  if [ "$draft_sha" = "$published_sha" ]; then
    return 1
  fi

  history_count="$(git -C "$REPO_DIR" rev-list --count "$DRAFT_REF" 2>/dev/null || echo 0)"
  [ "$history_count" -ge 3 ]
}

delete_seed_refs() {
  while IFS= read -r ref; do
    if [ -n "$ref" ]; then
      git -C "$REPO_DIR" update-ref -d "$ref"
    fi
  done < <(git -C "$REPO_DIR" for-each-ref "${REF_PREFIX}/" --format='%(refname)' || true)
}

existing_refs="$(git -C "$REPO_DIR" for-each-ref "${REF_PREFIX}/" --format='%(refname)' || true)"
if [ -n "$existing_refs" ]; then
  if seed_is_complete; then
    echo "Playground repo already contains the expected seeded state under ${REF_PREFIX}; leaving existing state intact."
    exit 0
  fi

  echo "Playground repo contains incomplete state under ${REF_PREFIX}; repairing seeded refs."
  delete_seed_refs
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
- unpublish, then restore an older version
EOF

echo "Playground repo seeded under ${REF_PREFIX}."
