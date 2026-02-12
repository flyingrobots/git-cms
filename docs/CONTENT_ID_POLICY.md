# Content Identity Policy (v1.0.0)

Status: Active  
Effective Date: 2026-02-11  
Applies To: CLI, HTTP API, `CmsService`

## 1. Purpose

Define one canonical contract for content identity so every ingress path behaves the same.

In v1, `contentId` is slug-backed:

- Canonical `contentId` = canonical `slug`
- `contentId` is immutable for a given slug lineage

## 2. Canonical Slug Rules

A slug is canonicalized with:

1. Unicode normalization: `NFKC`
2. Trim surrounding whitespace
3. Lowercase

After canonicalization, it must satisfy:

- Length: `1..64`
- Pattern: `^[a-z0-9]+(?:-[a-z0-9]+)*$`
- Reserved values forbidden

Reserved slugs:

- `.`, `..`
- `admin`, `api`, `assets`, `chunks`
- `draft`, `new`, `published`
- `refs`, `root`

## 3. Kind Rules

Allowed content kinds:

- `articles`
- `published`
- `comments`

Any other kind is rejected.

## 4. Collision Policy

Because slugs are canonicalized before use, values that normalize to the same slug are the same identity.

Examples:

- `Hello-World` -> `hello-world`
- ` hello-world ` -> `hello-world`

Both target the same refs and same logical content lineage.

## 5. contentId Semantics

During snapshot save:

- If no `trailers.contentId`/`trailers.contentid` is provided, system writes canonical slug as trailer `contentid`.
- If `trailers.contentId` or `trailers.contentid` is provided, it must canonicalize to the same value as `slug`.
- Mismatches are rejected.

## 6. Rename Semantics (v1)

Explicit rename is not implemented as a first-class operation yet.

Operationally in v1:

- A new slug creates/targets a different identity.
- Moving history between slugs is out of scope for this policy and will be addressed with state-machine work (`M1.2+`).

## 7. Error Contract

Validation failures return `CmsValidationError` with:

- `error`: human-readable message
- `code`: machine-friendly code (`slug_invalid_format`, `slug_reserved`, etc.)
- `field`: offending field (`slug`, `contentId`, `kind`, ...)

HTTP API maps validation failures to `400`.
