#!/usr/bin/env bash
set -e

# Build
docker build -f Dockerfile.test -t git-cms-test .

# Run
docker run --rm git-cms-test
