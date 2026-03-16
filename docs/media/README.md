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

This repo also carries a VHS starter for the sibling `git-cas` project so the series can produce consistent terminal-native motion assets.

Run it from this repo root:

```bash
npm run capture:git-cas:vhs
```

Defaults:

- expects the `git-cas` source repo at `$HOME/git/git-stunts/git-cas`
- creates a temporary throwaway repo at `/tmp/git-cas-vhs-demo`
- renders a GIF into `docs/media/generated/git-cas/`

Override the source repo path if needed:

```bash
GIT_CAS_REPO=/absolute/path/to/git-cas npm run capture:git-cas:vhs
```

Output file:

- `docs/media/generated/git-cas/git-cas-inspect.gif`

Implementation:

- [vhs/git-cas-inspect.tape](../../vhs/git-cas-inspect.tape)
- [scripts/render-git-cas-vhs.sh](../../scripts/render-git-cas-vhs.sh)

## Notes

- The `git-cms` capture is meant for article-quality browser footage, not test coverage.
- The filmed restore flow uses a draft-only article because restoring a still-published article is intentionally blocked by the product.
- The VHS tape focuses on the `git-cas` inspect flow because it is concise, deterministic, and terminal-native.
- If you want MP4 transcoding or caption burn-ins later, add that as a second pass. The canonical raw outputs here are WebM for browser footage and GIF for VHS.
