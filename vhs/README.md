# VHS Tapes

Series terminal captures live here.

Current tapes:

- [git-cas-inspect.tape](./git-cas-inspect.tape)
- [git-cas-dashboard.tape](./git-cas-dashboard.tape)

Render them from the `git-cms` repo root via:

```bash
npm run capture:git-cas:vhs
npm run capture:git-cas:tui
```

The render script stages a clean `/tmp/git-stunts-media` workspace, prepares a throwaway `git-cas` demo repo, and writes GIFs into `docs/media/generated/git-cas/` without exposing local checkout paths.
