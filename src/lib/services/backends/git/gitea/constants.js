export const BACKEND_NAME = 'gitea';
export const BACKEND_LABEL = 'Gitea / Forgejo';

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
