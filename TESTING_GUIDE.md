# How to Safely Test Git CMS

This guide explains which commands are reader-safe, which ones are contributor-oriented, and where the Git repo actually lives in each mode.

## TL;DR

```bash
git clone https://github.com/flyingrobots/git-cms.git
cd git-cms
npm run setup
npm run demo
npm run sandbox
```

If you want to test the long-lived sandbox directly:

```bash
npm run test:sandbox
```

## Safety Matrix

| Command | Repo location | Safe for casual readers? | Notes |
| --- | --- | --- | --- |
| `npm run demo` | Disposable isolated repo inside a temporary Docker project | Yes | Guided walkthrough; cleans itself up |
| `npm run sandbox` | `/data/repo` inside the container, backed by a named Docker volume | Yes | Long-lived seeded repo for tinkering |
| `npm test` | Temporary repos inside the test container | Yes | Uses Docker |
| `npm run dev` | `/app` (the bind-mounted checkout) | No | Contributor workflow |

## What Each Mode Actually Does

### Demo

```bash
npm run demo
```

- Uses a temporary Docker Compose project
- Initializes an isolated repo
- Walks through draft, publish, and history
- Cleans up automatically on exit

### Sandbox

```bash
npm run sandbox
```

- Starts the HTTP server on port `4638`
- Uses `/data/repo` as the runtime Git repo
- Seeds `hello-world` history when the repo is empty
- Leaves the seeded repo running so you can inspect it

Useful follow-up:

```bash
npm run sandbox:shell
git -C "$GIT_CMS_REPO" for-each-ref refs/_blog/
```

### Contributor Dev

```bash
npm run dev
```

- Bind-mounts the checkout into `/app`
- Uses `/app` as the runtime Git repo
- Is meant for editing `git-cms`, not for casual exploration

This mode is why the docs no longer claim that every Docker command is equally isolated.

## Smoke Test The Sandbox

```bash
npm run test:sandbox
```

This host-side smoke test:

- boots the seeded `sandbox` service
- verifies the API responds with `hello-world`
- verifies the sandbox repo contains both `articles` and `published` refs
- verifies the checkout’s own `refs/_blog/*` are unchanged

## Full Test Suite

```bash
npm test
npm run test:e2e
npm run test:setup
npm run test:sandbox
```

What each one covers:

- `npm test` — Vitest integration/unit coverage in Docker
- `npm run test:e2e` — Playwright admin UI coverage
- `npm run test:setup` — setup script checks
- `npm run test:sandbox` — long-lived reader sandbox smoke path

## Inspecting The Live Sandbox Repo

Start the sandbox:

```bash
npm run sandbox
```

Then, in another terminal:

```bash
npm run sandbox:shell
git -C "$GIT_CMS_REPO" for-each-ref refs/_blog/
git -C "$GIT_CMS_REPO" log refs/_blog/dev/articles/hello-world -1 --format="%B"
git -C "$GIT_CMS_REPO" log refs/_blog/dev/articles/hello-world --graph --oneline
```

## Cleanup

Stop containers and remove volumes:

```bash
docker compose down -v
```

That also removes the long-lived sandbox repo volume.

## Local Host Use

If you intentionally want to use the CLI on your host outside Docker, do it only in a dedicated repo you do not care about yet.

```bash
mkdir ~/git-cms-playground
cd ~/git-cms-playground
git init
git config user.name "Your Name"
git config user.email "you@example.com"
```

Then either:

- set `GIT_CMS_REPO` explicitly when invoking the CLI from elsewhere, or
- run the CLI directly from that repo

But for the blog post and normal first contact, the Docker reader paths are the intended experience.
