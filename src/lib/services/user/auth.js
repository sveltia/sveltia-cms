import { isObject } from '@sveltia/utils/object';
import { LocalStorage } from '@sveltia/utils/storage';
import { get, writable } from 'svelte/store';
import { _ } from 'svelte-i18n';

import { goto, parseLocation } from '$lib/services/app/navigation';
import { backend, backendName } from '$lib/services/backends';
import { siteConfig } from '$lib/services/config';
import { dataLoaded } from '$lib/services/contents';
import { user } from '$lib/services/user';
import { prefs } from '$lib/services/user/prefs';

/**
 * @import { Writable } from 'svelte/store';
 * @import { BackendService, InternalSiteConfig, User } from '$lib/types/private';
 */

/**
 * Context of the sign-in error.
 * @typedef {'authentication' | 'dataFetch'} SignInErrorContext
 */

/**
 * Sign-in error store.
 * @type {Writable<{ message: string, context: SignInErrorContext }>}
 */
export const signInError = writable({ message: '', context: 'authentication' });

/**
 * @type {Writable<boolean>}
 */
export const unauthenticated = writable(true);

/**
 * @type {Writable<boolean>}
 */
export const signingIn = writable(false);

/**
 * Reset the sign-in error store.
 */
export const resetError = () => {
  signInError.set({ message: '', context: 'authentication' });
};

/**
 * Log an authentication error on the UI and in the browser console.
 * @param {Error} ex Exception.
 * @param {SignInErrorContext} [context] Context of the error.
 */
export const logError = (ex, context = 'authentication') => {
  let message =
    /** @type {{ message: string }} */ (ex.cause)?.message || get(_)('unexpected_error');

  if (ex.name === 'NotFoundError') {
    message = get(_)('sign_in_error.not_project_root');
  }

  if (ex.name === 'AbortError') {
    message = get(_)(
      get(backendName) === 'local'
        ? 'sign_in_error.picker_dismissed'
        : 'sign_in_error.authentication_aborted',
    );
  }

  signInError.set({ message, context });
  // eslint-disable-next-line no-console
  console.error(ex.name, ex.message, ex.cause);
};

/**
 * Parse a magic link URL generated for QR code sign-in to extract the token and preferences.
 * @internal
 * @returns {{ _user: { token: string } | undefined, copiedPrefs: Record<string, any> | undefined
 * }} Object containing the user token and copied preferences.
 */
export const parseMagicLink = () => {
  const { path } = parseLocation();
  const { encodedData } = path.match(/^\/signin\/(?<encodedData>.+)/)?.groups ?? {};

  if (!encodedData) {
    return { _user: undefined, copiedPrefs: undefined };
  }

  // Remove token from the URL
  goto('', { replaceState: true });

  /** @type {{ token: string } | undefined} */
  let _user = undefined;
  /** @type {Record<string, any> | undefined} */
  let copiedPrefs = undefined;

  try {
    const data = JSON.parse(atob(encodedData));

    if (isObject(data) && typeof data.token === 'string') {
      _user = { token: data.token };

      if (isObject(data.prefs)) {
        copiedPrefs = data.prefs;
      }
    }
  } catch {
    //
  }

  return { _user, copiedPrefs };
};

/**
 * Find cached user info, including a compatible Netlify/Decap CMS user object.
 * @internal
 * @returns {Promise<Record<string, any> | undefined>} Cached user info, or undefined if not found.
 */
export const getUserCache = async () => {
  const userCache =
    (await LocalStorage.get('sveltia-cms.user')) ||
    (await LocalStorage.get('decap-cms-user')) ||
    (await LocalStorage.get('netlify-cms-user'));

  if (isObject(userCache) && typeof userCache.backendName === 'string') {
    return userCache;
  }

  return undefined;
};

/**
 * Get the backend instance based on the cached user info or site config.
 * @internal
 * @param {Record<string, any> | undefined} _user Cached user info.
 * @returns {BackendService | undefined} Backend instance to be used.
 */
