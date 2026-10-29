export const BACKEND_NAME = 'gitea';
export const BACKEND_LABEL = 'Gitea / Forgejo';

/**
 * Name of the backend Decap CMS 3.15 introduced for Forgejo. It’s served by the same
 * implementation, except that the instance URL is derived from the required `api_root` option.
 * @see https://decapcms.org/docs/gitea-backend/#forgejo-backend
 */
export const FORGEJO_BACKEND_NAME = 'forgejo';
export const FORGEJO_BACKEND_LABEL = 'Forgejo';

/**
 * Names of the backends served by this implementation.
 * @type {string[]}
 */
export const BACKEND_NAMES = [BACKEND_NAME, FORGEJO_BACKEND_NAME];

/**
 * Check if the given backend name is served by the Gitea/Forgejo implementation: `gitea`, or
 * `forgejo` as named in Decap CMS.
 * @param {string | undefined} name Backend name.
 * @returns {boolean} Result.
 */
export const isGiteaBackendName = (name) => !!name && BACKEND_NAMES.includes(name);

export const DEFAULT_API_ROOT = 'https://gitea.com/api/v1';
export const DEFAULT_AUTH_ROOT = 'https://gitea.com';
export const DEFAULT_AUTH_PATH = 'login/oauth/authorize';

/**
 * Minimum supported Gitea version. We require at least 1.24 to use the new `file-contents` API
 * endpoint.
 * @see https://github.com/go-gitea/gitea/pull/34139
 */
export const MIN_GITEA_VERSION = 1.24;

/**
 * Minimum supported Forgejo version. We require at least 12.0 to use the new `git/blobs` API
 * endpoint.
 * @see https://codeberg.org/forgejo/forgejo/pulls/8139
 */
export const MIN_FORGEJO_VERSION = 12;
