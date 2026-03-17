# Scripts

Helper scripts for working with git-cms safely.

`setup.sh` is tested via `test/setup.bats`. Other scripts are manually verified.

## Available Scripts

### `quickstart.sh` (Recommended for first-time users)

Interactive menu for trying out git-cms safely. Checks prerequisites and guides you through:
- Running the guided demo
- Starting the seeded sandbox server
- Opening a shell in the running sandbox
- Running tests
- Starting contributor dev mode
- Viewing logs
- Cleaning up

**Usage:**

```bash
./scripts/quickstart.sh
```

### `demo.sh` (See it in action)

Automated demo that showcases the key features against an isolated disposable repo:
- Creating and editing articles
- Publishing with atomic ref updates
- Viewing Git's perspective on the data
- Exploring version history

**Usage:**

```bash
./scripts/demo.sh
```

This is great for:
- Understanding how git-cms works before diving in
- Recording screencasts or demos
- Verifying the system is working correctly

### `prepare-playground.sh` / `start-playground.sh`

These scripts power the long-lived reader sandbox.

- `prepare-playground.sh` initializes a repo, configures Git identity, and seeds `hello-world` history when the playground repo is empty.
- `start-playground.sh` prepares the repo and then starts the HTTP server against it.

### `capture-cms-footage.mjs` / `start-media-sandbox.sh`

These scripts power repeatable browser footage for the blog post.

- `capture-cms-footage.mjs` runs a dedicated Playwright capture flow against a fresh media sandbox.
- `start-media-sandbox.sh` starts an isolated seeded sandbox on a dedicated port and tears it down afterward.

Run:

```bash
npm run capture:cms
```

Outputs land in `docs/media/generated/git-cms/`.

### `render-git-cas-vhs.sh`

Renders the `git-cas` terminal GIFs used in the broader `Git Stunts` series media pipeline.

Run:

```bash
npm run capture:git-cas:vhs
npm run capture:git-cas:tui
```

The script builds a synthetic `/tmp/git-stunts-media` workspace so the rendered media does not expose local checkout paths.

See: [docs/media/README.md](../docs/media/README.md)

### `bootstrap-stargate.sh` (Advanced: Git Gateway)

Creates a local "Stargate" gateway repository with Git hooks that enforce:
- Fast-forward-only updates (no force pushes)
- Optional GPG signature verification
- Mirroring to public repositories

**Usage:**

```bash
./scripts/bootstrap-stargate.sh ~/git/_blog-stargate.git
git remote add stargate ~/git/_blog-stargate.git
git config remote.stargate.push "+refs/_blog/*:refs/_blog/*"
```

See: [git-stargate](https://github.com/flyingrobots/git-stargate)

---

## Safety First

Reader-facing scripts are designed to keep Git activity away from the checkout:
- `demo.sh` uses an isolated disposable repo
- `sandbox` uses a named Docker volume mounted at `/data/repo`

Contributor `dev` mode is different:
- it bind-mounts the checkout into `/app`
- the running server uses `/app` as its Git repo
- it is for working on `git-cms`, not casual exploration

**Never run git-cms commands in repositories you care about until you understand what's happening.**

---

## Testing Scripts

### `test/run-docker.sh`

Runs the full test suite in Docker. Called automatically by `npm test`.

**Usage:**

```bash
./test/run-docker.sh
# OR
npm test
```

---

## More Info

- [Getting Started Guide](../docs/GETTING_STARTED.md)
- [Architecture Decision Record](../docs/ADR.md)
- [Main README](../README.md)
