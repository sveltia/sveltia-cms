/**
 * @import { ConfigParserCollectors } from '$lib/types/private';
 */

/**
 * Create a fresh collectors object for a configuration parser test.
 * @returns {ConfigParserCollectors} Collectors, all empty.
 */
export const createCollectors = () => ({
  errors: new Set(),
  warnings: new Set(),
  mediaFields: new Set(),
  relationFields: new Set(),
});
