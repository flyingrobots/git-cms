#!/usr/bin/env bash
set -e

echo "🐳 Running tests in Docker..."
docker compose run --rm test