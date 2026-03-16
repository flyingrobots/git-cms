#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PROJECT="git-cms-playground-smoke-$$"
PORT="${PLAYGROUND_PORT:-47638}"
CHECKOUT_REFS_BEFORE="$(git -C "$ROOT" for-each-ref refs/_blog --format='%(refname) %(objectname)' || true)"

compose() {
  PLAYGROUND_PORT="$PORT" docker compose -p "$PROJECT" "$@"
}

cleanup() {
  compose down -v > /dev/null 2>&1 || true
}

trap cleanup EXIT

echo "🐳 Starting playground smoke test on http://localhost:${PORT}"
compose up --build -d playground > /dev/null

ready=0
for _ in $(seq 1 30); do
  if curl -fsS "http://localhost:${PORT}/api/cms/show?slug=hello-world" > /dev/null; then
    ready=1
    break
  fi
  sleep 1
done

if [ "$ready" -ne 1 ]; then
  echo "Playground server did not become ready" >&2
  exit 1
fi

node <<EOF
const res = await fetch('http://localhost:${PORT}/api/cms/show?slug=hello-world');
if (!res.ok) {
  throw new Error(\`Unexpected HTTP status \${res.status}\`);
}
const article = await res.json();
if (article.title !== 'Hello World (Draft)') {
  throw new Error(\`Unexpected draft title: \${article.title}\`);
}
EOF

compose exec -T playground sh -lc '
  git -C "$GIT_CMS_REPO" rev-parse refs/_blog/dev/articles/hello-world >/dev/null
  git -C "$GIT_CMS_REPO" rev-parse refs/_blog/dev/published/hello-world >/dev/null
'

CHECKOUT_REFS_AFTER="$(git -C "$ROOT" for-each-ref refs/_blog --format='%(refname) %(objectname)' || true)"
if [ "$CHECKOUT_REFS_BEFORE" != "$CHECKOUT_REFS_AFTER" ]; then
  echo "Checkout refs changed after running the playground" >&2
  exit 1
fi

echo "✅ Playground smoke test passed"
