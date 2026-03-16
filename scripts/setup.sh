#!/usr/bin/env bash
set -euo pipefail

# Git CMS Setup Script
# Verifies Docker prerequisites for safe local usage.
#
# This script is tested! See test/setup.bats
# Run tests: npm run test:setup

echo "🔧 Git CMS Setup"
echo "================"
echo ""

# Check if we're in the right place
if [ ! -f "package.json" ]; then
  echo "❌ Please run this from the git-cms root directory"
  exit 1
fi

# Check Docker
echo "Checking prerequisites..."
if ! command -v docker &> /dev/null; then
  echo "❌ Docker not found. Please install Docker Desktop:"
  echo "   https://docs.docker.com/get-docker/"
  exit 1
fi

if ! docker compose version &> /dev/null; then
  echo "❌ Docker Compose not found. Please install Docker Desktop."
  exit 1
fi

if ! docker info &> /dev/null; then
  echo "❌ Docker daemon not running. Please start Docker Desktop."
  exit 1
fi

echo "✅ Docker is ready"
echo ""

echo "Dependency model:"
echo "  ✅ Uses published npm packages (@git-stunts/*)"
echo "  ✅ No sibling ../git-stunts checkout required"
echo ""
echo "🎉 Setup complete!"
echo ""
echo "You can now run:"
echo "  npm run demo          # Guided, isolated walkthrough"
echo "  npm run sandbox       # Seeded, isolated server for blog readers"
echo "  npm run quickstart    # Interactive menu"
echo "  npm run dev           # Contributor server (uses this checkout)"
echo ""
