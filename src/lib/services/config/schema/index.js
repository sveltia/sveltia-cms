import { isObject } from '@sveltia/utils/object';

import { applyCustomFieldSchemas } from '$lib/services/config/schema/custom-fields';
import { reportSchemaErrors } from '$lib/services/config/schema/errors';
import { compileSchema } from '$lib/services/config/schema/validator';

/**
 * @import { ConfigParserCollectors } from '$lib/types/private';
 * @import { CmsConfig } from '$lib/types/public';
 */

export { getConfigSchema } from '$lib/services/config/schema/loader';

/**
 * Replace every regular expression object in a configuration with its source string, so it can be
 * validated as the pattern it stands for. A configuration file can only hold a pattern as a
 * string, which is what the schema describes, while the JS API also accepts a `RegExp` object
 * wherever a pattern is expected.
 * @param {any} value Configuration, or any value within it.
 * @returns {any} Value with every `RegExp` replaced.
 */
const replaceRegExps = (value) => {
  if (value instanceof RegExp) {
    return value.source;
  }

  if (Array.isArray(value)) {
    return value.map(replaceRegExps);
  }

  if (isObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, replaceRegExps(item)]),
    );
  }

  return value;
};

/**
 * Validate a CMS configuration against the JSON schema and collect any violation as a
 * configuration error.
 *
 * Nothing here can keep a user out of the CMS by accident: an unexpected failure skips validation
 * instead of failing the configuration.
 * @param {object} args Arguments.
 * @param {CmsConfig} args.config Raw CMS configuration.
 * @param {Record<string, any> | undefined} args.schema Schema to validate against, if the app was
 * built with one.
 * @param {ConfigParserCollectors} args.collectors Collectors.
 */
export const validateConfigSchema = ({ config, schema, collectors }) => {
  if (!schema) {
    return;
  }

  try {
    const errors = compileSchema(applyCustomFieldSchemas(schema))(replaceRegExps(config));

    if (errors.length) {
      reportSchemaErrors({ config, errors, collectors });
    }
  } catch (ex) {
    // eslint-disable-next-line no-console
    console.warn('Skipping configuration schema validation', ex);
  }
};
