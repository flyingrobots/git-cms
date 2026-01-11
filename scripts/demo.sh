#!/usr/bin/env bash
set -euo pipefail

# Git CMS Demo Script
# Demonstrates the key features in a safe Docker environment

echo "🎬 Git CMS Demo"
echo "==============="
echo ""
echo "This demo will show you:"
echo "  1. Creating a draft article"
echo "  2. Publishing it atomically"
echo "  3. Viewing Git's perspective"
echo "  4. Exploring version history"
echo ""
read -p "Press Enter to start..."
echo ""

# Make sure we're in the right directory
if [ ! -f "package.json" ]; then
  echo "❌ Please run this from the git-cms root directory"
  exit 1
fi

# Check for git-stunts
if [ ! -d "../git-stunts" ]; then
  echo "❌ git-stunts not found!"
  echo ""
  echo "Please run: npm run setup"
  exit 1
fi

# Check Docker
if ! docker compose &> /dev/null; then
  echo "❌ Docker Compose not available"
  exit 1
fi

echo "📦 Building Docker container (if needed)..."
docker compose build app > /dev/null 2>&1
echo "✅ Container ready"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📝 Demo 1: Create a Draft"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "Creating an article called 'hello-world'..."
echo ""

docker compose run --rm app sh -c '
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
read -p "Press Enter to continue..."
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 Demo 2: List All Articles"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

docker compose run --rm app sh -c 'node bin/git-cms.js list'

echo ""
read -p "Press Enter to continue..."
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "👁️  Demo 3: What Does Git See?"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "Let's look at what Git created..."
echo ""

echo "📌 Refs (Git's pointers):"
docker compose run --rm app sh -c 'git for-each-ref refs/_blog/'

echo ""
echo "📜 The commit message (this IS the article!):"
docker compose run --rm app sh -c 'git log refs/_blog/articles/hello-world -1 --format="%B"'

echo ""
echo "🔍 The commit points to... the EMPTY TREE!"
docker compose run --rm app sh -c 'git log refs/_blog/articles/hello-world -1 --format="tree: %T"'
echo "    ^ That's Git's canonical empty tree (4b825dc...)"

echo ""
echo "📂 Files in the working directory:"
docker compose run --rm app sh -c 'git status --short'
echo "    ^ Notice: No files changed! Everything is in .git/objects/"

echo ""
read -p "Press Enter to continue..."
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 Demo 4: Publish the Article"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "Publishing is just a ref copy (no new commits!)..."
docker compose run --rm app sh -c 'node bin/git-cms.js publish hello-world'

echo ""
echo "📌 Check the refs again:"
docker compose run --rm app sh -c 'git for-each-ref refs/_blog/'

echo ""
echo "Notice: Both refs/_blog/articles/hello-world and"
echo "        refs/_blog/published/hello-world point to the SAME commit!"
echo ""
echo "This is atomic, fast-forward only publishing."

echo ""
read -p "Press Enter to continue..."
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✏️  Demo 5: Edit and See Version History"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "Making a second edit..."
docker compose run --rm app sh -c '
cat <<EOF | node bin/git-cms.js draft hello-world "My First Post (Updated)"
# Hello World (Updated!)

This is my UPDATED article.

## Version History

Every save creates a new commit. The ref just moves forward.

Look at \`git log refs/_blog/articles/hello-world\` to see all versions!
EOF
'

echo ""
echo "📜 Version history:"
docker compose run --rm app sh -c 'git log refs/_blog/articles/hello-world --oneline'

echo ""
echo "You can read ANY previous version with:"
echo "  git show <commit-sha>"

echo ""
read -p "Press Enter to continue..."
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎯 Demo 6: The DAG Structure"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "Git stores this as a Directed Acyclic Graph (DAG):"
echo ""
docker compose run --rm app sh -c 'git log refs/_blog/articles/hello-world --graph --oneline --format="%h %s"'

echo ""
echo "Each commit:"
echo "  • Points to the empty tree (no files)"
echo "  • Has a parent pointer (version history)"
echo "  • Contains the article in its commit message"
echo "  • Is cryptographically signed (SHA-1 hash)"

echo ""
read -p "Press Enter to continue..."
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
echo "  • Start the server: ./scripts/quickstart.sh"
echo "  • Read the guide: docs/GETTING_STARTED.md"
echo "  • Read the ADR: docs/ADR.md"
echo "  • Explore the code: src/lib/CmsService.js"
echo ""
echo "Clean up this demo:"
echo "  docker compose down -v"
echo ""
