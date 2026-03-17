# Media Capture

Reproducible article media lives here.

Generated assets are written to `docs/media/generated/` and are intentionally gitignored. The goal is to make blog visuals repeatable without bloating the repo.

## `git-cms` browser footage

This repo ships a dedicated Playwright capture path for the seeded sandbox walkthrough.

Run it from the repo root:

```bash
npm run capture:cms
```

What it does:

- starts a fresh isolated media sandbox on port `47639`
- creates a dedicated draft-only `restore-demo` article inside that sandbox
- opens version history
- previews an older version
- restores it
- writes a poster screenshot and browser video into `docs/media/generated/git-cms/`

Output files:

- `docs/media/generated/git-cms/git-cms-walkthrough.webm`
- `docs/media/generated/git-cms/git-cms-poster.png`

Implementation:

- [playwright.media.config.js](../../playwright.media.config.js)
- [test/media/git-cms.capture.spec.js](../../test/media/git-cms.capture.spec.js)
- [scripts/capture-cms-footage.mjs](../../scripts/capture-cms-footage.mjs)
- [scripts/start-media-sandbox.sh](../../scripts/start-media-sandbox.sh)

## `git-cas` terminal capture

This repo also carries VHS starters for the sibling `git-cas` project so the series can produce consistent terminal-native motion assets.

Run it from this repo root:

```bash
npm run capture:git-cas:vhs
npm run capture:git-cas:tui
```

Defaults:

- expects the `git-cas` source repo at `$HOME/git/git-stunts/git-cas`
- creates a synthetic media root at `/tmp/git-stunts-media`
- symlinks the real source repo into `/tmp/git-stunts-media/git-cas`
- creates a throwaway Git repo at `/tmp/git-stunts-media/repo`
- renders a GIF into `docs/media/generated/git-cas/`

Override the source repo path if needed:

```bash
GIT_CAS_REPO=/absolute/path/to/git-cas npm run capture:git-cas:vhs
GIT_CAS_REPO=/absolute/path/to/git-cas npm run capture:git-cas:tui
```

Output file:

- `docs/media/generated/git-cas/git-cas-inspect.gif`
- `docs/media/generated/git-cas/git-cas-dashboard.gif`

Implementation:

- [vhs/git-cas-inspect.tape](../../vhs/git-cas-inspect.tape)
- [vhs/git-cas-dashboard.tape](../../vhs/git-cas-dashboard.tape)
- [scripts/render-git-cas-vhs.sh](../../scripts/render-git-cas-vhs.sh)

## Notes

- The `git-cms` capture is meant for article-quality browser footage, not test coverage.
- The filmed restore flow uses a draft-only article because restoring a still-published article is intentionally blocked by the product.
- The `git-cas` inspect tape is concise and deterministic. The dashboard tape captures the actual vault TUI.
- The `git-cas` capture scripts intentionally render from synthetic `/tmp/git-stunts-media/...` paths and set a neutral shell prompt so the media does not leak local checkout paths like `/Users/james/...`.
- If you want MP4 transcoding or caption burn-ins later, add that as a second pass. The canonical raw outputs here are WebM for browser footage and GIF for VHS.
