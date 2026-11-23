import { getAdditions } from '$lib/services/app/additions';
import { prefs } from '$lib/services/user/prefs.svelte';

/**
 * Get the API keys and the deploy hook an admin of Sveltia CMS Additions has shared with everyone.
 * @returns {{ apiKeys: Record<string, string>, deployHook?: { url: string, authHeader: string } |
 * null }} Credentials, empty without Sveltia CMS Additions.
 */
const getSharedCredentials = () => getAdditions()?.sharedCredentials ?? { apiKeys: {} };

/**
 * Store an API key for an external service, such as a translator or a stock photo provider, in the
 * user preferences.
 * @param {string} serviceId Service ID.
 * @param {string} apiKey API key. An empty string removes the key.
 */
export const setApiKey = (serviceId, apiKey) => {
  prefs.apiKeys ??= {};
  prefs.apiKeys[serviceId] = apiKey;
};

/**
 * Check whether an API key doesn’t look like one of its service, which would make every request
 * fail. An empty key, or one for a service without a known format, isn’t checked.
 * @param {string} apiKey API key, without surrounding whitespace.
 * @param {RegExp | undefined} pattern Pattern the service’s API keys match.
 * @returns {boolean} Whether the key is wrong.
 */
export const isInvalidApiKey = (apiKey, pattern) => !!apiKey && !!pattern && !pattern.test(apiKey);

/**
 * Store an API key for an external service in the user preferences once it matches the pattern
 * expected by the service, e.g. while the user is typing or pasting the key.
 * @param {string} serviceId Service ID.
 * @param {string} value API key as entered by the user. Surrounding whitespace is ignored.
 * @param {RegExp | undefined} pattern Pattern the API key has to match. Without a pattern, the key
 * is never saved.
 * @returns {string | undefined} Saved API key, or `undefined` if it doesn’t match the pattern.
 */
export const saveApiKey = (serviceId, value, pattern) => {
  const apiKey = value.trim();

  if (!pattern?.test(apiKey)) {
    return undefined;
  }

  setApiKey(serviceId, apiKey);

  return apiKey;
};

/**
 * Get the API key to use for an external service: the user’s own, or else the one an admin of
 * Sveltia CMS Additions has shared with everyone.
 * @param {string} serviceId Service ID.
 * @returns {string} API key, or an empty string if there is none.
 */
export const getApiKey = (serviceId) =>
  prefs.apiKeys?.[serviceId] || getSharedCredentials().apiKeys[serviceId] || '';

/**
 * Check whether the API key used for an external service is the one shared by an admin, as the
 * user hasn’t entered their own.
 * @param {string} serviceId Service ID.
 * @returns {boolean} Result.
 */
export const isSharedApiKey = (serviceId) =>
  !prefs.apiKeys?.[serviceId] && !!getSharedCredentials().apiKeys[serviceId];

/**
 * Get the deploy hook to call: the user’s own, or else the one an admin of Sveltia CMS Additions
 * has shared. The two are never mixed, so the user’s URL isn’t sent the admin’s header.
 * @returns {{ url: string, authHeader: string } | undefined} Hook, if any.
 */
export const getDeployHook = () => {
  const { deployHookURL, deployHookAuthHeader } = prefs;

  if (deployHookURL) {
    return { url: deployHookURL, authHeader: deployHookAuthHeader ?? '' };
  }

  return getSharedCredentials().deployHook ?? undefined;
};

/**
 * Check whether the deploy hook used is the one shared by an admin, as the user hasn’t entered
 * their own.
 * @returns {boolean} Result.
 */
export const isSharedDeployHook = () => !prefs.deployHookURL && !!getSharedCredentials().deployHook;
