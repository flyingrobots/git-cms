#!/usr/bin/env bash
set -euo pipefail

# Git CMS Quick Start Script
# Safely try out git-cms in Docker.

echo "🚀 Git CMS Quick Start"
echo "====================="
echo ""

# Check if Docker is available
if ! command -v docker &> /dev/null; then
  echo "❌ Docker not found!"
  echo ""
  echo "Please install Docker Desktop:"
  echo "  macOS: https://docs.docker.com/desktop/install/mac-install/"
  echo "  Linux: https://docs.docker.com/engine/install/"
  echo "  Windows: https://docs.docker.com/desktop/install/windows-install/"
  echo ""
  exit 1
fi

# Check if Docker Compose is available
if ! docker compose version &> /dev/null; then
  echo "❌ Docker Compose not found!"
  echo ""
  echo "Docker Compose should come with Docker Desktop."
  echo "If you're on Linux, you may need to install it separately."
  echo ""
  exit 1
fi

# Check if Docker daemon is running
if ! docker info &> /dev/null; then
  echo "❌ Docker daemon not running!"
  echo ""
  echo "Please start Docker Desktop and try again."
  echo ""
  exit 1
fi

echo "✅ Docker is ready"
echo ""

echo "✅ Dependency mode: npm packages (no sibling git-stunts checkout required)"
echo ""

# Offer safe reader-first paths before contributor workflow.
echo "What would you like to do?"
echo ""
echo "  1) Run the guided demo (safe, ephemeral)"
echo "  2) Start the seeded sandbox server (safe, long-lived)"
echo "  3) Open a shell in the running sandbox"
echo "  4) Run tests"
echo "  5) Start contributor dev mode (uses this checkout's .git)"
echo "  6) View sandbox logs"
echo "  7) Stop and clean up"
echo "  8) Exit"
echo ""
read -r -p "Choose [1-8]: " choice

case $choice in
  1)
    echo ""
    echo "🎬 Running guided demo..."
    echo ""
    ./scripts/demo.sh
    echo ""
    echo "✅ Demo complete"
    ;;
  2)
    echo ""
    echo "🐳 Starting seeded sandbox..."
    echo ""
    echo "The sandbox will be available at: http://localhost:4638"
    echo "The Git repo lives inside the container at: /data/repo"
    echo ""
    echo "Press Ctrl+C to stop the sandbox."
    echo ""
    docker compose up --build playground
    exit 0
    ;;
  3)
    echo ""
    echo "🐚 Opening shell in the running sandbox..."
    echo ""
    echo "The seeded repo is available at: \$GIT_CMS_REPO"
    echo ""
    echo "Useful commands:"
    echo "  git -C \"\$GIT_CMS_REPO\" for-each-ref refs/_blog/"
    echo "  git -C \"\$GIT_CMS_REPO\" log refs/_blog/dev/articles/hello-world --graph --oneline"
    echo "  node bin/git-cms.js show hello-world"
    echo ""
    echo "Type 'exit' to leave the shell."
    echo ""
    docker compose exec playground sh
    ;;
  4)
    echo ""
    echo "🧪 Running tests in Docker..."
    echo ""
    docker compose run --rm test
    echo ""
    echo "✅ Tests complete!"
    ;;
  5)
    echo ""
    echo "🛠️  Starting contributor dev mode..."
    echo ""
    echo "This mode uses the checkout mounted at /app as the Git repo."
    echo "Use it when you are working on git-cms itself, not when you are just exploring the stunt."
    echo ""
    echo "Press Ctrl+C to stop the server."
    echo ""
    docker compose up app
    exit 0
    ;;
  6)
    echo ""
    echo "📋 Viewing sandbox logs..."
    echo ""
    docker compose logs -f playground
    ;;
  7)
    echo ""
    echo "🧹 Stopping and cleaning up..."
    echo ""
    docker compose down -v
    echo ""
    echo "✅ All containers and volumes removed"
    ;;
  8)
    echo ""
    echo "👋 Goodbye!"
    exit 0
    ;;
  *)
    echo ""
    echo "❌ Invalid choice"
    exit 1
    ;;
esac

echo ""
echo "🎉 Done!"
echo ""
echo "For more info, see: docs/GETTING_STARTED.md"
