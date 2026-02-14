import { defineConfig, defaultExclude } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      // TODO: remove once @git-stunts/git-warp exports InMemoryGraphAdapter publicly
      // (not in the package's "exports" map as of v10.8.0)
      '#test/InMemoryGraphAdapter':
        new URL('node_modules/@git-stunts/git-warp/src/infrastructure/adapters/InMemoryGraphAdapter.js', import.meta.url).pathname,
    },
  },
  test: {
    exclude: [...defaultExclude, 'test/e2e/**', 'test/git-e2e**'],
  },
});
