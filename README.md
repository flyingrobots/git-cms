# git-cms

<img src="./docs/images/hero.png" width="600" alt="Burnt-Out Linux Penguin" align="right" />

A serverless, database-free CMS built on Git plumbing.

> "I'm using `git push` as my API endpoint."

**git-cms** treats your Git repository as a distributed, cryptographically verifiable database. Instead of files, it stores content as commit messages on "empty trees," creating a linear, append-only ledger for articles, comments, or any other structured data.

## Quick Start (Docker - Safe!)

### One-Time Setup

```bash
# Clone this repo
git clone https://github.com/flyingrobots/git-cms.git
cd git-cms

# Run setup (checks Docker + validates environment)
npm run setup
```

### Try It Out

```bash
# Option 1: Guided walkthrough of key features
npm run demo

# Option 2: Interactive menu (start server, run tests, open shell)
npm run quickstart

# Option 3: Just start the server
npm run dev
# Open http://localhost:4638
```

**Everything runs in Docker - completely safe for your local Git setup.**

## ⚠️ SAFETY WARNING

**This project manipulates Git repositories at a low level. ALWAYS use Docker for testing.**

The tests create, destroy, and manipulate Git repositories. Running low-level plumbing commands on your host filesystem is risky - a typo could affect your local Git setup. That's why we built Docker isolation into everything.

**Read more:** [TESTING_GUIDE.md](./TESTING_GUIDE.md) | [docs/GETTING_STARTED.md](./docs/GETTING_STARTED.md) | [QUICK_REFERENCE.md](./QUICK_REFERENCE.md) | [docs/CONTENT_ID_POLICY.md](./docs/CONTENT_ID_POLICY.md)

## Features

- **Database-Free:** No SQL, No NoSQL. Just Git objects (Merkle DAG).
- **Fast-Forward Only:** Enforces strict linear history for provenance.
- **Atomic Publishes:** "Publishing" is just a pointer update (CAS).
- **Infinite History:** Every draft save is a commit. Scrub back to any point in time.

## Development

### Start the Server (Dev Mode)
```bash
npm run dev
# OR
docker compose up app
```
The API and Admin UI will be available at `http://localhost:4638`.

### Run Tests
```bash
npm test
# OR
docker compose run --rm test
```

## Installation

```bash
# From source (recommended until npm publish):
git clone https://github.com/flyingrobots/git-cms.git
cd git-cms
npm link

# After publish, global install will work:
# npm install -g git-cms
```

## Usage

### 1. Initialize a "Stargate" (The Gateway)

To use `git-cms` securely, you should pair it with **[git-stargate](https://github.com/flyingrobots/git-stargate)**.

Stargate is a minimal, bash-based Git gateway that enforces:
- **Fast-Forward Only:** No force pushes allowed.
- **Signed Commits:** Every update must be cryptographically signed by an authorized key.
- **Mirroring:** Validated updates are automatically mirrored to public repositories (like GitHub).

```bash
# Bootstrap a local stargate for testing
./scripts/bootstrap-stargate.sh ~/git/_blog-stargate.git

# Link it
git remote add stargate ~/git/_blog-stargate.git
git config remote.stargate.push "+refs/_blog/*:refs/_blog/*"
```

### 2. Encryption & Attachments

Attachments are **encrypted client-side** (AES-256-GCM) before they are ever committed to the repository. 

- Keys are managed securely via your OS Keychain (macOS/Linux/Windows).
- The "Stargate" receives only opaque, encrypted blobs.
- This effectively gives you "Row Level Security" on a file system—only users with the key can decrypt the assets.

### 3. Write a Draft
Content is stored in `refs/_blog/articles/<slug>`.

```bash
echo "# Hello World" | git cms draft hello-world "My First Post"
```

### 4. List Articles
```bash
git cms list
# -> refs/_blog/articles/hello-world My First Post
```

### 5. Publish
Publishing fast-forwards `refs/_blog/published/<slug>` to match the draft.

```bash
git cms publish hello-world
```

### 6. Unpublish / Revert

```bash
# Remove from published, keep as unpublished draft
git cms unpublish hello-world

# Revert to draft state
git cms revert hello-world
```

### 7. Layout Version / Migrate

```bash
# Check repo vs codebase layout version
git cms layout-version

# Run pending layout migrations (forward-only, idempotent)
git cms migrate
```

## Where to Go Next

- **New user?** Start with [`docs/GETTING_STARTED.md`](./docs/GETTING_STARTED.md)
- **Operator / API user?** See [`QUICK_REFERENCE.md`](./QUICK_REFERENCE.md) for all CLI commands and HTTP endpoints
- **Architecture / rationale?** Read [`docs/ADR.md`](./docs/ADR.md) and [`docs/LAYOUT_SPEC.md`](./docs/LAYOUT_SPEC.md)

## License

Copyright © 2026 James Ross. This software is licensed under the [Apache License](./LICENSE), Version 2.0
