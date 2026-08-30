import { SCHEMA_FETCH_TIMEOUT, SCHEMA_VALIDATION_URL } from '$lib/services/config/constants';
import { prepareSchema } from '$lib/services/config/schema/transform';

/**
 * The schema being downloaded, or the one already downloaded. The schema doesn’t change while the
 * app is running, so it’s only fetched once.
 * @type {Promise<Record<string, any>> | undefined}
 */
let schemaLoader = undefined;

/**
 * Download the JSON schema and adapt it for runtime validation.
 * @returns {Promise<Record<string, any>>} Schema.
 * @throws {Error} When the schema cannot be downloaded within {@link SCHEMA_FETCH_TIMEOUT}.
 */
const fetchSchema = async () => {
  const response = await fetch(SCHEMA_VALIDATION_URL, {
    signal: AbortSignal.timeout(SCHEMA_FETCH_TIMEOUT),
  });

  if (!response.ok) {
    throw new Error('Failed to load the configuration schema', { cause: response });
  }

  return prepareSchema(await response.json());
};

/**
 * Get the JSON schema to validate a configuration file against.
 * @returns {Promise<Record<string, any> | undefined>} Schema, or `undefined` if it couldn’t be
 * downloaded. Schema validation is skipped in that case, so that a network problem or a strict
 * content security policy never keeps anyone out of the CMS.
 */
export const getConfigSchema = async () => {
  schemaLoader ??= fetchSchema();

  try {
    return await schemaLoader;
  } catch (ex) {
    // Allow a transient failure to be retried the next time the configuration is loaded
    schemaLoader = undefined;
    // eslint-disable-next-line no-console
    console.warn('Skipping configuration schema validation', ex);

    return undefined;
  }
};
