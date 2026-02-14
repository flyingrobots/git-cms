/**
 * Content state machine policy for git-cms.
 *
 * Defines the four editorial states and enforces valid transitions.
 *
 * | Logical State | `status` trailer | `published/<slug>` ref |
 * |---------------|------------------|------------------------|
 * | draft         | draft            | absent                 |
 * | published     | draft            | present                |
 * | unpublished   | unpublished      | absent                 |
 * | reverted      | reverted         | absent                 |
 */

import { CmsValidationError } from './ContentIdentityPolicy.js';

export const CONTENT_STATE_POLICY_VERSION = '1.0.0';

export const STATES = Object.freeze({
  DRAFT: 'draft',
  PUBLISHED: 'published',
  UNPUBLISHED: 'unpublished',
  REVERTED: 'reverted',
});

/**
 * Allowed transitions: from → Set of valid targets.
 */
export const TRANSITIONS = Object.freeze({
  [STATES.DRAFT]:       Object.freeze(new Set([STATES.DRAFT, STATES.PUBLISHED, STATES.REVERTED])),
  [STATES.PUBLISHED]:   Object.freeze(new Set([STATES.UNPUBLISHED, STATES.PUBLISHED])),
  [STATES.UNPUBLISHED]: Object.freeze(new Set([STATES.DRAFT, STATES.PUBLISHED])),
  [STATES.REVERTED]:    Object.freeze(new Set([STATES.DRAFT])),
});

/**
 * Derives the effective state from the draft status trailer and the
 * presence/absence of a published ref.
 *
 * @param {{ draftStatus: string, pubSha: string|null }} params
 * @returns {string} One of STATES values.
 */
export function resolveEffectiveState({ draftStatus, pubSha }) {
  if (pubSha) return STATES.PUBLISHED;
  if (draftStatus === STATES.UNPUBLISHED) return STATES.UNPUBLISHED;
  if (draftStatus === STATES.REVERTED) return STATES.REVERTED;
  if (draftStatus === STATES.DRAFT) return STATES.DRAFT;
  throw new CmsValidationError(
    `Unrecognized draft status: "${draftStatus}"`,
    { code: 'unknown_status', field: 'status' }
  );
}

/**
 * Guards a state transition. Throws if the transition is not allowed.
 *
 * @param {string} from - Current effective state.
 * @param {string} to   - Desired target state.
 * @throws {CmsValidationError} with code `invalid_state_transition`
 */
export function validateTransition(from, to) {
  const allowed = TRANSITIONS[from];
  if (!allowed || !allowed.has(to)) {
    throw new CmsValidationError(
      `Cannot transition from "${from}" to "${to}"`,
      { code: 'invalid_state_transition', field: 'status' }
    );
  }
}
