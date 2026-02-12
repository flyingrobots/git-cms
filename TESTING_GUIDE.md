# How to Safely Test Git CMS

This guide explains how to try out git-cms without any risk to your local Git setup or existing repositories.

## TL;DR - Just Show Me The Commands

```bash
# One-time setup
git clone https://github.com/flyingrobots/git-cms.git
cd git-cms
npm run setup

# Then use any of these:
npm run demo         # Automated demo
npm run quickstart   # Interactive menu
npm run dev          # Start server
```

**Everything runs in Docker. Your host system is safe.**

---

## Prerequisites

### Required Directory Structure

Only this repository is required:

```text
~/git/
  └── git-cms/           ← This repository
```

### Clone and Setup

```bash
cd ~/git  # Or wherever you want to keep these

# Clone git-cms
git clone https://github.com/flyingrobots/git-cms.git
cd git-cms

# Run setup (checks Docker prerequisites)
npm run setup
```

**What `npm run setup` does:**
- Checks Docker is installed and running
- Verifies Docker Compose is available
- Confirms the npm-package dependency model (no sibling repo required)

After setup, your structure will be:

```text
~/git/
  └── git-cms/       ← You are here
```

### Install Docker

- **macOS:** [Docker Desktop](https://docs.docker.com/desktop/install/mac-install/)
- **Linux:** [Docker Engine](https://docs.docker.com/engine/install/)
- **Windows:** [Docker Desktop](https://docs.docker.com/desktop/install/windows-install/)

Verify Docker is working:

```bash
docker --version
docker compose version
```

---

## Safety Guarantees

### What's Protected

✅ **Your host Git repositories** - Never touched
✅ **Your Git global config** - Never modified
✅ **Your filesystem** - Only the git-cms directory is mounted (read-only for git operations)
✅ **Your Git history** - Tests run in isolated containers

### How Docker Provides Isolation

1. **Separate Filesystem**: The container has its own isolated filesystem
2. **Separate Git Config**: Container sets its own `user.name` and `user.email`
3. **Temporary Repos**: Tests create repos in `/tmp` inside the container
4. **Easy Cleanup**: `docker compose down -v` destroys everything

---

## Testing Scenarios

### Scenario 1: Interactive Quick Start (Recommended)

```bash
cd git-cms
./scripts/quickstart.sh
```

**What it does:**
- Checks Docker prerequisites
- Provides a menu with options:
  1. Start the HTTP server
  2. Run tests
  3. Open a shell
  4. View logs
  5. Clean up

**Safe because:** Everything runs in Docker containers that are destroyed after use.

---

### Scenario 2: Automated Demo

```bash
cd git-cms
./scripts/demo.sh
```

**What it does:**
- Creates a demo article
- Shows how Git stores the data
- Demonstrates publishing
- Shows version history
- Explains the "empty tree" trick

**Safe because:** Runs entirely in a Docker container with a temporary Git repo.

---

### Scenario 3: HTTP Server + Web UI

```bash
cd git-cms
npm run dev
# OR
docker compose up app
```

Open your browser to: **[http://localhost:4638](http://localhost:4638)**

**What it does:**
- Starts Node.js HTTP server in Docker
- Serves the admin UI
- Creates a Git repo inside the container at `/app/.git`

**Safe because:**
- Repository is inside the container, not on your host
- Stopping the container (`Ctrl+C` or `docker compose down`) stops all Git operations
- No risk to your local repositories

**To clean up:**

```bash
docker compose down -v  # Removes container and volumes
```

---

### Scenario 4: CLI Commands (Inside Container)

```bash
cd git-cms
docker compose run --rm app sh

# Now you're in the container
node bin/git-cms.js draft hello-world "My First Post"
node bin/git-cms.js list
node bin/git-cms.js publish hello-world

# Explore what Git sees
git log --all --oneline --graph
git for-each-ref refs/_blog/

exit
```

**Safe because:** You're running commands inside the container, which has its own isolated Git environment.

---

### Scenario 5: Run Tests

```bash
cd git-cms
npm test
# OR
./test/run-docker.sh
# OR
docker compose run --rm test
```

**What it does:**
- Runs Vitest integration tests
- Creates temporary Git repos in `/tmp`
- Tests CRUD operations, encryption, API endpoints
- Cleans up after completion

**Safe because:** All tests run in an isolated Docker container with temporary repos.

---

## Advanced: Local Installation (Not Recommended Initially)

If you understand what git-cms does and want to install it globally on your host:

```bash
npm install -g git-cms
# OR
cd git-cms && npm link
```

**⚠️ WARNING:** Only use git-cms in dedicated repositories:

```bash
# Create a fresh repo for testing
mkdir ~/git-cms-playground
cd ~/git-cms-playground
git init

# Configure
git config user.name "Your Name"
git config user.email "you@example.com"

# Now safe to use
echo "# Test" | git cms draft test-post "Test Post"
```

**NEVER run `git cms` commands in:**
- Your active project repositories
- Repositories with uncommitted work
- Any repository you care about until you understand what's happening

---

## What Could Go Wrong? (And Why It Won't)

### Myth: "Git CMS will mess up my local Git"

**Reality:** If you use Docker (as recommended), git-cms never touches your host Git installation. It runs in a container with its own Git binary, config, and repositories.

### Myth: "Tests will create files all over my filesystem"

**Reality:** Tests run in Docker containers with temporary directories. When the container stops, everything is cleaned up automatically.

### Myth: "I'll accidentally run commands in my project repo"

**Reality:** The CLI checks what directory you're in. If you're in a repo with important files, you'll notice. Plus, git-cms operates in the `refs/_blog/*` namespace, separate from your normal branches.

### Actual Risk: Running Tests Outside Docker

**IF** you run `npm run test:local` (bypassing Docker), tests WILL create temporary repos in your `/tmp` directory. While these are deleted after, there's a non-zero risk if tests fail mid-execution.

**Solution:** Always use `npm test` which automatically uses Docker.

---

## Cleanup

### Remove Everything

```bash
# Stop containers
cd git-cms
docker compose down

# Remove containers AND volumes (fresh start)
docker compose down -v

# Remove images (if you want to reclaim disk space)
docker rmi $(docker images | grep git-cms | awk '{print $3}')
```

### Uninstall CLI (if installed globally)

```bash
npm uninstall -g git-cms
# OR
cd git-cms && npm unlink
```

---

## Troubleshooting

### "Cannot find module '@git-stunts/...'"

**Cause:** npm dependencies were not installed correctly, or lockfile integrity regressed.

**Solution:**

```bash
# Validate lockfile/package integrity
npm run check:deps

# Reinstall dependencies cleanly (host)
rm -rf node_modules
npm ci

# If you're troubleshooting inside Docker, reinstall there too:
# docker compose run --rm app sh -c "npm ci"

# Last resort (only when lockfile/base image changed): rebuild images
docker compose build --no-cache
```

### "Port 4638 already in use"

**Solution:** Either stop the process using that port, or change the port in `docker-compose.yml`:

```yaml
ports:
  - "5000:4638"  # Maps localhost:5000 → container:4638
```

### "Docker daemon not running"

**Solution:** Start Docker Desktop (macOS/Windows) or start the Docker service (Linux):

```bash
# Linux
sudo systemctl start docker
```

### Tests fail with "EACCES: permission denied"

**Cause:** Docker doesn't have permission to bind volumes.

**Solution:**
- On macOS/Windows: Check Docker Desktop → Settings → Resources → File Sharing
- On Linux: Ensure your user is in the `docker` group

---

## What's Next?

Once you're comfortable with the basics:

1. **Read the Architecture Decision Record**: `docs/ADR.md`
   - Comprehensive technical documentation
   - Design decisions and tradeoffs
   - Full system architecture

2. **Explore the Code**: `src/lib/CmsService.js`
   - See how the Lego Blocks are composed
   - Understand the domain orchestration
   - Study the Git plumbing operations

3. **Set Up Stargate Gateway**: `./scripts/bootstrap-stargate.sh`
   - Enforces fast-forward only
   - Verifies GPG signatures
   - Mirrors to public repositories

4. **Experiment with Encryption**: See `docs/GETTING_STARTED.md`
   - Client-side AES-256-GCM encryption
   - OS keychain integration
   - Row-level access control

---

## Remember

Git CMS is a **learning project** and **thought experiment**. It's designed to teach you:
- How Git's plumbing actually works
- Content-addressable storage patterns
- Building unconventional systems from first principles

Use it to learn, experiment, and explore. Don't use it in production unless you **really** understand what you're getting into.

Have fun! 🎉
