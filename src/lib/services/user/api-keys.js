import { prefs } from '$lib/services/user/prefs.svelte';

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
