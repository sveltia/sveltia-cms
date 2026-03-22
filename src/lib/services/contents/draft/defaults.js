import { GET_DEFAULT_VALUE_MAP_FUNCTIONS } from '$lib/services/contents/fields/defaults';

/**
 * @import {
 * FlattenedEntryContent,
 * InternalLocaleCode,
 * PopulateDefaultValueArgs,
 * } from '$lib/types/private';
 * @import { Field } from '$lib/types/public';
 */

/**
 * Populate the default value for the given field. Check if a dynamic default value is specified,
 * then look for the field configuration’s `default` property.
 * @param {PopulateDefaultValueArgs} args Arguments.
 * @returns {void} The `content` object is modified in place.
 */
export const populateDefaultValue = ({
  content,
  keyPath,
  fieldConfig,
  locale,
  defaultLocale,
  dynamicValues,
}) => {
  // @ts-ignore `default` is not defined in the Compute and custom field types
  const { widget: fieldType = 'string', default: defaultValue, i18n = false } = fieldConfig;

  // For non-default locales, only set the default value if the field is i18n-enabled
  if (locale !== defaultLocale && [false, 'none'].includes(i18n)) {
    return;
  }

  // The `compute` field type doesn’t have the `default` option, so we just set an empty string,
  // otherwise the field won’t work properly
  if (fieldType === 'compute') {
    content[keyPath] = '';

    return;
  }

  const dynamicValue =
    // Ignore the dynamic value if the key path looks like an array item, e.g. `tags.0` or
    // `tags.0.name`, because lists are complicated to handle
    keyPath in dynamicValues && !/\.\d+(?:\.|$)/.test(keyPath)
      ? dynamicValues[keyPath].trim() || undefined
      : undefined;

  const getDefaultValue = GET_DEFAULT_VALUE_MAP_FUNCTIONS[fieldType];

  if (getDefaultValue) {
    Object.assign(
      content,
      getDefaultValue({
        fieldConfig,
        keyPath,
        locale,
        defaultLocale,
        dynamicValue,
        populateDefault: populateDefaultValue,
      }),
    );

    return;
  }

  // Handle simple string-type fields, including the built-in `color`, `uuid`, `string` and `text`
  // field types as well as custom field types
  content[keyPath] = dynamicValue || defaultValue || '';
};

/**
 * Get the default values for the given fields. If dynamic default values are given, these values
 * take precedence over static default values defined with the CMS configuration.
 * @param {object} args Arguments.
 * @param {Field[]} args.fields Field list of a collection.
 * @param {InternalLocaleCode} args.locale Locale.
 * @param {InternalLocaleCode} args.defaultLocale Default locale of the entry draft.
 * @param {Record<string, string>} [args.dynamicValues] Dynamic default values.
 * @returns {FlattenedEntryContent} Flattened entry content for creating a new draft content or
 * adding a new list item.
 */
export const getDefaultValues = ({ fields, locale, defaultLocale, dynamicValues = {} }) => {
  /** @type {FlattenedEntryContent} */
  const content = {};

  fields.forEach((fieldConfig) => {
    populateDefaultValue({
      content,
      keyPath: fieldConfig.name,
      fieldConfig,
      locale,
      defaultLocale,
      dynamicValues,
    });
  });

  return content;
};
