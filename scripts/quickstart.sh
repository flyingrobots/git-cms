#!/usr/bin/env bash
set -euo pipefail

# Git CMS Quick Start Script
# Safely try out git-cms in Docker

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

# Offer to build or start
echo "What would you like to do?"
echo ""
echo "  1) Start the server (builds if needed)"
echo "  2) Run tests"
echo "  3) Open a shell in the container"
echo "  4) View logs"
echo "  5) Stop and clean up"
echo "  6) Exit"
echo ""
read -r -p "Choose [1-6]: " choice

case $choice in
  1)
    echo ""
    echo "🐳 Starting Git CMS server..."
    echo ""
    echo "The server will be available at: http://localhost:4638"
    echo ""
    echo "Press Ctrl+C to stop the server."
    echo ""
    docker compose up app
    exit 0
    ;;
  2)
    echo ""
    echo "🧪 Running tests in Docker..."
    echo ""
    docker compose run --rm test
    echo ""
    echo "✅ Tests complete!"
    ;;
  3)
    echo ""
    echo "🐚 Opening shell in container..."
    echo ""
    echo "You can now run commands like:"
    echo "  node bin/git-cms.js draft hello-world \"My First Post\""
    echo "  git log --all --oneline --graph"
    echo ""
    echo "Type 'exit' to leave the shell."
    echo ""
    docker compose run --rm app sh
    ;;
  4)
    echo ""
    echo "📋 Viewing logs..."
    echo ""
    docker compose logs -f app
    exit 0
    ;;
  5)
    echo ""
    echo "🧹 Stopping and cleaning up..."
    echo ""
    docker compose down -v
    echo ""
    echo "✅ All containers and volumes removed"
    ;;
  6)
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
