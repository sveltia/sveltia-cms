import { fetchAPI } from '$lib/services/backends/git/shared/api';

/**
 * Send a request to the REST API of a Git-based service for something that may not exist, such as
 * a branch, a file or a reference. A `404 Not Found` answer means it doesn’t, which is not an error
 * here; any other failure, like an expired token or an outage, is passed on. This lives apart from
 * {@link fetchAPI}, so a test replacing that module still has its requests go through this one.
 * @param {Parameters<typeof fetchAPI>} args Arguments for {@link fetchAPI}: the API endpoint path
 * and, optionally, the fetch options. They’re passed on as given.
 * @returns {Promise<any>} Response data, or `undefined` if the resource is missing.
 * @throws {Error} When the request fails for any other reason.
 */
export const fetchAPIOrUndefined = async (...args) => {
  try {
    return await fetchAPI(...args);
  } catch (/** @type {any} */ ex) {
    if (ex?.cause?.status === 404) {
      return undefined;
    }

    throw ex;
  }
};
