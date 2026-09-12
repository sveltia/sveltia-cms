// cSpell:ignore Nominatim jsonv2

import { sendRequest } from '$lib/services/utils/networking';

/**
 * A location found by the geocoding service.
 * @typedef {object} LocationSearchResult
 * @property {string} place_id Unique identifier of the search result.
 * @property {string} display_name Display name of the search result.
 * @property {string} lat Latitude of the search result.
 * @property {string} lon Longitude of the search result.
 * @see https://nominatim.org/release-docs/develop/api/Search/
 */

/**
 * Endpoint of the Nominatim search API.
 */
const SEARCH_API_URL = 'https://nominatim.openstreetmap.org/search';

/**
 * Search for locations matching the given query using the Nominatim API.
 * @param {string} query Free-form query, e.g. an address or a place name.
 * @returns {Promise<LocationSearchResult[]>} Matching locations. Empty if the query is blank or
 * the request has failed.
 * @see https://nominatim.org/release-docs/develop/api/Search/
 */
export const searchLocations = async (query) => {
  const q = query.trim();

  if (!q) {
    return [];
  }

  const params = new URLSearchParams({ q, format: 'jsonv2' });

  try {
    return /** @type {LocationSearchResult[]} */ (await sendRequest(`${SEARCH_API_URL}?${params}`));
  } catch {
    return [];
  }
};
