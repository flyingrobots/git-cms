# git-cms

A serverless, database-free CMS built on Git plumbing.

> "I'm using `git push` as my API endpoint."

**git-cms** treats your Git repository as a distributed, cryptographically verifiable database. Instead of files, it stores content as commit messages on "empty trees," creating a linear, append-only ledger for articles, comments, or any other structured data.

## ⚠️ SAFETY WARNING

**If you clone this repo and want to run the tests, ALWAYS run them in Docker.**

The tests create, destroy, and manipulate Git repositories. While we try to use temporary directories, running low-level plumbing commands against your host filesystem is a risk you shouldn't take.

We provided a safe harness:
```bash
npm test
# (This automatically runs ./test/run-docker.sh)
```

## Features

- **Database-Free:** No SQL, No NoSQL. Just Git objects (Merkle DAG).
- **Fast-Forward Only:** Enforces strict linear history for provenance.
- **Atomic Publishes:** "Publishing" is just a pointer update (CAS).
- **Infinite History:** Every draft save is a commit. Scrub back to any point in time.

## Development

We use Docker Compose to ensure a consistent, safe environment.

### Start the Server (Dev Mode)
```bash
npm run dev
# OR
docker compose up app
```
The API and Admin UI will be available at `http://localhost:4637`.

### Run Tests
```bash
npm test
# OR
docker compose run --rm test
```

## Installation

```bash
npm install -g git-cms
# or linked locally
git clone https://github.com/flyingrobots/git-cms.git
cd git-cms
npm link
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

### 3. List Articles
```bash
git cms list
# -> refs/_blog/articles/hello-world My First Post
```

### 4. Publish
Publishing fast-forwards `refs/_blog/published/<slug>` to match the draft.

```bash
git cms publish hello-world
```

## The Theory

See the blog post: [Git Stunts: Making Linus Roll His Eyes](https://flyingrobots.dev/posts/git-stunts)

## License
MIT
