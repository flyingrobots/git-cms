# Git CMS: Technical Repo Walkthrough

This document provides a top-to-bottom technical walkthrough of the Git CMS architecture, linking concepts to their implementation evidence in the codebase.

## 1. Core Philosophy: The "Empty Tree" Database
Instead of tracking files on disk, Git CMS treats the Git object store as a NoSQL-style graph database.

*   **Evidence:** `src/lib/git.js` defines the [EMPTY_TREE constant](https://github.com/clduab11/git-cms/blob/main/src/lib/git.js#L6) (`4b825dc642cb6eb9a060e54bf8d69288fbee4904`).
*   **Implementation:** All content commits are generated using `commit-tree` against this empty tree OID, ensuring the "working tree" of these commits is always empty. See [writeSnapshot in src/lib/git.js](https://github.com/clduab11/git-cms/blob/main/src/lib/git.js#L54).
*   **NOTE:**
    > [!note]
    > This architectural decision is not formally documented in the `docs/` folder; it is only described in the `README.md` and visible in the source code logic.

## 2. Refspace Organization
The CMS partitions the Git namespace to separate drafts, published content, and assets.

*   **Evidence:** The `refFor` helper in [src/lib/git.js](https://github.com/clduab11/git-cms/blob/main/src/lib/git.js#L18-L23) defines the structure:
    *   `refs/_blog/articles/<slug>` (Drafts)
    *   `refs/_blog/published/<slug>` (Published)
    *   `refs/_blog/comments/<slug>` (Comments)
*   **NOTE:**
    > [!note]
    > The specific schema for the `refs/_blog` namespace lacks documentation regarding collision prevention or migration strategies.

## 3. Article Serialization (The "Commit Article" Format)
Articles are stored entirely within Git commit messages using a header/body/trailer format.

*   **Evidence:** [src/lib/parse.js](https://github.com/clduab11/git-cms/blob/main/src/lib/parse.js) contains the logic for splitting the commit message into `title`, `body`, and `trailers`.
*   **Evidence:** The CLI implementation in [bin/git-cms.js](https://github.com/clduab11/git-cms/blob/main/bin/git-cms.js#L17-L21) demonstrates the construction of this message.

## 4. Asset Management: Git-Native CAS
Assets are handled via a Content Addressable Store (CAS) implemented using Git blobs and manifests.

*   **Chunking Logic:** Files are split into 256KB chunks in [src/lib/chunks.js](https://github.com/clduab11/git-cms/blob/main/src/lib/chunks.js#L48).
*   **Encryption:** AES-256-GCM encryption is applied if a key is resolved, seen in [encryptBuffer](https://github.com/clduab11/git-cms/blob/main/src/lib/chunks.js#L34).
*   **Manifests:** The file structure is preserved in a `manifest.json` stored as a Git blob, which is then committed to a chunk-specific ref. See [chunkFileToRef](https://github.com/clduab11/git-cms/blob/main/src/lib/chunks.js#L48).
*   **NOTE:**
    > [!note]
    > The chunking and encryption feature is complex but lacks a specification document describing the manifest JSON schema.

## 5. Secret Management
The project avoids plain-text secrets by integrating with OS-native keychains.

*   **Implementation:** [src/lib/secrets.js](https://github.com/clduab11/git-cms/blob/main/src/lib/secrets.js) contains drivers for:
    *   macOS `security`
    *   Linux `secret-tool`
    *   Windows `CredentialManager`
*   **Usage:** Used by the CAS system to retrieve the `CHUNK_ENC_KEY` via [resolveSecret](https://github.com/clduab11/git-cms/blob/main/src/lib/secrets.js#L206).

## 6. API and Admin UI
The system provides a zero-dependency management interface.

*   **Server:** [src/server/index.js](https://github.com/clduab11/git-cms/blob/main/src/server/index.js) uses Node's `http` module to provide a REST API.
*   **UI:** [public/index.html](https://github.com/clduab11/git-cms/blob/main/public/index.html) is a vanilla JS SPA that communicates with the `/api/cms` endpoints.
*   **NOTE:**
    > [!note]
    > The REST API endpoints are not documented with an OpenAPI spec or similar reference.

## 7. Operational Environment
*   **Configuration:** The project uses `GIT_CMS_REPO` to target the data repository. Evidence: [src/server/index.js](https://github.com/clduab11/git-cms/blob/main/src/server/index.js#L14).
*   **Verification:** E2E tests in [test/e2e/admin.spec.js](https://github.com/clduab11/git-cms/blob/main/test/e2e/admin.spec.js) verify the full flow from draft creation to publishing.
