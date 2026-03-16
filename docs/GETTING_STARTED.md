# Getting Started with Git CMS

> Validated against v1.1.5 on 2026-03-15.

This guide is optimized for people arriving from the blog post. If you just want to see the stunt, use the reader-safe paths first.

## TL;DR

```bash
git clone https://github.com/flyingrobots/git-cms.git
cd git-cms
npm run setup
npm run demo
npm run sandbox
```

In another terminal:

```bash
npm run sandbox:shell
git -C "$GIT_CMS_REPO" for-each-ref refs/_blog/
git -C "$GIT_CMS_REPO" log refs/_blog/dev/articles/hello-world -1 --format="%B"
git -C "$GIT_CMS_REPO" log refs/_blog/dev/articles/hello-world --graph --oneline
```

## The Three Modes

| Mode | Command | Git repo location | Intended audience |
| --- | --- | --- | --- |
| Demo | `npm run demo` | Disposable isolated repo inside a temporary Docker project | First-time readers |
| Sandbox | `npm run sandbox` | `/data/repo` in the container, backed by a named Docker volume | Readers who want to inspect and tinker |
| Dev | `npm run dev` | `/app` (the bind-mounted checkout) | Contributors working on `git-cms` itself |

If you are here to understand the stunt, start with `demo` or `sandbox`.

## Reader Path

### Step 1: Setup

```bash
npm run setup
```

This checks:

- Docker is installed
- Docker Compose is available
- the Docker daemon is running

### Step 2: Watch the guided demo

```bash
npm run demo
```

What the demo shows:

- create a draft
- inspect refs
- inspect the commit message
- publish by moving a ref
- make another edit
- inspect version history

The demo uses a disposable isolated repo and cleans itself up when it exits.

### Step 3: Start the seeded sandbox

```bash
npm run sandbox
```

Open your browser to [http://localhost:4638](http://localhost:4638).

What just happened:

- Docker built the runtime image
- the container created or reused `/data/repo`
- if the repo was empty, the sandbox seeded `hello-world`
- the server started against `/data/repo`

### Step 4: Inspect the live repo

In another terminal:

```bash
npm run sandbox:shell
```

The source code lives in `/app`. The live Git repo lives in `$GIT_CMS_REPO`, which defaults to `/data/repo`.

Recommended inspection commands:

```bash
git -C "$GIT_CMS_REPO" for-each-ref refs/_blog/
git -C "$GIT_CMS_REPO" log refs/_blog/dev/articles/hello-world -1 --format="%B"
git -C "$GIT_CMS_REPO" log refs/_blog/dev/articles/hello-world -1 --format="tree: %T"
git -C "$GIT_CMS_REPO" log refs/_blog/dev/articles/hello-world --graph --oneline
```

What you should see:

- the article body inside the commit message
- an empty-tree commit
- a published ref behind the current draft ref
- multiple restore-worthy historical commits

## Seeded Sandbox State

The sandbox deliberately starts with an interesting repo:

- `hello-world` published at v1
- draft v2 and v3 ahead of published
- a history chain you can browse and restore immediately

That means the UI is alive on first load and the Git inspection commands have something real to show.

## Using the Admin UI

While `npm run sandbox` is running:

1. Open [http://localhost:4638](http://localhost:4638)
2. Click `hello-world`
3. Compare the current draft with the published state
4. Open the History panel
5. Preview an older version
6. Restore it and watch a new commit appear

The important thing to notice is that restore does **not** rewrite history. It appends a new draft commit with old content.

## Contributor Path

If you are modifying the codebase itself:

```bash
npm run dev
```

This mode is different from `sandbox`:

- the checkout is bind-mounted into `/app`
- the running app uses `/app` as the Git repo
- it is meant for contributor iteration, not blog-reader safety

Use `dev` when you are working on `git-cms`, not when you are just exploring how it works.

## Safety Model

### Reader-safe commands

These commands keep Git activity away from the checkout:

- `npm run demo`
- `npm run sandbox`
- `npm test`

### Contributor command

`npm run dev` is intentionally different. It uses the checkout as the runtime repo. That is useful for contributors, but it is not the right first step for article readers.

### Cleanup

To stop services and remove volumes:

```bash
docker compose down -v
```

That removes the long-lived playground repo volume too.

## Tests

```bash
npm test
npm run test:e2e
npm run test:sandbox
```

What they cover:

- core Git and service behavior
- admin UI
- isolated seeded sandbox smoke path

## Advanced Notes

### Historical commit IDs

The current HTTP history endpoints assume Git's default SHA-1 object format. In practice, `/api/cms/show-version` and `/api/cms/restore` accept 40-character hexadecimal commit IDs.

### Assets

Assets can be encrypted server-side before they are written into Git via `@git-stunts/git-cas`.

### Hardening with git-stargate

`git-stargate` is optional hardening, not part of the first-run path. If you want a Git-native gateway with fast-forward-only and signed-push enforcement, see [README.md](../README.md#optional-hardening-git-stargate).

## Next Reading

- [README.md](../README.md)
- [QUICK_REFERENCE.md](../QUICK_REFERENCE.md)
- [TESTING_GUIDE.md](../TESTING_GUIDE.md)
- [docs/ADR.md](./ADR.md)
