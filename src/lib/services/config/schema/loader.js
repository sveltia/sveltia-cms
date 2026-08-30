import configSchema from 'virtual:config-schema';

import { prepareSchema } from '$lib/services/config/schema/transform';

/**
 * The schema adapted for validation. Preparing it walks the whole schema, so the result is kept for
 * the next configuration load.
 * @type {Record<string, any> | undefined}
 */
let preparedSchema = undefined;

/**
 * Get the JSON schema to validate a configuration file against. The schema is bundled with the app,
 * so nothing is downloaded and validation works offline.
 * @returns {Record<string, any> | undefined} Schema, or `undefined` when the app was built without
 * one, which only happens on a dev server that has never run a production build. Schema validation
 * is skipped in that case.
 */
export const getConfigSchema = () => {
  if (!configSchema) {
    return undefined;
  }

  preparedSchema ??= prepareSchema(configSchema);

  return preparedSchema;
};
