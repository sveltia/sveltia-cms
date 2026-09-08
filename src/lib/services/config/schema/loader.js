import configSchema from 'virtual:config-schema';

import { prepareSchema } from '$lib/services/config/schema/transform';

/**
 * @import { ConfigSchemas } from '$lib/types/private';
 */

/**
 * The schemas adapted for validation. Preparing them walks the whole schema, so the result is kept
 * for the next configuration load.
 * @type {ConfigSchemas | undefined}
 */
let preparedSchemas = undefined;

/**
 * Get the JSON schemas to validate a configuration file against. The schema is bundled with the
 * app, so nothing is downloaded and validation works offline.
 *
 * Two variants are prepared from it, because an unknown property is only worth a warning while
 * anything else is an error, and the two can’t be told apart in a single pass: an unknown property
 * fails the object holding it, and with it the branch of a union that object was meant to match.
 * The strict variant is what finds the unknown properties; the lenient one, which accepts them,
 * is what finds the violations.
 * @returns {ConfigSchemas | undefined} Schemas, or `undefined` when the app was built without one,
 * which only happens on a dev server that has never run a production build. Schema validation is
 * skipped in that case.
 */
export const getConfigSchemas = () => {
  if (!configSchema) {
    return undefined;
  }

  preparedSchemas ??= {
    strict: prepareSchema(configSchema),
    lenient: prepareSchema(configSchema, { allowUnknownProperties: true }),
  };

  return preparedSchemas;
};
