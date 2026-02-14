# Layout Specification — v1

> Canonical reference for the git-cms repository layout.
> Version changes are forward-only; see **Migration Policy** below.

## Layout Version

Stored in git config under the key `cms.layout.version`.

| Key                    | Type   | Default (if absent) |
|------------------------|--------|---------------------|
| `cms.layout.version`   | string | `0` (pre-versioned) |

Current codebase version: **1**.

## Ref Namespace

All CMS refs live under a configurable prefix (default `refs/_blog/dev`).

```
{refPrefix}/{kind}/{slug}
```

| Kind         | Pattern                            | Purpose                    |
|--------------|------------------------------------|----------------------------|
| `articles`   | `{refPrefix}/articles/{slug}`      | Draft / working ref        |
| `published`  | `{refPrefix}/published/{slug}`     | Published snapshot ref     |
| `comments`   | `{refPrefix}/comments/{slug}`      | (Reserved for future use)  |

Slugs are canonicalized per `ContentIdentityPolicy`: lowercase, `[a-z0-9]+(-[a-z0-9]+)*`, 1–64 chars, NFKC-normalized, no reserved words.

## State Derivation

Effective state is derived from **two inputs**:

1. The `status` trailer on the tip commit of `articles/{slug}`
2. The presence or absence of the `published/{slug}` ref

| Effective State | `status` trailer | `published/{slug}` ref |
|-----------------|------------------|------------------------|
| draft           | `draft`          | absent                 |
| published       | `draft`          | present                |
| unpublished     | `unpublished`    | absent                 |
| reverted        | `reverted`       | absent                 |

### Allowed Transitions

```
draft       → draft, published, reverted
published   → unpublished, published
unpublished → draft, published
reverted    → draft
```

## Commit Message Format

Commit messages are encoded/decoded via `@git-stunts/trailer-codec`.

```
<title>

<body>

<key>: <value>
<key>: <value>
...
```

### Required Trailers

| Trailer      | Description                              |
|--------------|------------------------------------------|
| `contentid`  | Canonical slug (matches slug in v1)      |
| `status`     | One of: `draft`, `unpublished`, `reverted` |
| `updatedAt`  | ISO 8601 timestamp of last mutation      |

### Optional Trailers

| Trailer           | Description                          |
|-------------------|--------------------------------------|
| `restoredFromSha` | SHA of the version that was restored |
| `restoredAt`      | ISO 8601 timestamp of the restore    |

> **Note:** `trailer-codec` normalizes keys to lowercase during decode.
> Use camelCase when encoding; read lowercase when consuming decoded output.

## Config Keys

| Key                    | Description                        |
|------------------------|------------------------------------|
| `cms.layout.version`   | Repo layout version (integer as string) |

## Invariants

The following invariants hold for a well-formed v1 repo. (Enforcement deferred to M1.4 `verify` command.)

1. Every `articles/{slug}` tip commit has a valid `status` trailer.
2. Every `published/{slug}` ref points to a commit reachable from `articles/{slug}`.
3. No orphan `published/{slug}` ref exists without a corresponding `articles/{slug}`.
4. All slugs satisfy `ContentIdentityPolicy` canonicalization rules.
5. `cms.layout.version` equals `1` after migration.

## Migration Policy

- **Forward-only:** migrations never downgrade the layout version.
- **Idempotent:** running `migrate` on an already-current repo is a no-op.
- **Guard:** if the repo version exceeds the codebase version, migration refuses to run (`layout_version_too_new`).
- **v0 → v1:** stamps `cms.layout.version = 1` (no structural changes — formalizes existing layout).
