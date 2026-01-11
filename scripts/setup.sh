#!/usr/bin/env bash
set -euo pipefail

# Git CMS Setup Script
# Ensures git-stunts Lego Blocks are available
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

if ! command -v docker compose &> /dev/null; then
  echo "❌ Docker Compose not found. Please install Docker Desktop."
  exit 1
fi

if ! docker info &> /dev/null; then
  echo "❌ Docker daemon not running. Please start Docker Desktop."
  exit 1
fi

echo "✅ Docker is ready"
echo ""

# Check for git-stunts
echo "Checking for git-stunts Lego Blocks..."
if [ -d "../git-stunts" ]; then
  echo "✅ git-stunts found at ../git-stunts"
  echo ""
  echo "🎉 Setup complete!"
  echo ""
  echo "You can now run:"
  echo "  npm run demo          # See it in action"
  echo "  npm run quickstart    # Interactive menu"
  echo "  npm run dev           # Start the server"
  echo ""
  exit 0
fi

# git-stunts not found - offer to clone it
echo "⚠️  git-stunts not found in parent directory"
echo ""
echo "Git CMS requires the git-stunts Lego Blocks to be located at:"
echo "  ../git-stunts/"
echo ""
echo "Would you like me to clone it now?"
echo ""
read -p "Clone git-stunts? (y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo ""
  echo "Setup cancelled. To set up manually:"
  echo ""
  echo "  cd .."
  echo "  git clone https://github.com/flyingrobots/git-stunts.git"
  echo "  cd git-cms"
  echo "  npm run setup"
  echo ""
  exit 1
fi

echo ""
echo "📦 Cloning git-stunts..."

# Clone git-stunts to parent directory
cd ..
if git clone https://github.com/flyingrobots/git-stunts.git; then
  echo "✅ git-stunts cloned successfully"
else
  echo "❌ Failed to clone git-stunts"
  echo ""
  echo "Please clone manually:"
  echo "  git clone https://github.com/flyingrobots/git-stunts.git"
  exit 1
fi

cd git-cms

echo ""
echo "🎉 Setup complete!"
echo ""
echo "Directory structure:"
ls -ld ../git-cms ../git-stunts | awk '{print "  " $9}'
echo ""
echo "You can now run:"
echo "  npm run demo          # See it in action"
echo "  npm run quickstart    # Interactive menu"
echo "  npm run dev           # Start the server"
echo ""
