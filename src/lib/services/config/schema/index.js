import Ajv from 'ajv';

import { applyCustomFieldSchemas } from '$lib/services/config/schema/custom-fields';
import { reportSchemaErrors } from '$lib/services/config/schema/errors';

/**
 * @import { ErrorObject } from 'ajv';
 * @import { ConfigParserCollectors } from '$lib/types/private';
 * @import { CmsConfig } from '$lib/types/public';
 */

export { getConfigSchema } from '$lib/services/config/schema/loader';

/**
 * Validate a CMS configuration against the JSON schema and collect any violation as a
 * configuration error.
 *
 * Nothing here can keep a user out of the CMS by accident: a missing schema, a content security
 * policy that blocks the validator from compiling, or an unexpected failure anywhere in between
 * all skip validation instead of failing the configuration. In that case `schemaValidated` is left
 * unset, and the parser falls back to checking the structure itself.
 * @param {object} args Arguments.
 * @param {CmsConfig} args.config Raw CMS configuration.
 * @param {Record<string, any> | undefined} args.schema Schema to validate against, if it could be
 * downloaded.
 * @param {ConfigParserCollectors} args.collectors Collectors.
 */
export const validateConfigSchema = ({ config, schema, collectors }) => {
  if (!schema) {
    return;
  }

  try {
    // `strict` would reject the schema’s own annotation keywords, and `allErrors` reports every
    // problem at once instead of stopping at the first. Formats are only used for documentation,
    // so checking them would add a dependency without catching anything.
    const validate = new Ajv({ strict: false, allErrors: true, validateFormats: false }).compile(
      applyCustomFieldSchemas(schema),
    );

    if (!validate(config)) {
      // Ajv always reports at least one error when validation fails
      reportSchemaErrors({
        config,
        errors: /** @type {ErrorObject[]} */ (validate.errors),
        collectors,
      });
    }

    // Let the parser know the structural checks are covered, so it doesn’t repeat them. This is
    // only set once the configuration has actually been through the validator.
    collectors.schemaValidated = true;
  } catch (ex) {
    // eslint-disable-next-line no-console
    console.warn('Skipping configuration schema validation', ex);
  }
};
