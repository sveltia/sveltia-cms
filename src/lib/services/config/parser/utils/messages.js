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
 * Check for duplicate names in a configuration and add messages if found.
 * @param {object} args Arguments.
 * @param {Record<string, number>} args.nameCounts Record of name counts.
 * @param {string} args.strKey I18n string key for the duplicate name message.
 * @param {ConfigParserContext} args.context Context.
 * @param {ConfigParserCollectors} args.collectors Collectors.
 */
export const checkDuplicateNames = ({ nameCounts, strKey, context, collectors }) => {
  Object.entries(nameCounts)
    .filter(([, count]) => count > 1)
    .forEach(([name]) => {
      addMessage({ strKey, values: { name }, context, collectors });
    });
};
