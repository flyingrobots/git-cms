/**
 * Layout migration framework for git-cms.
 *
 * Pure-function module — takes a `graph` adapter (GraphPersistencePort) as
 * dependency. No CmsService import.
 *
 * Layout version is stored in git config under `cms.layout.version`.
 * A missing key is treated as version 0 (pre-versioned repo).
 */

import { CmsValidationError } from './ContentIdentityPolicy.js';

export const CURRENT_LAYOUT_VERSION = 1;
export const LAYOUT_VERSION_KEY = 'cms.layout.version';

/**
 * Reads the current layout version from the graph's config.
 * Returns 0 if the key is unset (pre-versioned repo).
 *
 * @param {import('@git-stunts/git-warp').GraphPersistencePort} graph
 * @returns {Promise<number>}
 */
export async function readLayoutVersion(graph) {
  const raw = await graph.configGet(LAYOUT_VERSION_KEY);
  if (raw === null) return 0;
  const version = Number(raw);
  if (!Number.isInteger(version) || version < 0) {
    throw new CmsValidationError(
      `Invalid layout version in config: "${raw}"`,
      { code: 'layout_version_invalid', field: LAYOUT_VERSION_KEY }
    );
  }
  return version;
}

/**
 * Writes a layout version to the graph's config.
 *
 * @param {import('@git-stunts/git-warp').GraphPersistencePort} graph
 * @param {number} version
 * @returns {Promise<void>}
 */
export async function writeLayoutVersion(graph, version) {
  await graph.configSet(LAYOUT_VERSION_KEY, String(version));
}

/**
 * Ordered list of [targetVersion, migrateFn] pairs.
 * Each migrateFn receives { graph, refPrefix } and performs the migration.
 *
 * @type {Array<[number, (ctx: {graph: any, refPrefix: string}) => Promise<void>]>}
 */
const MIGRATIONS = [
  [1, async (_ctx) => { /* v0→v1: no-op — stamps the version */ }],
];

/**
 * Returns the subset of migrations that need to run given the current version.
 *
 * @param {number} currentVersion
 * @returns {Array<[number, Function]>}
 */
export function pendingMigrations(currentVersion) {
  return MIGRATIONS.filter(([target]) => target > currentVersion);
}

/**
 * Runs all pending migrations in order.
 *
 * @param {{ graph: any, refPrefix: string }} ctx
 * @returns {Promise<{ from: number, to: number, applied: number[] }>}
 */
export async function migrate({ graph, refPrefix }) {
  const from = await readLayoutVersion(graph);

  if (from > CURRENT_LAYOUT_VERSION) {
    throw new CmsValidationError(
      `Repo layout version (${from}) is newer than codebase version (${CURRENT_LAYOUT_VERSION}). Upgrade git-cms first.`,
      { code: 'layout_version_too_new', field: LAYOUT_VERSION_KEY }
    );
  }

  const pending = pendingMigrations(from);
  const applied = [];

  for (const [target, migrateFn] of pending) {
    await migrateFn({ graph, refPrefix });
    await writeLayoutVersion(graph, target);
    applied.push(target);
  }

  const to = await readLayoutVersion(graph);
  return { from, to, applied };
}
