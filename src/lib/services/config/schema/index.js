import { isObject } from '@sveltia/utils/object';

import { applyCustomFieldSchemas } from '$lib/services/config/schema/custom-fields';
import { reportSchemaErrors } from '$lib/services/config/schema/errors';
import { compileSchema } from '$lib/services/config/schema/validator';

/**
 * @import { ConfigParserCollectors, ConfigSchemas } from '$lib/types/private';
 * @import { CmsConfig } from '$lib/types/public';
 */

export { getConfigSchemas } from '$lib/services/config/schema/loader';

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
 * @param {ConfigSchemas | undefined} args.schemas Schemas to validate against, if the app was
 * built with one.
 * @param {ConfigParserCollectors} args.collectors Collectors.
 */
export const validateConfigSchema = ({ config, schemas, collectors }) => {
  if (!schemas) {
    return;
  }

  try {
    const target = replaceRegExps(config);
    const errors = compileSchema(applyCustomFieldSchemas(schemas.strict))(target);

    if (!errors.length) {
      return;
    }

    const unknown = errors.filter(({ keyword }) => keyword === 'additionalProperties');

    // A property the schema doesn’t describe is only worth a warning, but it fails the object
    // holding it, and with it the branch of a union that object was meant to match — an
    // `index_file` written as an object would be reported as having to be a boolean, the only
    // branch left. So once an unknown property is found, everything else is collected again from
    // the schema that accepts one, where only the genuine violations remain.
    const violations = unknown.length
      ? compileSchema(applyCustomFieldSchemas(schemas.lenient))(target)
      : errors;

    reportSchemaErrors({ config, errors: [...unknown, ...violations], collectors });
  } catch (ex) {
    // eslint-disable-next-line no-console
    console.warn('Skipping configuration schema validation', ex);
  }
};
