# Contributor Devcontainer

This devcontainer is for people working on `git-cms` itself.

It intentionally supports the existing contributor workflow:

- `npm run dev`
- `npm test`
- `npm run test:e2e`
- `npm run playground`

Why it exists:

- gives contributors a reproducible Node 22 + Git environment
- includes native build tooling
- installs Playwright browsers in post-create
- includes Docker-in-Docker so the existing Compose-based scripts still work inside the container

It is **not** the main reader quickstart. Blog readers should start with:

- `npm run demo`
- `npm run playground`

Those paths are documented in [README.md](../README.md) and [docs/GETTING_STARTED.md](../docs/GETTING_STARTED.md).
