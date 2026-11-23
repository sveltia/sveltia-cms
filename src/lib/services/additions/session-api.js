import { fetchAdditions } from '$lib/services/additions/api';
import { user } from '$lib/services/user/account.svelte';

/**
 * Send a request to the Sveltia CMS Additions API as the signed-in user, with their session token.
 * @param {string} path Path, e.g. `/v1/users`.
 * @param {object} [options] Options.
 * @param {string} [options.method] HTTP method.
 * @param {Record<string, any>} [options.body] JSON body.
 * @returns {Promise<any>} Parsed response.
 * @throws {Error} When the service can’t be reached or responds with an error.
 */
export const fetchWithSession = (path, { method, body } = {}) =>
  fetchAdditions(path, { method, body, token: user.account?.refreshToken });
