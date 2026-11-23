import { sendRequest } from '$lib/services/utils/networking';

/**
 * @import { BackendServiceStatus } from '$lib/types/private';
 */

/**
 * Create a function to check a Git service status.
 * @param {string} url URL of the status API.
 * @param {(response: any) => BackendServiceStatus | undefined} getLevel Function to map the API
 * response to a status level. It may throw if the response is malformed.
 * @returns {() => Promise<BackendServiceStatus>} Function to check the status. It resolves to
 * `unknown` when the request fails or the response cannot be mapped.
 */
export const createStatusChecker = (url, getLevel) => async () => {
  try {
    return getLevel(await sendRequest(url)) ?? 'unknown';
  } catch {
    return 'unknown';
  }
};
