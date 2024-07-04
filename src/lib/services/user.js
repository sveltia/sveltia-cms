import { isObject } from '@sveltia/utils/object';
import { LocalStorage } from '@sveltia/utils/storage';
import { _ } from 'svelte-i18n';
import { get, writable } from 'svelte/store';
import { dataLoaded } from '$lib/services/contents';
import { siteConfig } from '$lib/services/config';
import { backend, backendName } from '$lib/services/backends';

/**
 * @type {import('svelte/store').Writable<User | null | undefined>}
 */
export const user = writable();

user.subscribe((_user) => {
  (async () => {
    try {
      if (_user) {
        await LocalStorage.set('sveltia-cms.user', _user);
      } else if (_user === null) {
        await LocalStorage.delete('sveltia-cms.user');
      }
    } catch {
      //
    }
  })();
});

/**
 * @type {import('svelte/store').Writable<{ message: string, canRetry: boolean }>}
 */
export const signInError = writable({ message: '', canRetry: false });
/**
 * @type {import('svelte/store').Writable<boolean>}
 */
export const unauthenticated = writable(true);

/**
 * Log an authentication error on the UI and in the browser console.
 * @param {Error} ex - Exception.
 */
const logError = (ex) => {
  let message =
    /** @type {{ message: string }} */ (ex.cause)?.message || get(_)('unexpected_error');

  let canRetry = false;

  if (ex.name === 'NotFoundError') {
    message = get(_)('sign_in_error.not_project_root');
    canRetry = true;
  }

  if (ex.name === 'AbortError') {
    message = get(_)(
      get(backendName) === 'local'
        ? 'sign_in_error.picker_dismissed'
        : 'sign_in_error.authentication_aborted',
    );
    canRetry = true;
  }

  signInError.set({ message, canRetry });
  // eslint-disable-next-line no-console
  console.error(ex.message, ex.cause);
};

/**
 * Check if the user info is cached, set the backend, and automatically start loading files if the
 * backend is Git-based and user’s auth token is found.
 */
export const signInAutomatically = async () => {
  // Find cached user info, including a compatible Netlify/Decap CMS user object
  const userCache =
    (await LocalStorage.get('sveltia-cms.user')) ||
    (await LocalStorage.get('decap-cms-user')) ||
    (await LocalStorage.get('netlify-cms-user'));

  let _user = isObject(userCache) && !!userCache.backendName ? userCache : undefined;

  // Netlify/Decap CMS uses `proxy` as the backend name when running the local proxy server and
  // leaves it in local storage. Sveltia CMS uses `local` instead.
  const _backendName =
    _user?.backendName?.replace('proxy', 'local') ?? get(siteConfig)?.backend?.name;

  backendName.set(_backendName);

  const _backend = get(backend);

  if (_user && _backend) {
    try {
      _user = await _backend.signIn({ token: _user.token, auto: true });
    } catch {
      // The local backend may throw if the file handle permission is not given
      _user = undefined;
    }
  }

  unauthenticated.set(!_user);

  if (!_user || !_backend) {
    return;
  }

  // Use the cached user to start fetching files
  user.set(_user);

  try {
    await _backend.fetchFiles();
    // Reset error
    signInError.set({ message: '', canRetry: false });
  } catch (/** @type {any} */ ex) {
    // The API request may fail if the cached token has been expired or revoked. Then let the user
    // sign in again. 404 Not Found is also considered an authentication error.
    // https://docs.github.com/en/rest/overview/troubleshooting-the-rest-api#404-not-found-for-an-existing-resource
    if ([401, 403, 404].includes(ex.cause?.status)) {
      unauthenticated.set(true);
    } else {
      logError(ex);
    }
  }
};

/**
 * Sign in with the given backend.
 * @param {string} _backendName - Backend name to be used.
 */
export const signInManually = async (_backendName) => {
  backendName.set(_backendName);

  const _backend = get(backend);

  if (!_backend) {
    return;
  }

  let _user;

  try {
    _user = await _backend.signIn({ auto: false });
  } catch (/** @type {any} */ ex) {
    unauthenticated.set(true);
    logError(ex);

    return;
  }

  unauthenticated.set(!_user);

  if (!_user) {
    return;
  }

  user.set(_user);

  try {
    await _backend.fetchFiles();
    // Reset error
    signInError.set({ message: '', canRetry: false });
  } catch (/** @type {any} */ ex) {
    logError(ex);
  }
};

/**
 * Sign out from the current backend.
 */
export const signOut = async () => {
  await get(backend)?.signOut();
  await LocalStorage.delete('sveltia-cms.user');
  backendName.set(undefined);
  user.set(undefined);
  unauthenticated.set(true);
  dataLoaded.set(false);
};
