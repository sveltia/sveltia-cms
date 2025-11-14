import { get } from 'svelte/store';
import { _, locale as appLocale } from 'svelte-i18n';

import { getListFormatter } from '$lib/services/contents/i18n';

/**
 * @import {
 * ConfigParserContext,
 * ConfigParserCollectors,
 * UnsupportedOption,
 * } from '$lib/types/private';
 */

/**
 * Add an error or warning message to the error collector with context information.
 * @param {object} args Arguments.
 * @param {'error' | 'warning'} [args.type] The type of the message.
 * @param {string} args.strKey The i18n string key for the message.
 * @param {Record<string, string | undefined>} [args.values] Values for the i18n string.
 * @param {ConfigParserContext} [args.context] The field parser context.
 * @param {ConfigParserCollectors} args.collectors The collectors.
 */
export const addMessage = ({ type = 'error', strKey, values = {}, context = {}, collectors }) => {
  const { collection, collectionFile, typedKeyPath } = context;
  const { errors, warnings } = collectors;
  const $_ = get(_);
  const locators = [];

  if (collection) {
    locators.push(
      $_('config.error_locator.collection', {
        values: { collection: collection.label ?? collection.name },
      }),
    );
  }

  if (collectionFile) {
    locators.push(
      $_('config.error_locator.file', {
        values: { file: collectionFile.label ?? collectionFile.name },
      }),
    );
  }

  if (typedKeyPath) {
    locators.push(
      $_('config.error_locator.field', {
        values: { field: typedKeyPath },
      }),
    );
  }

  const collector = type === 'error' ? errors : warnings;
  const locale = /** @type {string} */ (get(appLocale));
  const locatorStr = locators.length ? `${getListFormatter(locale).format(locators)}: ` : '';
  const message = $_(`config.${type}.${strKey}`, { values });

  collector.add(`${locatorStr}${message}`);
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
        addMessage({ type, strKey, values: { prop, newProp }, context, collectors });
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
 * @returns {boolean} `true` if the name is valid, `false` otherwise.
 */
export const checkName = ({ name, index, nameCounts, strKeyBase, context, collectors }) => {
  if (!name || typeof name !== 'string') {
    // Use count (1-based index) for user-facing messages
    const count = String(index + 1);

    addMessage({ strKey: `missing_${strKeyBase}`, context, values: { count }, collectors });

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
