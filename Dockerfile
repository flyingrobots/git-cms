# syntax=docker/dockerfile:1

# Base stage
FROM node:20-slim AS base
ENV NODE_ENV=production
RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# IMPORTANT: This Dockerfile expects the build context to be the PARENT directory
# so it can access both git-cms/ and git-stunts/ directories.
# See docker-compose.yml which sets context: .. and dockerfile: git-cms/Dockerfile
#
# Directory structure expected:
#   ~/git/
#     git-cms/       ← This repo
#     git-stunts/    ← Lego blocks repo

# Deps stage
FROM base AS deps
# Copy the lego blocks first so npm install can link them
COPY git-stunts /git-stunts
COPY git-cms/package.json git-cms/package-lock.json* ./
RUN npm ci --include=dev

# Development stage
FROM base AS dev
ENV NODE_ENV=development
COPY --from=deps /git-stunts /git-stunts
COPY --from=deps /app/node_modules ./node_modules
COPY git-cms .
RUN git config --global user.email "dev@git-cms.local"
RUN git config --global user.name "Git CMS Dev"
RUN git config --global init.defaultBranch main
CMD ["npm", "run", "serve"]

# Test stage
FROM base AS test
ENV NODE_ENV=test
COPY --from=deps /git-stunts /git-stunts
COPY --from=deps /app/node_modules ./node_modules
COPY git-cms .
RUN git config --global user.email "bot@git-cms.local"
RUN git config --global user.name "Git CMS Bot"
RUN git config --global init.defaultBranch main
CMD ["npm", "run", "test:local"]