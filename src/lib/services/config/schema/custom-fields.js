import { isObject } from '@sveltia/utils/object';

import { customFieldTypeRegistry } from '$lib/services/api/registries';
import metaSchema from '$lib/services/config/schema/draft-07.json';
import { prepareSchema } from '$lib/services/config/schema/transform';
import { compileSchema } from '$lib/services/config/schema/validator';

/**
 * Build a conditional schema for each field type registered with a schema, applying that schema to
 * the fields that use the type. A schema that can’t be compiled is dropped with a warning, so one
 * bad registration can’t stop the rest of the configuration from being validated.
 * @returns {Record<string, any>[]} Conditional schemas.
 */
const getCustomFieldSchemas = () => {
  /** @type {Record<string, any>[]} */
  const schemas = [];
  /** @type {((schema: any) => any[]) | undefined} */
  let validateSchema;

  customFieldTypeRegistry.forEach(({ schema }, name) => {
    if (!isObject(schema)) {
      return;
    }

    // The validator interprets a schema rather than compiling it, so it accepts a malformed one and
    // then rejects everything it’s applied to. Checking against the JSON Schema meta-schema catches
    // that here, where the field type can be named, instead of at every field using it.
    validateSchema ??= compileSchema(metaSchema);

    if (validateSchema(schema).length) {
      // eslint-disable-next-line no-console
      console.warn(`Ignoring the invalid schema registered for the \`${name}\` field type`);

      return;
    }

    // A registered schema describes the options the field type adds, not the whole field, so an
    // `additionalProperties: false` in it would reject the common options every field has. Unknown
    // options are tolerated everywhere else, so they are here too.
    schemas.push({
      if: { required: ['widget'], properties: { widget: { const: name } } },
      then: prepareSchema(schema),
    });
  });

  return schemas;
};

/**
 * Extend the configuration schema with the field type schemas registered through the
 * `CMS.registerFieldType()` API, so that the options a custom field type accepts are validated
 * alongside the built-in ones.
 *
 * A field whose type isn’t built in is validated as a `CustomField`, so that’s where the registered
 * options belong. The registry is read on every configuration load rather than baked into the
 * downloaded schema, because field types are registered by the site’s own script.
 * @param {Record<string, any>} schema Schema to extend.
 * @returns {Record<string, any>} Extended schema, or the original one if no field type has been
 * registered with a schema.
 * @see https://decapcms.org/docs/custom-widgets/#registerwidget
 * @see https://sveltiacms.app/en/docs/api/field-types
 */
export const applyCustomFieldSchemas = (schema) => {
  const customField = schema.definitions?.CustomField;
  const schemas = isObject(customField) ? getCustomFieldSchemas() : [];

  if (!schemas.length) {
    return schema;
  }

  return {
    ...schema,
    definitions: {
      ...schema.definitions,
      CustomField: { allOf: [customField, ...schemas] },
    },
  };
};
