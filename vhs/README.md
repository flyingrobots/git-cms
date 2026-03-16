# VHS Tapes

Series terminal captures live here.

Current tape:

- [git-cas-inspect.tape](./git-cas-inspect.tape)

The tape is rendered from the `git-cms` repo root via:

```bash
npm run capture:git-cas:vhs
```

That script prepares a throwaway `git-cas` demo repo, exports the needed environment variables, and writes the GIF into `docs/media/generated/git-cas/`.
