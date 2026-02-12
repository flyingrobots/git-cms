# syntax=docker/dockerfile:1

# Base stage
FROM node:22-slim AS base
ENV NODE_ENV=production
RUN apt-get update && apt-get install -y --no-install-recommends git && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# Deps stage
FROM base AS deps
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json* ./
RUN npm ci --include=dev

# Development stage
FROM base AS dev
ENV NODE_ENV=development
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN git config --global user.email "dev@git-cms.local" \
 && git config --global user.name "Git CMS Dev" \
 && git config --global init.defaultBranch main
CMD ["npm", "run", "serve"]

# Test stage
FROM base AS test
ENV NODE_ENV=test
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN git config --global user.email "bot@git-cms.local" \
 && git config --global user.name "Git CMS Bot" \
 && git config --global init.defaultBranch main
CMD ["npm", "run", "test:local"]
