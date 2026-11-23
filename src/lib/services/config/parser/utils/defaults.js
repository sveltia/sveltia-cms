import { addMessage } from '$lib/services/config/parser/utils/validator';

/**
 * @import { ConfigParserCollectors, ConfigParserContext } from '$lib/types/private';
 * @import { Field, VariableFieldType } from '$lib/types/public';
 */

/**
 * Check that the `default` option of a field with the `multiple` option has the matching shape: an
 * array of values when `multiple` is `true`, a single value otherwise. A mismatch is not an error
 * at runtime — the default is dropped, or the whole array is stored as one value — so a new entry
 * comes up empty or with an unexpected value.
 * @param {object} args Arguments.
 * @param {any} args.defaultValue The `default` option. `null` counts as no default.
 * @param {boolean} [args.multiple] The `multiple` option. Default: `false`.
 * @param {ConfigParserContext} args.context Context.
 * @param {ConfigParserCollectors} args.collectors Collectors.
 */
export const checkMultipleDefault = ({ defaultValue, multiple = false, context, collectors }) => {
  // An empty `default:` line in YAML is `null`, which means no default just like an omitted option
  if (defaultValue === undefined || defaultValue === null) {
    return;
  }

  const isArray = Array.isArray(defaultValue);

  if (multiple && !isArray) {
    addMessage({ strKey: 'invalid_default_multiple', context, collectors });
  }

  if (!multiple && isArray) {
    addMessage({ strKey: 'invalid_default_single', context, collectors });
  }
};

/**
 * Report the properties of a default object that don’t name a subfield. Such a property would be
 * saved to the entry file as-is, so it’s most likely a typo.
 * @param {object} args Arguments.
 * @param {Record<string, any>} args.value Default object.
 * @param {Field[]} args.fields Subfields the object can have.
 * @param {string} args.strKeyBase Base of the i18n string key, e.g. `list_field`.
 * @param {ConfigParserContext} args.context Context.
 * @param {ConfigParserCollectors} args.collectors Collectors.
 */
const checkObjectDefaultKeys = ({ value, fields, strKeyBase, context, collectors }) => {
  const names = fields.map(({ name }) => name);

  Object.keys(value)
    .filter((key) => !names.includes(key))
    .forEach((key) => {
      addMessage({
        strKey: `${strKeyBase}_invalid_default_key`,
        values: { key },
        context,
        collectors,
      });
    });
};

/**
 * Check a default object of an Object field or a List field item against the subfields it can
 * have: the `fields`, or the fields of the variable type it names with the `typeKey` property.
 * @param {object} args Arguments.
 * @param {Record<string, any>} args.value Default object.
 * @param {Field[]} [args.fields] The `fields` option.
 * @param {VariableFieldType[]} [args.types] The `types` option, used if `fields` is not defined.
 * @param {string} [args.typeKey] The `typeKey` option. Default: `type`.
 * @param {string} args.strKeyBase Base of the i18n string keys, e.g. `list_field`, which the
 * `_invalid_default_key`, `_default_missing_type` and `_invalid_default_type` suffixes are added
 * to.
 * @param {ConfigParserContext} args.context Context.
 * @param {ConfigParserCollectors} args.collectors Collectors.
 */
export const checkObjectDefault = ({
  value,
  fields,
  types,
  typeKey = 'type',
  strKeyBase,
  context,
  collectors,
}) => {
  const keysArgs = { value, strKeyBase, context, collectors };

  if (fields) {
    checkObjectDefaultKeys({ ...keysArgs, fields });

    return;
  }

  const typeName = value[typeKey];

  if (typeName === undefined) {
    addMessage({
      strKey: `${strKeyBase}_default_missing_type`,
      values: { typeKey },
      context,
      collectors,
    });

    return;
  }

  const type = types?.find(({ name }) => name === typeName);

  if (!type) {
    addMessage({
      strKey: `${strKeyBase}_invalid_default_type`,
      values: { typeKey, value: String(typeName) },
      context,
      collectors,
    });

    return;
  }

  // The type key is a valid property although it’s not a field
  checkObjectDefaultKeys({
    ...keysArgs,
    fields: [...(type.fields ?? []), /** @type {Field} */ ({ name: typeKey })],
  });
};
