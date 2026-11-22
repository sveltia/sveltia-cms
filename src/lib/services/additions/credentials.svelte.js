import { fetchWithSession } from '$lib/services/additions/session-api';
import { onSocketMessage } from '$lib/services/additions/socket.svelte';
import { createGeneration } from '$lib/services/utils/generation';

/**
 * Credentials an admin of Sveltia CMS Additions shares with everyone who uses the CMS. They’re kept
 * in memory rather than in the preferences, so they’re never mixed with the user’s own and don’t
 * stay in the browser after signing out.
 * @typedef {object} SharedCredentials
 * @property {Record<string, string>} apiKeys API keys by service ID, e.g. `deepl`.
 * @property {{ url: string, authHeader: string } | null} deployHook Deploy hook, with the
 * `Authorization` header to send with it, if any.
 */

/**
 * The shared credentials, empty until loaded, and without Sveltia CMS Additions.
 * @type {SharedCredentials}
 */
export const sharedCredentials = $state({ apiKeys: {}, deployHook: null });

/**
 * Credentials as the service returns them.
 * @typedef {object} AdditionsCredentials
 * @property {Record<string, string>} api_keys API keys by service ID.
 * @property {{ url: string, auth_header: string } | null} deploy_hook Deploy hook.
 */

/**
 * Store the credentials the service has returned.
 * @param {AdditionsCredentials} credentials Credentials.
 */
const applyCredentials = ({ api_keys: apiKeys, deploy_hook: deployHook }) => {
  Object.assign(sharedCredentials, {
    apiKeys,
    deployHook: deployHook ? { url: deployHook.url, authHeader: deployHook.auth_header } : null,
  });
};

/**
 * Generation of the credentials, which is bumped once they’ve been forgotten, so a request still in
 * flight when the user signs out doesn’t bring them back.
 */
const generation = createGeneration();

/**
 * Forget the shared credentials, e.g. once the user has signed out.
 */
const clearCredentials = () => {
  generation.bump();
  Object.assign(sharedCredentials, { apiKeys: {}, deployHook: null });
};

/**
 * Fetch the shared credentials.
 * @returns {Promise<void>}
 * @throws {Error} When they can’t be fetched.
 */
export const fetchCredentials = async () => {
  const isCurrent = generation.capture();
  const credentials = await fetchWithSession('/v1/credentials');

  if (isCurrent()) {
    applyCredentials(credentials);
  }
};

/**
 * Load the shared credentials. A failure leaves the previous ones in place: the user can still
 * enter their own.
 * @returns {Promise<void>}
 */
export const loadCredentials = async () => {
  try {
    await fetchCredentials();
  } catch {
    //
  }
};

/**
 * Replace the shared credentials, as an admin.
 * @param {SharedCredentials} credentials Credentials. Empty values are dropped.
 * @returns {Promise<void>}
 * @throws {Error} When the service refuses them.
 */
export const saveCredentials = async ({ apiKeys, deployHook }) => {
  applyCredentials(
    await fetchWithSession('/v1/settings/credentials', {
      method: 'PUT',
      body: {
        api_keys: apiKeys,
        deploy_hook: deployHook
          ? { url: deployHook.url, auth_header: deployHook.authHeader }
          : null,
      },
    }),
  );
};

/**
 * Load the shared credentials for as long as the user is signed in, and again whenever an admin
 * changes them. The socket itself is opened with the locks.
 * @returns {() => void} Function to forget them once the user signs out.
 */
export const startCredentials = () => {
  loadCredentials();

  onSocketMessage('credentials', () => {
    loadCredentials();
  });

  return clearCredentials;
};
