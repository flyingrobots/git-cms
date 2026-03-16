# git-cms

<img src="./docs/images/hero.png" width="600" alt="Burnt-Out Linux Penguin" align="right" />

A serverless, database-free CMS built on Git plumbing.

> "I'm using `git push` as my API endpoint."

`git-cms` treats Git as an application substrate, not just a version-control tool. Articles live in commit messages, drafts and published state live in refs, and history falls out of the storage model instead of being layered on afterward.

Full article: [Git as CMS](https://flyingrobots.dev/git-stunts/git-cms)

## If You Came Here From The Blog Post

Use the reader-safe path first:

```bash
git clone https://github.com/flyingrobots/git-cms.git
cd git-cms
npm run setup
npm run demo
npm run sandbox
```

Then, in a second terminal:

```bash
npm run sandbox:shell

# The live Git repo is at $GIT_CMS_REPO
git -C "$GIT_CMS_REPO" for-each-ref refs/_blog/
git -C "$GIT_CMS_REPO" log refs/_blog/dev/articles/hello-world -1 --format="%B"
git -C "$GIT_CMS_REPO" log refs/_blog/dev/articles/hello-world -1 --format="tree: %T"
git -C "$GIT_CMS_REPO" log refs/_blog/dev/articles/hello-world --graph --oneline
```

Open [http://localhost:4638](http://localhost:4638) while `npm run sandbox` is running.

If you want the runnable appendix rather than the essay, use the companion doc:

- [docs/GIT_CMS_COMPANION.md](./docs/GIT_CMS_COMPANION.md)

## Runtime Modes

| Mode | Command | Repo Location | Best For |
| --- | --- | --- | --- |
| Guided demo | `npm run demo` | Disposable isolated repo inside a temporary Docker project | First contact, screencasts, fast payoff |
| Reader sandbox | `npm run sandbox` | `/data/repo` inside the container, backed by a named Docker volume | Blog readers, live tinkering, inspecting seeded history |
| Contributor dev | `npm run dev` | `/app` (the bind-mounted checkout itself) | Working on `git-cms` code |

Important distinction:

- `demo` and `sandbox` are the safe reader paths.
- `dev` is a contributor path. It intentionally uses the checkout as the Git repo.

Compatibility aliases:

- `npm run playground`
- `npm run playground:shell`
- `npm run playground:logs`

## Why This Repo Exists

The core stunt is narrow:

- drafts are commits
- article bodies live in commit messages
- published state is another ref
- publish is pointer movement
- restore writes a new commit from old content
- history is the storage model

The admin UI exists to prove the model is usable. It is not the point of the project.

## Quick Start

### 1. One-time setup

```bash
npm run setup
```

This checks Docker and Docker Compose. No sibling `git-stunts` checkout is required.

### 2. Watch the guided demo

```bash
npm run demo
```

The demo creates a disposable isolated repo, walks through draft creation, publish, and history, then cleans itself up.

### 3. Start the live sandbox

```bash
npm run sandbox
```

This starts the HTTP server on port `4638` against an isolated seeded repo. The seeded state includes:

- `hello-world` published at v1
- two later draft commits ahead of published
- enough history to make restore interesting immediately

### 4. Inspect the seeded repo

```bash
npm run sandbox:shell

git -C "$GIT_CMS_REPO" for-each-ref refs/_blog/
git -C "$GIT_CMS_REPO" log refs/_blog/dev/articles/hello-world -1 --format="%B"
git -C "$GIT_CMS_REPO" log refs/_blog/dev/articles/hello-world -1 --format="tree: %T"
git -C "$GIT_CMS_REPO" log refs/_blog/dev/articles/hello-world --graph --oneline
```

## What You Should Notice

- The article content is stored in the commit message.
- The commit points at the empty tree.
- Publishing moves `refs/_blog/dev/published/<slug>` to the current draft tip.
- Restoring an old version creates a new commit instead of rewriting history.

## Safety Notes

The reader-safe commands are safe because they do **not** use the checkout as the runtime repo:

- `npm run demo` uses an isolated disposable repo
- `npm run sandbox` uses `/data/repo` in a Docker volume
- `npm test` runs tests in Docker against temporary repos

Contributor `dev` mode is different:

- `npm run dev` bind-mounts the checkout into `/app`
- the running app uses `/app` as its Git repo
- it is meant for hacking on `git-cms`, not for casual exploration

If you are here because of the article, start with `demo` or `sandbox`, not `dev`.

## Feature Snapshot

- **Database-free:** No SQL, no NoSQL, just Git objects and refs
- **Fast-forward publish semantics:** Published refs only move to the current draft tip
- **Atomic publishes:** Publish is a CAS-protected ref update
- **Infinite history:** Every draft save is a commit
- **Optional asset encryption:** Assets can be encrypted server-side via `@git-stunts/git-cas`

## Contributor Workflow

If you are working on the codebase itself:

```bash
npm run dev
npm test
npm run test:e2e
npm run test:sandbox
```

There is also a contributor devcontainer in [.devcontainer/devcontainer.json](./.devcontainer/devcontainer.json).

## CLI And API Notes

### Publish semantics

Publishing moves the published ref to the current draft tip. If a caller supplies `sha`, it must match the current draft ref, so the parameter acts as an optimistic-concurrency token rather than an arbitrary publish target.

### Attachments

Attachments are optionally **encrypted server-side** (AES-256-GCM via `@git-stunts/git-cas`) before they are committed to the repository.

- The browser uploads base64-encoded file data to the server.
- The server resolves an encryption key from `CHUNK_ENC_KEY` or the local vault integration.
- Git receives opaque encrypted blobs when encryption is enabled.

### Commit ID scope

The current prototype assumes Git's default SHA-1 object format for HTTP endpoints that accept historical commit IDs. In practice, `/api/cms/show-version` and `/api/cms/restore` currently validate 40-character hexadecimal commit IDs.

## Optional Hardening: git-stargate

If you want a Git-native gateway around `git-cms`, pair it with **[git-stargate](https://github.com/flyingrobots/git-stargate)**.

Stargate can enforce:

- fast-forward-only pushes
- signed commits
- mirroring to public remotes

Local bootstrap example:

```bash
./scripts/bootstrap-stargate.sh ~/git/_blog-stargate.git
git remote add stargate ~/git/_blog-stargate.git
git config remote.stargate.push "+refs/_blog/*:refs/_blog/*"
```

## Where To Go Next

- **Blog companion / runnable appendix:** [docs/GIT_CMS_COMPANION.md](./docs/GIT_CMS_COMPANION.md)
- **Reader walkthrough:** [docs/GETTING_STARTED.md](./docs/GETTING_STARTED.md)
- **Command and API reference:** [QUICK_REFERENCE.md](./QUICK_REFERENCE.md)
- **Testing and safety details:** [TESTING_GUIDE.md](./TESTING_GUIDE.md)
- **Architecture and rationale:** [docs/ADR.md](./docs/ADR.md)
- **Contributor scripts:** [scripts/README.md](./scripts/README.md)

## License

Copyright © 2026 James Ross. This software is licensed under the [Apache License](./LICENSE), Version 2.0
