/**
 * Canonical content identity policy for git-cms.
 *
 * Content IDs are slug-backed in v1: the canonical slug is also the contentId.
 */

export class CmsValidationError extends Error {
  constructor(message, { code = 'validation_error', field = 'input' } = {}) {
    super(message);
    this.name = 'CmsValidationError';
    this.code = code;
    this.field = field;
  }
}

export const CONTENT_ID_POLICY_VERSION = '1.0.0';
export const SLUG_MIN_LENGTH = 1;
export const SLUG_MAX_LENGTH = 64;

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const RESERVED_SLUGS = new Set([
  '.',
  '..',
  'admin',
  'api',
  'assets',
  'chunks',
  'draft',
  'new',
  'published',
  'refs',
  'root',
]);

const ALLOWED_KINDS = new Set(['articles', 'published', 'comments']);

function asString(value, field) {
  if (typeof value !== 'string') {
    throw new CmsValidationError(`${field} must be a string`, {
      code: 'invalid_type',
      field,
    });
  }
  return value;
}

export function canonicalizeSlug(input, { field = 'slug' } = {}) {
  const value = asString(input, field).normalize('NFKC').trim().toLowerCase();

  if (value.length < SLUG_MIN_LENGTH) {
    throw new CmsValidationError(`${field} cannot be empty`, {
      code: 'slug_empty',
      field,
    });
  }

  if (value.length > SLUG_MAX_LENGTH) {
    throw new CmsValidationError(
      `${field} must be ${SLUG_MAX_LENGTH} characters or fewer`,
      { code: 'slug_too_long', field }
    );
  }

  if (!SLUG_REGEX.test(value)) {
    throw new CmsValidationError(
      `${field} must match ${SLUG_REGEX} (lowercase letters, numbers, single hyphens)`,
      { code: 'slug_invalid_format', field }
    );
  }

  if (RESERVED_SLUGS.has(value)) {
    throw new CmsValidationError(`${field} "${value}" is reserved`, {
      code: 'slug_reserved',
      field,
    });
  }

  return value;
}

export function canonicalizeKind(input, { field = 'kind' } = {}) {
  const value = asString(input, field).trim().toLowerCase();
  if (!ALLOWED_KINDS.has(value)) {
    throw new CmsValidationError(
      `${field} must be one of: ${Array.from(ALLOWED_KINDS).join(', ')}`,
      { code: 'kind_invalid', field }
    );
  }
  return value;
}

export function resolveContentIdentity({ slug, trailers = {} }) {
  const canonicalSlug = canonicalizeSlug(slug, { field: 'slug' });
  const candidate = trailers?.contentId ?? trailers?.contentid;

  if (candidate == null || candidate === '') {
    return { slug: canonicalSlug, contentId: canonicalSlug };
  }

  const canonicalContentId = canonicalizeSlug(candidate, { field: 'contentId' });
  if (canonicalContentId !== canonicalSlug) {
    throw new CmsValidationError(
      `contentId "${canonicalContentId}" must match canonical slug "${canonicalSlug}"`,
      { code: 'content_id_mismatch', field: 'contentId' }
    );
  }

  return { slug: canonicalSlug, contentId: canonicalContentId };
}
