import { isObject } from '@sveltia/utils/object';

import { getSubFields } from '$lib/services/config/parser/utils/fields';
import { addMessage } from '$lib/services/config/parser/utils/validator';
import { mergeI18nConfigs } from '$lib/services/contents/i18n/config/merge';
import { isFieldLocalized } from '$lib/services/contents/i18n/fields';

/**
 * @import { ConfigParserCollectors, ConfigParserContext } from '$lib/types/private';
 * @import {
 * CmsConfig,
 * CollectionFile,
 * EntryCollection,
 * Field,
 * FileCollection,
 * I18nOptions,
 * } from '$lib/types/public';
 */

/**
 * Options of an i18n configuration that define or refer to the locales. A collection or file that
 * overrides one of them changes what the others have to agree with, so the merged result is checked
 * again at that level.
 * @type {(keyof I18nOptions)[]}
 */
const LOCALE_OPTIONS = ['locales', 'default_locale', 'initial_locales'];

/**
 * Check that the locales of an i18n configuration agree with each other. The runtime doesn’t
 * complain about a mismatch: an empty `locales` list quietly disables i18n, a `default_locale`
 * that isn’t listed is replaced with the first locale, and an unknown locale in `initial_locales`
 * is dropped, each of which looks like a working configuration until content is saved in the wrong
 * place.
 * @param {I18nOptions} config Merged i18n configuration.
 * @param {ConfigParserContext} context Context.
 * @param {ConfigParserCollectors} collectors Collectors.
 */
const checkLocales = (config, context, collectors) => {
  const { locales, default_locale: defaultLocale, initial_locales: initialLocales } = config;

  // The type of each option is checked against the JSON schema
  if (!Array.isArray(locales)) {
    return;
  }

  if (!locales.length) {
    addMessage({ strKey: 'i18n_no_locales', context, collectors });

    return;
  }

  if (typeof defaultLocale === 'string' && !locales.includes(defaultLocale)) {
    addMessage({
      strKey: 'i18n_invalid_default_locale',
      values: { locale: defaultLocale },
      context,
      collectors,
    });
  }

  if (Array.isArray(initialLocales)) {
    initialLocales.forEach((locale) => {
      if (typeof locale === 'string' && !locales.includes(locale)) {
        addMessage({
          strKey: 'i18n_invalid_initial_locale',
          values: { locale },
          context,
          collectors,
        });
      }
    });
  }
};

/**
 * Check if any of the given fields, or their subfields at any depth, is localized with the `i18n`
 * option. A subfield inherits the option from its parent, so a localized parent counts for all of
 * its subfields.
 * @param {Field[]} fields Field list.
 * @returns {boolean} Result.
 */
const hasLocalizedField = (fields) =>
  fields.some((field) => isFieldLocalized(field.i18n) || hasLocalizedField(getSubFields(field)));

/**
 * Check if the given value is an array with at least one item.
 * @param {unknown} value Value.
 * @returns {value is any[]} Result.
 */
const isNonEmptyArray = (value) => Array.isArray(value) && !!value.length;

/**
 * Parse and validate the site-level i18n configuration.
 * @param {CmsConfig} cmsConfig Raw CMS configuration.
 * @param {ConfigParserCollectors} collectors Collectors.
 */
export const parseI18nConfig = (cmsConfig, collectors) => {
  const { i18n, collections, singletons } = cmsConfig;

  if (!isObject(i18n)) {
    return;
  }

  checkLocales(/** @type {I18nOptions} */ (i18n), { cmsConfig }, collectors);

  // The site-level configuration only takes effect in the collections and singletons that enable
  // i18n with their own `i18n` option, so without any of them, nothing can be translated. A missing
  // or empty collection list is reported on its own
  if (!isNonEmptyArray(collections) && !isNonEmptyArray(singletons)) {
    return;
  }

  const isI18nEnabled = [...(collections ?? []), ...(singletons ?? [])].some(
    (item) => !('divider' in item) && !!(/** @type {any} */ (item).i18n),
  );

  if (!isI18nEnabled) {
    addMessage({ strKey: 'i18n_no_collections', context: { cmsConfig }, collectors });
  }
};

/**
 * Check that a collection or collection file with i18n enabled has something to translate: an entry
 * collection or a file needs at least one localized field, and a file collection at least one file
 * with the `i18n` option, as the option of each level only takes effect on top of the one above it.
 * Without any, the other locales are left empty, which looks like a bug rather than a mistake in
 * the configuration.
 * @param {ConfigParserContext} context Context, with the `collection` and optionally the
 * `collectionFile` to check.
 * @param {ConfigParserCollectors} collectors Collectors.
 * @see https://github.com/sveltia/sveltia-cms/issues/577
 */
const checkI18nTargets = (context, collectors) => {
  const { collection, collectionFile } = context;

  if (collectionFile) {
    const { fields } = /** @type {CollectionFile} */ (collectionFile);

    // A missing or empty field list is reported on its own
    if (isNonEmptyArray(fields) && !hasLocalizedField(fields)) {
      addMessage({ strKey: 'collection_file_i18n_no_fields', context, collectors });
    }

    return;
  }

  if ('files' in /** @type {any} */ (collection)) {
    const { files } = /** @type {FileCollection} */ (collection);
    // A file divider doesn’t count, and a collection without files is reported on its own
    const fileList = Array.isArray(files) ? files.filter((file) => !('divider' in file)) : [];

    if (fileList.length && !fileList.some((file) => !!file.i18n)) {
      addMessage({ strKey: 'collection_i18n_no_files', context, collectors });
    }

    return;
  }

  const { fields, index_file: indexFile } = /** @type {EntryCollection} */ (collection);

  // A missing or empty field list is reported on its own. An index file can define its own fields,
  // which count as well
  if (
    isNonEmptyArray(fields) &&
    !hasLocalizedField([...fields, ...(isObject(indexFile) ? (indexFile.fields ?? []) : [])])
  ) {
    addMessage({ strKey: 'collection_i18n_no_fields', context, collectors });
  }
};

/**
 * Check the `i18n` option of a collection or collection file, whichever the context names.
 *
 * The option only takes effect on top of the site-level configuration, and a file’s only on top of
 * its collection’s, so one set without the other silently leaves the collection or file
 * monolingual. When the option overrides the locales, the merged result is checked the same way as
 * the site-level configuration: a `default_locale` inherited from the site may not be among the
 * locales a collection lists for itself.
 * @param {ConfigParserContext} context Context, with the `collection` and optionally the
 * `collectionFile` to check.
 * @param {ConfigParserCollectors} collectors Collectors.
 */
export const checkI18nOverrides = (context, collectors) => {
  const { cmsConfig, collection, collectionFile } = context;

  const { i18n: option } =
    collectionFile ?? /** @type {{ i18n?: boolean | I18nOptions }} */ (collection);

  if (!option) {
    return;
  }

  const merged = mergeI18nConfigs({
    cmsConfig,
    collection: /** @type {any} */ (collection),
    file: collectionFile,
  });

  if (!merged) {
    // A file inherits the problem from its collection, which is reported on the collection unless
    // the collection has no option of its own
    const reportedOnCollection =
      !!collectionFile && !!(/** @type {any} */ (collection).i18n) && !isObject(cmsConfig?.i18n);

    if (!reportedOnCollection) {
      addMessage({ type: 'warning', strKey: 'i18n_not_configured', context, collectors });
    }

    return;
  }

  if (isObject(option) && LOCALE_OPTIONS.some((key) => key in option)) {
    checkLocales(merged, context, collectors);
  }

  checkI18nTargets(context, collectors);
};
