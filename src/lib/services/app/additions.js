import { createLazyModule } from '$lib/services/api/lazy-module';
import { loadChunk } from '$lib/services/app/dependencies';
import { cmsConfig } from '$lib/services/config';

/**
 * @import { InternalCmsConfig } from '$lib/types/private';
 * @import { GitHubBackend } from '$lib/types/public';
 */

/**
 * The `additions` chunk: the UI and services of Sveltia CMS Additions.
 * @typedef {typeof import('$lib/chunks/additions.js')} AdditionsChunk
 */

/**
 * Check whether the CMS works with Sveltia CMS Additions, which replaces GitHub sign-in with its
 * own accounts and hands out GitHub tokens. It’s turned on with `auth_type: additions` on the
 * GitHub backend.
 * @param {InternalCmsConfig | undefined} [config] CMS configuration. Default: the current one.
 * @returns {boolean} Result.
 * @see https://github.com/sveltia/sveltia-cms/issues/918
 */
export const isAdditionsEnabled = (config = cmsConfig.current) => {
  const backend = /** @type {GitHubBackend | undefined} */ (config?.backend);

  return backend?.name === 'github' && backend.auth_type === 'additions';
};

/**
 * Get the base URL of the Sveltia CMS Additions service, which is the backend’s `base_url`.
 * @returns {string} URL without a trailing slash.
 */
export const getAdditionsURL = () =>
  /** @type {string} */ (
    /** @type {GitHubBackend} */ (/** @type {InternalCmsConfig} */ (cmsConfig.current).backend)
      .base_url
  ).replace(/\/+$/, '');

/**
 * Loader of the `additions` chunk, which holds everything Sveltia CMS Additions needs, so a site
 * without it never downloads it.
 */
const additionsChunk = createLazyModule({
  /**
   * Fetch the chunk.
   * @returns {Promise<AdditionsChunk>} Chunk.
   */
  loader: () => loadChunk('additions'),
  notLoadedMessage: 'The additions chunk is not loaded yet.',
});

/**
 * Load the `additions` chunk if the CMS works with Sveltia CMS Additions. It’s loaded along with
 * the backend, so it’s there before the sign-in page offers anything, and the rest of the app can
 * use it with {@link getAdditions} once the user is signed in.
 * @returns {Promise<AdditionsChunk | undefined>} Chunk, or `undefined` without Sveltia CMS
 * Additions.
 * @throws {Error} If the chunk can’t be loaded.
 */
export const loadAdditions = async () => (isAdditionsEnabled() ? additionsChunk.load() : undefined);

/**
 * Get the `additions` chunk, if the CMS works with Sveltia CMS Additions and the chunk has been
 * loaded. Reading this in a reaction, e.g. a `$derived`, runs it again once the chunk is loaded.
 * @returns {AdditionsChunk | undefined} Chunk.
 */
export const getAdditions = () =>
  additionsChunk.loaded.current && isAdditionsEnabled() ? additionsChunk.get() : undefined;

/**
 * Get the `additions` chunk where it must have been loaded: in a feature only offered with Sveltia
 * CMS Additions, whose chunk is loaded along with the backend, before the user can sign in.
 * @returns {AdditionsChunk} Chunk.
 * @throws {Error} If it hasn’t been loaded, which would be a bug.
 */
export const requireAdditions = () => additionsChunk.get();
