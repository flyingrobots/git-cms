# Getting Started with Git CMS

**⚠️ IMPORTANT: This project manipulates Git repositories at a low level. Always use Docker for testing to protect your local Git setup.**

---

## TL;DR

```bash
git clone https://github.com/flyingrobots/git-cms.git
cd git-cms
npm run setup  # One-time: clones dependencies, checks Docker
npm run demo   # See it in action!
```

---

## Quick Start (Docker - Recommended)

The safest way to try git-cms is in Docker, which provides complete isolation from your host system.

### Prerequisites

- Docker & Docker Compose installed
- 5 minutes of curiosity

### Step 1: Clone and Run Setup

```bash
# Clone the repository
git clone https://github.com/flyingrobots/git-cms.git
cd git-cms

# Run one-time setup (clones git-stunts, checks Docker)
npm run setup
```

### Step 2: Try It Out

**Option A: Watch the Demo (Recommended First Time)**
```bash
npm run demo
```
This shows you how git-cms works step-by-step.

**Option B: Start the Server**
```bash
npm run dev
# OR
docker compose up app
```

**What just happened?**
- Docker built a containerized environment with Node 20 + Git
- Created an isolated Git repository inside the container
- Started the HTTP server on port 4638

### Step 3: Open the Admin UI

Open your browser to: **http://localhost:4638**

You should see the Git CMS Admin interface with:
- Sidebar showing "Articles" and "Published"
- A form to create new articles
- Live preview of your content

### Step 4: Create Your First Article

**Option A: Via the Web UI**

1. In the admin UI, enter:
   - **Slug:** `hello-world`
   - **Title:** `My First Post`
   - **Body:**
     ```markdown
     # Hello World

     This is my first article using Git as a CMS!

     ## How Cool Is This?

     Every save creates a Git commit. Every publish is an atomic ref update.
     ```

2. Click **"Save Draft"**
   - Watch the terminal logs show the Git commit being created
   - The article is now at `refs/_blog/articles/hello-world`

3. Click **"Publish"**
   - This fast-forwards `refs/_blog/published/hello-world` to match the draft
   - The article is now "live"

**Option B: Via the CLI (Inside Docker)**

```bash
# Open a shell inside the running container
docker compose exec app sh

# Create a draft
echo "# Hello World" | node bin/git-cms.js draft hello-world "My First Post"

# List all drafts
node bin/git-cms.js list

# Publish it
node bin/git-cms.js publish hello-world

# Read it back
node bin/git-cms.js show hello-world

# Exit the container
exit
```

### Step 5: Explore the Git Magic

The coolest part: this is all just Git under the hood.

```bash
# Enter the container
docker compose exec app sh

# Check what Git sees
git log --all --oneline --graph

# Look at the refs namespace
git for-each-ref refs/_blog/

# Read a commit message (this is your article!)
git log refs/_blog/articles/hello-world -1 --format="%B"

# Exit
exit
```

**What you'll see:**
- Your article stored as a commit message
- Commits pointing to the "empty tree" (no files touched!)
- Refs acting as pointers to "current" versions

---

## Understanding the Safety Model

### Why Docker is Essential

Git CMS uses **low-level Git plumbing commands** like:
- `git commit-tree` (creates commits on empty trees)
- `git update-ref` (atomic ref updates)
- `git hash-object` (writes blobs directly)

While these operations are safe *when used correctly*, running tests or experiments on your host machine could:
- Create unexpected refs in your current repository
- Write test blobs to `.git/objects/`
- Modify your Git configuration

**Docker provides complete isolation** - the container has its own filesystem, its own Git repos, and can be destroyed without a trace.

### What's Safe?

✅ **Running in Docker:** Completely safe. Destroy the container anytime with `docker compose down -v`

✅ **Creating a dedicated test repo:** If you want to try the CLI locally:
```bash
mkdir ~/git-cms-playground
cd ~/git-cms-playground
git init
# Now use git-cms here - it's isolated from your other repos
```

❌ **Running tests in your git-cms clone on host:** Not recommended (see next section)

❌ **Running git-cms commands in your active project repos:** NEVER do this until you understand what's happening

---

## Running Tests

Tests create and destroy temporary Git repositories. **Always use Docker.**

```bash
# Run all tests (automatically uses Docker)
npm test

# This is equivalent to:
./test/run-docker.sh

# Which runs:
docker compose run --rm test
```

**What the tests do:**
- Create temporary repos in `/tmp/git-cms-test-*`
- Test all CRUD operations (create, read, update, publish)
- Test asset encryption and chunking
- Clean up afterward

**Never run tests on your host** unless you're comfortable with low-level Git operations.

---

## Advanced: Local CLI Installation

If you want to use git-cms as a command-line tool on your host machine, you can install it globally - **but only use it in dedicated Git repositories.**

### Install Globally

```bash
npm install -g git-cms
# OR, from source:
cd git-cms
npm link
```

### Create a Dedicated Blog Repo

```bash
# Create a fresh repo for your blog
mkdir ~/my-blog
cd ~/my-blog
git init

# Configure Git
git config user.name "Your Name"
git config user.email "you@example.com"

# Now use git-cms safely
echo "# My First Post" | git cms draft hello-world "Hello World"
git cms publish hello-world
```

**Critical:** Only use `git cms` commands in repositories where:
- You understand you're creating commits with empty trees
- You're okay with refs in `refs/_blog/*` namespace
- You've read the docs and understand what's happening

---

## How to Clean Up

### Stop Docker

```bash
# Stop containers
docker compose down

# Stop containers AND delete all data (fresh start)
docker compose down -v
```

### Uninstall CLI

```bash
npm uninstall -g git-cms
# OR, if linked:
cd git-cms && npm unlink
```

### Delete a Test Blog Repo

