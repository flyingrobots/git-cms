# Git CMS Quick Reference

**One-page cheat sheet for Git CMS commands and concepts.**

---

## 🚀 First Time Setup

```bash
git clone https://github.com/flyingrobots/git-cms.git
cd git-cms
npm run setup  # Clones git-stunts, checks Docker
npm run demo   # See it work!
```

---

## 📦 npm Commands

| Command | Purpose |
|---------|---------|
| `npm run setup` | One-time setup (clones dependencies) |
| `npm run demo` | Automated demo with explanations |
| `npm run quickstart` | Interactive menu |
| `npm run dev` | Start HTTP server (http://localhost:4638) |
| `npm test` | Run integration tests |
| `npm run test:setup` | Run setup script tests (BATS) |

---

## 🔧 CLI Commands (Inside Container)

```bash
# Enter container
docker compose run --rm app sh

# Draft an article
echo "# My Post" | node bin/git-cms.js draft my-slug "My Title"

# List articles
node bin/git-cms.js list
node bin/git-cms.js list --kind=published

# Publish an article
node bin/git-cms.js publish my-slug

# Read an article
node bin/git-cms.js show my-slug

# Exit container
exit
```

---

## 🎯 The Core Concept

### Traditional CMS
```
Article → Database Row → SQL Query
```

### Git CMS
```
Article → Commit Message → git log
```

**The Trick:** Commits point to the "empty tree" so no files are changed.

---

## 📂 Key Refs (Git References)

| Ref | Purpose |
|-----|---------|
| `refs/_blog/articles/<slug>` | Draft version (moves forward with each save) |
| `refs/_blog/published/<slug>` | Published version (fast-forward only) |
| `refs/_blog/chunks/<slug>@current` | Encrypted asset manifest |

---

## 🔍 Inspecting with Git

```bash
# View all CMS refs
git for-each-ref refs/_blog/

# Read an article (it's just a commit message!)
git log refs/_blog/articles/hello-world -1 --format="%B"

# See version history
git log refs/_blog/articles/hello-world --oneline

# Check what tree the commit points to
git log refs/_blog/articles/hello-world -1 --format="%T"
# → 4b825dc... (the empty tree!)

# View the DAG
git log --all --graph --oneline refs/_blog/
```

---

## 🏗️ Architecture (Lego Blocks)

```
git-cms
  └─ CmsService (orchestrator)
       ├─ @git-stunts/plumbing (Git commands)
       ├─ @git-stunts/trailer-codec (RFC 822 trailers)
       ├─ @git-stunts/empty-graph (commits on empty tree)
       ├─ @git-stunts/cas (encrypted asset storage)
       └─ @git-stunts/vault (OS keychain for secrets)
```

---

## 📄 Commit Message Format

```
# My Article Title

This is the article body.

Status: draft
Author: James Ross
Tags: git, cms
Slug: my-article
UpdatedAt: 2026-01-11T12:34:56Z
```

**Trailers** (key-value pairs at end) are parsed by `@git-stunts/trailer-codec`.

---

## 🔐 Publishing Workflow

```bash
# Save draft (creates commit)
echo "# Post" | git cms draft my-post "Title"
→ refs/_blog/articles/my-post points to abc123

# Publish (copies pointer)
git cms publish my-post
→ refs/_blog/published/my-post points to abc123

# Edit (creates new commit)
echo "# Updated" | git cms draft my-post "Title"
→ refs/_blog/articles/my-post points to def456
→ refs/_blog/published/my-post still points to abc123
```

Publishing is **atomic** and **fast-forward only**.

---

## 🛡️ Safety

**Everything runs in Docker by default.**

- ✅ Your host Git repos are never touched
- ✅ Tests run in isolated containers
- ✅ Easy cleanup: `docker compose down -v`

**Never** run `git cms` commands in repos you care about until you understand what's happening.

---

## 📚 Documentation

| File | Purpose |
|------|---------|
| `README.md` | Overview + quick start |
| `TESTING_GUIDE.md` | How to test safely |
| `docs/GETTING_STARTED.md` | Comprehensive walkthrough |
| `docs/ADR.md` | **Architecture Decision Record** (deep dive) |
| `test/README.md` | Test suite documentation |
| `scripts/README.md` | Script documentation |
| `QUICK_REFERENCE.md` | This file! |

---

## 🐛 Troubleshooting

### "Cannot find module '@git-stunts/...'"
```bash
npm run setup  # Clones git-stunts automatically
```

### "Port 4638 already in use"
Edit `docker-compose.yml`:
```yaml
ports:
  - "5000:4638"  # Use port 5000 instead
```

### "Docker daemon not running"
Start Docker Desktop (macOS/Windows) or `sudo systemctl start docker` (Linux).

---

## 🎓 Key Concepts to Understand

1. **Empty Tree:** `4b825dc642cb6eb9a060e54bf8d69288fbee4904` is Git's canonical empty tree. All commits point here.

2. **Trailers:** RFC 822 key-value pairs at end of commit messages (like `Signed-off-by` in Linux kernel).

3. **Fast-Forward Only:** Published refs can only move forward in history, never rewrite.

4. **Content Addressability:** Assets stored by SHA-1 hash, automatic deduplication.

5. **Compare-and-Swap (CAS):** `git update-ref` is atomic at ref level, prevents concurrent write conflicts.

---

## 💡 The "Linus Threshold"

This project exists at the edge of technical sanity. It's designed to make you think:

> "I would never use this in production, but now I understand Git way better."

If you're considering production use:
- Read `docs/ADR.md` cover to cover
- Understand every tradeoff
- Run in Docker for months
- Ask yourself: "Would a database be better?" (probably yes)

Then, if you're still convinced... **go for it!** Just don't say we didn't warn you. 😄

---

## 🎉 Have Fun!

This is a **thought experiment** that happens to work. Use it to learn, explore, and understand Git's plumbing from first principles.

*"You know what? Have fun."* — Linus (probably)
