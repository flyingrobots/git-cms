# syntax=docker/dockerfile:1

# Base stage
FROM node:20-slim AS base
ENV NODE_ENV=production
# Install Git (Required for git-cms)
RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# Deps stage
FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm ci --include=dev

# Development stage
FROM base AS dev
ENV NODE_ENV=development
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Configure Git for Dev
RUN git config --global user.email "dev@git-cms.local"
RUN git config --global user.name "Git CMS Dev"
RUN git config --global init.defaultBranch main
CMD ["npm", "run", "serve"]

# Test stage
FROM base AS test
ENV NODE_ENV=test
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Configure Git for Test
RUN git config --global user.email "bot@git-cms.local"
RUN git config --global user.name "Git CMS Bot"
RUN git config --global init.defaultBranch main
CMD ["npm", "run", "test:local"]
