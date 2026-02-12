# Getting Started with Git CMS

This quick guide is the lightweight entry point. For the full walkthrough, use [`docs/GETTING_STARTED.md`](docs/GETTING_STARTED.md).

---

## Prerequisites

- Git
- Node.js 22+
- Docker Desktop (recommended for safe testing)

---

## Installation

### Option A: Local CLI Install

```bash
git clone https://github.com/flyingrobots/git-cms.git
cd git-cms
npm install
npm link
```

### Option B: Docker (Recommended)

```bash
git clone https://github.com/flyingrobots/git-cms.git
cd git-cms
npm run setup
npm run dev
```

Open the UI at [http://localhost:4638/](http://localhost:4638/).

---

## First Article

1. Click `+ New Article`.
2. Set a slug like `my-first-post`.
3. Add title + body content.
4. Click `Save Draft`.
5. Click `Publish` when ready.

---

## CLI Basics

```bash
# Draft reads content from stdin
echo "# Hello" | git cms draft hello-world "Hello World"

# List drafts
git cms list

# Publish
git cms publish hello-world

# Show article
git cms show hello-world
```

---

## Safety Notes

- Prefer Docker workflows while learning.
- Use a dedicated test repository for local CLI experimentation.
- Avoid running low-level Git plumbing in repositories you care about.

See [`TESTING_GUIDE.md`](TESTING_GUIDE.md) for safety and cleanup procedures.
