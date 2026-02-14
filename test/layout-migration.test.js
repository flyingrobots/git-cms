import { describe, it, expect, beforeEach } from 'vitest';
import InMemoryGraphAdapter from '#test/InMemoryGraphAdapter';
import {
  CURRENT_LAYOUT_VERSION,
  LAYOUT_VERSION_KEY,
  readLayoutVersion,
  writeLayoutVersion,
  pendingMigrations,
  migrate,
} from '../src/lib/LayoutMigration.js';
import CmsService from '../src/lib/CmsService.js';

describe('readLayoutVersion', () => {
  let graph;

  beforeEach(() => {
    graph = new InMemoryGraphAdapter();
  });

  it('returns 0 when config key is unset', async () => {
    expect(await readLayoutVersion(graph)).toBe(0);
  });

  it('returns stored integer value', async () => {
    await graph.configSet(LAYOUT_VERSION_KEY, '1');
    expect(await readLayoutVersion(graph)).toBe(1);
  });

  it('throws on non-integer value', async () => {
    await graph.configSet(LAYOUT_VERSION_KEY, 'abc');
    await expect(readLayoutVersion(graph)).rejects.toMatchObject({
      name: 'CmsValidationError',
      code: 'layout_version_invalid',
    });
  });

  it('throws on negative value', async () => {
    await graph.configSet(LAYOUT_VERSION_KEY, '-1');
    await expect(readLayoutVersion(graph)).rejects.toMatchObject({
      name: 'CmsValidationError',
      code: 'layout_version_invalid',
    });
  });

  it('throws on fractional value', async () => {
    await graph.configSet(LAYOUT_VERSION_KEY, '1.5');
    await expect(readLayoutVersion(graph)).rejects.toMatchObject({
      name: 'CmsValidationError',
      code: 'layout_version_invalid',
    });
  });

  it('throws on empty string value', async () => {
    await graph.configSet(LAYOUT_VERSION_KEY, '');
    await expect(readLayoutVersion(graph)).rejects.toMatchObject({
      name: 'CmsValidationError',
      code: 'layout_version_invalid',
    });
  });

  it('throws on whitespace-only value', async () => {
    await graph.configSet(LAYOUT_VERSION_KEY, '   ');
    await expect(readLayoutVersion(graph)).rejects.toMatchObject({
      name: 'CmsValidationError',
      code: 'layout_version_invalid',
    });
  });
});

describe('writeLayoutVersion', () => {
  it('writes version to config', async () => {
    const graph = new InMemoryGraphAdapter();
    await writeLayoutVersion(graph, 1);
    expect(await graph.configGet(LAYOUT_VERSION_KEY)).toBe('1');
  });

  it('rejects negative version', async () => {
    const graph = new InMemoryGraphAdapter();
    await expect(writeLayoutVersion(graph, -1)).rejects.toMatchObject({
      name: 'CmsValidationError',
      code: 'layout_version_invalid',
    });
  });

  it('rejects fractional version', async () => {
    const graph = new InMemoryGraphAdapter();
    await expect(writeLayoutVersion(graph, 1.5)).rejects.toMatchObject({
      name: 'CmsValidationError',
      code: 'layout_version_invalid',
    });
  });

  it('rejects NaN', async () => {
    const graph = new InMemoryGraphAdapter();
    await expect(writeLayoutVersion(graph, NaN)).rejects.toMatchObject({
      name: 'CmsValidationError',
      code: 'layout_version_invalid',
    });
  });
});

describe('pendingMigrations', () => {
  it('returns all migrations for version 0', () => {
    const pending = pendingMigrations(0);
    expect(pending).toHaveLength(1);
    expect(pending[0][0]).toBe(1);
  });

  it('returns none at current version', () => {
    const pending = pendingMigrations(CURRENT_LAYOUT_VERSION);
    expect(pending).toHaveLength(0);
  });
});

describe('migrate', () => {
  let graph;
  const refPrefix = 'refs/cms';

  beforeEach(() => {
    graph = new InMemoryGraphAdapter();
  });

  it('v0 → v1 stamps version', async () => {
    const result = await migrate({ graph, refPrefix });
    expect(result.from).toBe(0);
    expect(result.to).toBe(1);
    expect(result.applied).toEqual([1]);
    expect(await readLayoutVersion(graph)).toBe(1);
  });

  it('is idempotent — second run is a no-op', async () => {
    await migrate({ graph, refPrefix });
    const result = await migrate({ graph, refPrefix });
    expect(result.from).toBe(1);
    expect(result.to).toBe(1);
    expect(result.applied).toEqual([]);
  });

  it('throws layout_version_too_new when repo version exceeds codebase', async () => {
    await writeLayoutVersion(graph, CURRENT_LAYOUT_VERSION + 1);
    await expect(migrate({ graph, refPrefix })).rejects.toMatchObject({
      name: 'CmsValidationError',
      code: 'layout_version_too_new',
    });
  });

  it('preserves existing content during migration', async () => {
    const cms = new CmsService({ refPrefix, graph });
    await cms.saveSnapshot({ slug: 'hello', title: 'Hello', body: 'World' });

    const result = await migrate({ graph, refPrefix });
    expect(result.to).toBe(1);

    const article = await cms.readArticle({ slug: 'hello' });
    expect(article.title).toBe('Hello');
    expect(article.body).toContain('World');
  });
});
