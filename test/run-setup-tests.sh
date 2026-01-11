#!/usr/bin/env bash
set -euo pipefail

# Run BATS tests for setup.sh in Docker

echo "🧪 Running setup script tests in Docker..."
echo ""

# Build the test image
docker build -f test/Dockerfile.bats -t git-cms-setup-tests .

# Run the tests
docker run --rm git-cms-setup-tests

echo ""
echo "✅ All setup tests passed!"
