# git-cms

A serverless, database-free CMS built on Git plumbing.

> "I'm using `git push` as my API endpoint."

**git-cms** treats your Git repository as a distributed, cryptographically verifiable database. Instead of files, it stores content as commit messages on "empty trees," creating a linear, append-only ledger for articles, comments, or any other structured data.

## Features

- **Database-Free:** No SQL, No NoSQL. Just Git objects (Merkle DAG).
- **Fast-Forward Only:** Enforces strict linear history for provenance.
- **Atomic Publishes:** "Publishing" is just a pointer update (CAS).
- **Infinite History:** Every draft save is a commit. Scrub back to any point in time.

## Installation

```bash
npm install -g git-cms
# or linked locally
git clone https://github.com/flyingrobots/git-cms.git
cd git-cms
npm link
```

## Usage

### 1. Initialize a "Stargate" (Optional but recommended)
A "Stargate" is a bare repo that acts as a firewall, enforcing fast-forward-only pushes and signature verification.

```bash
./scripts/bootstrap-stargate.sh ~/git/_blog-stargate.git
git remote add stargate ~/git/_blog-stargate.git
git config remote.stargate.push "+refs/_blog/*:refs/_blog/*"
```

### 2. Write a Draft
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