export const getBackend = (_user) => {
  // Determine the backend name based on the user cache or site config. Use the local backend if the
  // user cache is found and the backend name is `local`, which is used by Sveltia CMS, or `proxy`,
  // which is used by Netlify/Decap CMS when running the local proxy server. Otherwise, simply use
  // the backend name from the site config. This is to ensure that the user is signed in with the
  // correct backend, especially when the user cache is from a different backend than the current
  // site config.
  const _backendName =
    _user?.backendName === 'local' || _user?.backendName === 'proxy'
      ? 'local'
      : /** @type {InternalSiteConfig} */ (get(siteConfig)).backend.name;

  backendName.set(_backendName);

  return get(backend);
};

/**
 * Check if the user info is cached, set the backend, and automatically start loading files if the
 * backend is Git-based and user’s auth token is found.
 */
export const signInAutomatically = async () => {
  resetError();

  /** @type {Record<string, any> | undefined} */
  let _user = undefined;
  /** @type {Record<string, any> | undefined} */
  let copiedPrefs = undefined;

  ({ _user, copiedPrefs } = parseMagicLink());
  _user ??= await getUserCache();

  // If no cached user info is found, simply return as we cannot sign in automatically
  if (!_user) {
    return;
  }

  const _backend = getBackend(_user);

  if (_user && _backend) {
    // Temporarily populate the `user` store with the cache, otherwise it’s not updated in
    // `refreshAccessToken`
    user.set(/** @type {User} */ (_user));

    const { token, refreshToken } = _user;

    signingIn.set(true);

    try {
      _user = /** @type {User} */ (await _backend.signIn({ token, refreshToken, auto: true }));
    } catch {
      // The local backend may throw if the file handle permission is not given
      _user = undefined;
      user.set(undefined);
    }
  }

  signingIn.set(false);
  unauthenticated.set(!_user);

  if (!_user || !_backend) {
    return;
  }

  // Use the cached user to start fetching files
  user.set(/** @type {User} */ (_user));

  // Copy user preferences passed with QR code
  if (copiedPrefs) {
    prefs.update((currentPrefs) => ({ ...currentPrefs, ...copiedPrefs }));
  }

  try {
    await _backend.fetchFiles();
  } catch (/** @type {any} */ ex) {
    // The API request may fail if the cached token has been expired or revoked. Then let the user
    // sign in again. 404 Not Found is also considered an authentication error.
    // https://docs.github.com/en/rest/overview/troubleshooting-the-rest-api#404-not-found-for-an-existing-resource
    if ([401, 403, 404].includes(ex.cause?.status)) {
      unauthenticated.set(true);
    } else {
      logError(ex, 'dataFetch');
    }
  }
};

/**
 * Sign in with the given backend.
 * @param {string} _backendName Backend name to be used.
 * @param {string} [token] Personal Access Token (PAT) to be used for authentication.
 */
export const signInManually = async (_backendName, token) => {
  resetError();
  backendName.set(_backendName);

  const _backend = get(backend);

  if (!_backend) {
    return;
  }

  let _user;

  signingIn.set(true);

  try {
    _user = await _backend.signIn({ token, auto: false });
  } catch (/** @type {any} */ ex) {
    signingIn.set(false);
    unauthenticated.set(true);

    if (!!token && ex.cause?.status === 401) {
      // If the user is signing in using a personal access token (PAT) and the token is invalid,
      // display a specific error message.
      logError(
        new Error('Invalid token', { cause: { message: get(_)('sign_in_error.invalid_token') } }),
      );
    } else {
      logError(ex);
    }

    return;
  }

  signingIn.set(false);
  unauthenticated.set(!_user);

  if (!_user) {
    return;
  }

  user.set(_user);

  try {
    await _backend.fetchFiles();
  } catch (/** @type {any} */ ex) {
    logError(ex, 'dataFetch');
  }
};

/**
 * Sign out from the current backend.
 */
export const signOut = async () => {
  await get(backend)?.signOut();

  // Leave an empty user object in the local storage to prevent the user from being signed in
  // again automatically in `signInAutomatically`.
  await LocalStorage.set('sveltia-cms.user', {});

  backendName.set(undefined);
  user.set(undefined);
  unauthenticated.set(true);
  dataLoaded.set(false);

  const redirectURL = get(siteConfig)?.logout_redirect_url;

  if (redirectURL) {
    window.location.href = redirectURL;
  }
};
