import { defineConfig, defaultExclude } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@git-stunts/git-warp/InMemoryGraphAdapter':
        resolve(__dirname, 'node_modules/@git-stunts/git-warp/src/infrastructure/adapters/InMemoryGraphAdapter.js'),
    },
  },
  test: {
    exclude: [...defaultExclude, 'test/e2e/**', 'test/git-e2e*'],
  },
});
