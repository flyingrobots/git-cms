#!/usr/bin/env bash
set -euo pipefail

# Git CMS Demo Script
# Demonstrates the key features in an isolated Docker environment.

echo "🎬 Git CMS Demo"
echo "==============="
echo ""
echo "This demo will show you:"
echo "  1. Creating a draft article"
echo "  2. Publishing it atomically"
echo "  3. Viewing Git's perspective"
echo "  4. Exploring version history"
echo ""
read -r -p "Press Enter to start..."
echo ""

# Make sure we're in the right directory
if [ ! -f "package.json" ]; then
  echo "❌ Please run this from the git-cms root directory"
  exit 1
fi

# Check Docker
if ! docker compose version > /dev/null 2>&1; then
  echo "❌ Docker Compose not available"
  exit 1
fi

PROJECT="git-cms-demo-$$"
PORT="${PLAYGROUND_PORT:-47638}"

compose() {
  PLAYGROUND_PORT="$PORT" docker compose -p "$PROJECT" "$@"
}

cleanup() {
  compose down -v > /dev/null 2>&1 || true
}

trap cleanup EXIT

echo "📦 Building isolated playground image (if needed)..."
compose build playground > /dev/null 2>&1
echo "✅ Container ready"
echo ""
echo "🧪 Demo repo is isolated from this checkout."
echo ""

run_in_demo() {
  compose run --rm --no-deps playground sh -lc "export GIT_CMS_REPO=/data/repo; export GIT_CMS_SKIP_SEED=1; ./scripts/prepare-playground.sh /data/repo >/dev/null; $1"
}

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📝 Demo 1: Create a Draft"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "Creating an article called 'hello-world'..."
echo ""

run_in_demo '
cat <<EOF | node bin/git-cms.js draft hello-world "My First Post"
# Hello World

This is my first article using Git as a CMS.

## Why This is Cool

- Every save creates a Git commit
- Publishing is an atomic ref update
- Infinite version history for free
- No database required!
EOF
'

echo ""
echo "✅ Draft created!"
echo ""
read -r -p "Press Enter to continue..."
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 Demo 2: List All Articles"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

run_in_demo 'node bin/git-cms.js list'

echo ""
read -r -p "Press Enter to continue..."
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "👁️  Demo 3: What Does Git See?"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "Let's look at what Git created..."
echo ""

echo "📌 Refs (Git's pointers):"
run_in_demo 'git -C "$GIT_CMS_REPO" for-each-ref refs/_blog/'

echo ""
echo "📜 The commit message (this IS the article!):"
run_in_demo 'git -C "$GIT_CMS_REPO" log refs/_blog/dev/articles/hello-world -1 --format="%B"'

echo ""
echo "🔍 The commit points to... the EMPTY TREE!"
run_in_demo 'git -C "$GIT_CMS_REPO" log refs/_blog/dev/articles/hello-world -1 --format="tree: %T"'
echo "    ^ That's Git's canonical empty tree (4b825dc...)"

echo ""
echo "📂 Files in the working directory:"
run_in_demo 'git -C "$GIT_CMS_REPO" status --short'
echo "    ^ Notice: No tracked files changed. The content lives in the demo repo's .git/objects/"

echo ""
read -r -p "Press Enter to continue..."
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 Demo 4: Publish the Article"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "Publishing is just a ref copy (no new commits!)..."
run_in_demo 'node bin/git-cms.js publish hello-world'

echo ""
echo "📌 Check the refs again:"
run_in_demo 'git -C "$GIT_CMS_REPO" for-each-ref refs/_blog/'

echo ""
echo "Notice: Both refs/_blog/dev/articles/hello-world and"
echo "        refs/_blog/dev/published/hello-world point to the SAME commit!"
echo ""
echo "This is atomic, fast-forward only publishing."

echo ""
read -r -p "Press Enter to continue..."
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✏️  Demo 5: Edit and See Version History"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "Making a second edit..."
run_in_demo '
cat <<EOF | node bin/git-cms.js draft hello-world "My First Post (Updated)"
# Hello World (Updated!)

This is my UPDATED article.

## Version History

Every save creates a new commit. The ref just moves forward.

Look at \`git log refs/_blog/dev/articles/hello-world\` to see all versions!
EOF
'

echo ""
echo "📜 Version history:"
run_in_demo 'git -C "$GIT_CMS_REPO" log refs/_blog/dev/articles/hello-world --oneline'

echo ""
echo "You can read ANY previous version with:"
echo "  git show <commit-sha>"

echo ""
read -r -p "Press Enter to continue..."
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎯 Demo 6: The DAG Structure"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "Git stores this as a Directed Acyclic Graph (DAG):"
echo ""
run_in_demo 'git -C "$GIT_CMS_REPO" log refs/_blog/dev/articles/hello-world --graph --oneline --format="%h %s"'

echo ""
echo "Each commit:"
echo "  • Points to the empty tree (no files)"
echo "  • Has a parent pointer (version history)"
echo "  • Contains the article in its commit message"
echo "  • Is identified by a cryptographic object hash (SHA-1 in default mode)"

echo ""
read -r -p "Press Enter to continue..."
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎉 Demo Complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "What you just saw:"
echo "  ✅ Content stored as commit messages"
echo "  ✅ Commits point to empty tree (no files)"
echo "  ✅ Publishing is atomic ref update"
echo "  ✅ Infinite version history"
echo "  ✅ Full Git provenance"
echo ""
echo "This is Git as a database. 🤯"
echo ""
echo "Next steps:"
echo "  • Start the seeded sandbox: npm run sandbox"
echo "  • Open a shell in it: npm run sandbox:shell"
echo "  • Read the guide: docs/GETTING_STARTED.md"
echo "  • Read the ADR: docs/ADR.md"
echo "  • Explore the code: src/lib/CmsService.js"
echo ""
echo "This demo will clean itself up when you exit."
echo ""
