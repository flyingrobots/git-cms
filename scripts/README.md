# Scripts

Helper scripts for working with git-cms safely.

`setup.sh` is tested via `test/setup.bats`. Other scripts are manually verified.

## Available Scripts

### `quickstart.sh` (Recommended for first-time users)

Interactive menu for trying out git-cms in Docker. Checks prerequisites and guides you through:
- Starting the HTTP server
- Running tests
- Opening a shell in the container
- Viewing logs
- Cleaning up

**Usage:**

```bash
./scripts/quickstart.sh
```

### `demo.sh` (See it in action)

Automated demo that showcases the key features:
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

All scripts that interact with Git are designed to run in Docker containers to protect your host system. The container provides:
- Isolated Git environment
- Temporary repositories
- No risk to your existing Git repos

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
