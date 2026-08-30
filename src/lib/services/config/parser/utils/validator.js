import { _, locale as appLocale } from '@sveltia/i18n';

import { getListFormatter } from '$lib/services/contents/i18n';
import { makeLink } from '$lib/services/utils/string';

/**
 * @import {
 * ConfigParserContext,
 * ConfigParserCollectors,
 * UnsupportedOption,
 * } from '$lib/types/private';
 */

const INVALID_FIELD_NAME_DOC_URL =
  'https://sveltiacms.app/en/docs/troubleshooting#using-proper-naming-conventions';

const COMPATIBILITY_DOC_URL =
  'https://sveltiacms.app/en/docs/migration/netlify-decap-cms#features-not-to-be-implemented';

/**
 * Add an error or warning message to the error collector with context information.
 * @param {object} args Arguments.
 * @param {'error' | 'warning'} [args.type] The type of the message.
 * @param {string} args.strKey The i18n string key for the message.
 * @param {Record<string, string | undefined>} [args.values] Values for the i18n string.
 * @param {string} [args.extraStrKey] An extra i18n string key to append to the message.
 * @param {ConfigParserContext} [args.context] The field parser context.
 * @param {ConfigParserCollectors} args.collectors The collectors.
 * @param {boolean} [args.schemaCovered] Whether the JSON schema reports the same problem. Such a
 * message is skipped once the configuration has been validated against the schema, so that one
 * mistake never yields two messages.
 */
export const addMessage = ({
  type = 'error',
  strKey,
  values = {},
  extraStrKey,
  context = {},
  collectors,
  schemaCovered = false,
}) => {
  if (schemaCovered && collectors.schemaValidated) {
    return;
  }

  const { collection, collectionFile, componentName, typedKeyPath } = context;
  const { errors, warnings } = collectors;
  const locators = [];

  if (collection) {
    locators.push(
      _('config.error_locator.collection', {
        // An empty label is as good as none, so fall back the same way the UI does
        values: { collection: collection.label_singular || collection.label || collection.name },
      }),
    );
  }

  if (collectionFile) {
    locators.push(
      _('config.error_locator.file', {
        values: { file: collectionFile.label || collectionFile.name },
      }),
    );
  }

  if (componentName) {
    locators.push(
      _('config.error_locator.component', {
        values: { component: componentName },
      }),
    );
  }

  if (typedKeyPath) {
    locators.push(
      _('config.error_locator.field', {
        values: { field: typedKeyPath },
      }),
    );
  }

  const collector = type === 'error' ? errors : warnings;
  const locale = appLocale.current;
  const locatorStr = locators.length ? `${getListFormatter(locale).format(locators)}: ` : '';
  let message = _(`config.${type}.${strKey}`, { values });

  if (strKey === 'invalid_field_name') {
    message = makeLink(message, INVALID_FIELD_NAME_DOC_URL);
  }

  const extraMessage = extraStrKey
    ? _(`config.${extraStrKey}`, {
        values: { link: extraStrKey === 'compatibility_link' ? COMPATIBILITY_DOC_URL : undefined },
      })
    : '';

  collector.add(`${locatorStr}${message}${extraMessage ? ` ${extraMessage}` : ''}`);
};

/**
 * Check for unsupported deprecated options in a configuration and add messages if found.
 * @param {object} args Arguments.
 * @param {UnsupportedOption[]} args.UNSUPPORTED_OPTIONS Array of unsupported option mappings.
 * @param {Record<string, any>} args.config Configuration to check. Usually a field config.
 * @param {ConfigParserContext} args.context Context.
 * @param {ConfigParserCollectors} args.collectors Collectors.
 */
export const checkUnsupportedOptions = ({ UNSUPPORTED_OPTIONS, config, context, collectors }) => {
  UNSUPPORTED_OPTIONS.forEach(
    ({ type = 'error', prop, newProp, value, strKey = 'unsupported_deprecated_option' }) => {
      if (prop in config && (value === undefined || config[prop] === value)) {
        addMessage({
          type,
          strKey,
          values: { prop, newProp },
          extraStrKey: 'compatibility_link',
          context,
          collectors,
        });
      }
    },
  );
};

/**
 * Regular expression to validate names. A valid name is a non-empty string that does not contain
 * spaces, dots, asterisks, colons or angle brackets. Dots are used as separators in key paths,
 * asterisks are used for wildcard matching for relation fields, colons are used for editor
 * component identification, and angle brackets are used for variable type placeholders.
 */
export const VALID_NAME_REGEX = /^[^\s.*:<>]+$/;

/**
 * Checks if the given name is valid.
 * @param {string} name Name to check.
 * @returns {boolean} `true` if the name is valid, `false` otherwise.
 */
export const isValidName = (name) => VALID_NAME_REGEX.test(name);

/**
 * Check if the given collection name, collection file name, field name or variable type name is
 * valid and not duplicated. Adds messages to the collectors if invalid or duplicated.
 * @param {object} args Arguments.
 * @param {any} args.name Name to check.
 * @param {number} args.index Index of the item in the array, used for error messages.
 * @param {Record<string, number>} args.nameCounts Record of name counts. The keys are the names and
 * the values are the counts.
 * @param {string} args.strKeyBase I18n string key for the name message, excluding "missing_" or
 * "invalid_".
 * @param {ConfigParserContext} args.context Context.
 * @param {ConfigParserCollectors} args.collectors Collectors.
 * @param {boolean} [args.required] Whether a missing name must be reported even when the JSON
 * schema has been applied. The schema requires a `name` almost everywhere, so this is only needed
 * where it can’t, such as a view group or filter in the object format.
 * @returns {boolean} `true` if the name is valid, `false` otherwise.
 */
export const checkName = ({
  name,
  index,
  nameCounts,
  strKeyBase,
  context,
  collectors,
  required = false,
}) => {
  if (typeof name !== 'string' || !name) {
    // Use count (1-based index) for user-facing messages
    const count = String(index + 1);

    addMessage({
      strKey: `missing_${strKeyBase}`,
      context,
      values: { count },
      collectors,
      // An empty string satisfies the schema, and a name the schema can’t require has to be
      // reported here or nowhere; anything else the schema has already said
      schemaCovered: name !== '' && !(required && name === undefined),
    });

    return false;
  }

  if (!isValidName(name)) {
    addMessage({ strKey: `invalid_${strKeyBase}`, context, values: { name }, collectors });

    return false;
  }

  // Check for duplicates, the second occurrence will be caught here
  if (nameCounts[name] === 1) {
    addMessage({ strKey: `duplicate_${strKeyBase}`, context, values: { name }, collectors });

    return false;
  }

  nameCounts[name] = (nameCounts[name] ?? 0) + 1;

  return true;
};