```bash
# If you created ~/my-blog for testing:
rm -rf ~/my-blog
```

---

## What's Actually Happening? (The "Stunt" Explained)

Traditional CMS architecture:
```
Article → JSON → POST /api → Parse → INSERT INTO posts → Database
```

Git CMS architecture:
```
Article → Commit Message → git commit-tree → .git/objects/ → Git
```

### The Empty Tree Trick

Every article commit points to Git's "empty tree" (`4b825dc642cb6eb9a060e54bf8d69288fbee4904`):

```bash
# Traditional Git commit
git add article.md          # Stage file
git commit -m "Add article" # Commit references changed files

# Git CMS commit
git commit-tree 4b825dc... -m "Article content here" # No files touched!
```

This means:
- Your working directory stays clean
- All content lives in `.git/objects/` and `.git/refs/`
- No merge conflicts from content changes
- Every save is a commit (infinite history)

### Publishing is Just a Pointer

```bash
# Draft ref points to latest commit
refs/_blog/articles/hello-world → abc123def...

# Publishing copies the pointer
refs/_blog/published/hello-world → abc123def...

# No new commits created!
# Atomic operation via git update-ref
```

---

## Next Steps

Once you're comfortable with the basics:

1. **Read the ADR** (`docs/ADR.md`) for deep architectural details
2. **Try the Stargate Gateway** (enforces fast-forward only + GPG signing)
   ```bash
   ./scripts/bootstrap-stargate.sh ~/git/_blog-stargate.git
   git remote add stargate ~/git/_blog-stargate.git
   git config remote.stargate.push "+refs/_blog/*:refs/_blog/*"
   git push stargate
   ```
3. **Experiment with encryption** (see below)
4. **Explore the Lego Blocks** in `../git-stunts/` (plumbing, codec, cas, vault, empty-graph)

---

## Asset Encryption (Optional)

Assets (images, PDFs) can be encrypted client-side before they touch Git.

### Setup (macOS)

```bash
# Generate a 256-bit key
openssl rand -base64 32

# Store in macOS Keychain
security add-generic-password -s git-cms-dev-enc-key -a $USER -w "<paste-key-here>"
```

### Setup (Linux)

```bash
# Generate key
openssl rand -base64 32

# Store in GNOME Keyring (if available)
secret-tool store --label="Git CMS Dev Key" service git-cms-dev-enc-key
# Paste key when prompted
```

### Test Encryption

```bash
# Inside Docker container
docker compose exec app sh

# Upload an encrypted file (if you've set up Vault)
node bin/git-cms.js upload hello-world /path/to/image.png

# The blob in Git is encrypted ciphertext
# Only you (with the key) can decrypt it
```

---

## Troubleshooting

### "Permission denied" when running Docker

**Solution:** Make sure Docker Desktop is running, or add your user to the `docker` group:
```bash
sudo usermod -aG docker $USER
# Log out and back in
```

### "Port 4638 already in use"

**Solution:** Change the port in `docker-compose.yml`:
```yaml
ports:
  - "5000:4638"  # Maps localhost:5000 → container:4638
```

### "Cannot find module '@git-stunts/...'"

**Solution:** The Lego Blocks need to be in the parent directory:
```bash
# Ensure directory structure:
~/git/
  git-cms/        ← You are here
  git-stunts/     ← Lego Blocks should be here
```

If you only cloned `git-cms`, you need to clone `git-stunts` too:
```bash
cd ~/git
git clone https://github.com/flyingrobots/git-stunts.git
cd git-cms
docker compose build  # Rebuild with Lego Blocks
```

### "Tests fail immediately"

**Cause:** You might be running tests on your host without Docker.

**Solution:** Always use:
```bash
npm test  # Uses Docker automatically
```

---

## FAQ

### Is this production-ready?

**For small personal blogs:** Yes, with caveats.
**For high-traffic sites:** No.

This is an educational project demonstrating Git's capabilities. Use it to:
- Learn Git internals
- Build prototype CMS systems
- Understand content-addressable storage

Don't use it for:
- Mission-critical applications
- Sites with >100 concurrent writers
- Anything requiring complex queries or full-text search

### Can I use this with GitHub?

Yes! Use the **git-stargate** gateway to:
1. Enforce fast-forward only (no force pushes)
2. Verify GPG signatures
3. Mirror to GitHub automatically

See: https://github.com/flyingrobots/git-stargate

### What about GDPR / right to be forgotten?

Git's immutability conflicts with GDPR Article 17. Mitigation strategies:
- Use client-side encryption and delete keys (content becomes unreadable)
- Legal argument: journalistic/archival "legitimate interest"
- Don't store PII in articles

Consult a lawyer before using this for user-generated content in the EU.

### Why not use a real database?

That's the point. This is a "Git Stunt" - using Git in unconventional ways to understand:
- How content-addressable storage works
- How to build systems from first principles
- What Git's plumbing can *actually* do

You're supposed to walk away thinking "I would never use this in production, but now I understand Git (and databases) way better."

---

## Getting Help

- **Issues:** https://github.com/flyingrobots/git-cms/issues
- **Blog Series:** https://flyingrobots.dev/posts/git-stunts
- **ADR:** `docs/ADR.md` (comprehensive architecture docs)

---

## One Last Warning

Git CMS is a **thought experiment** that happens to work. It's designed to teach you how Git's plumbing works by building something that shouldn't exist.

If you're considering using this in production:
1. Read the entire ADR (`docs/ADR.md`)
2. Understand every decision and tradeoff
3. Run it in Docker for at least a month
4. Consider whether a traditional database might be... better

Then, if you're still convinced, **go for it**. Just remember: when you tell people you're using Git as your database, don't say I didn't warn you.

Have fun, and remember: _"You know what? Have fun."_ — Linus (probably)
