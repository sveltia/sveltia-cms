import { isObject, toRaw } from '@sveltia/utils/object';
import { compare, escapeRegExp } from '@sveltia/utils/string';
import { unflatten } from 'flat';
import { TomlDate } from 'smol-toml';
import { get } from 'svelte/store';

import { siteConfig } from '$lib/services/config';
import { createKeyPathList } from '$lib/services/contents/draft/save/key-path';
import { getField, isFieldRequired } from '$lib/services/contents/entry/fields';
import { parseDateTimeConfig } from '$lib/services/contents/widgets/date-time/helper';
import { hasRootListField } from '$lib/services/contents/widgets/list/helper';
import { FULL_DATE_TIME_REGEX } from '$lib/services/utils/date';

/**
 * @import {
 * EntryDraft,
 * FlattenedEntryContent,
 * InternalEntryCollection,
 * InternalLocaleCode,
 * RawEntryContent,
 * } from '$lib/types/private';
 * @import { DateTimeField, Field } from '$lib/types/public';
 */

/**
 * Check whether a value is empty, such as `undefined`, `null`, an empty string, an empty array, or
 * an empty object.
 * @param {any} value Value to check.
 * @returns {boolean} Whether the value is empty.
 */
export const isValueEmpty = (value) =>
  // Don’t use `!value` as `false` and `0` are valid values
  value === undefined ||
  value === null ||
  value === '' ||
  (Array.isArray(value) && !value.length) ||
  (isObject(value) && !Object.keys(value).length);

/**
 * Move a property name/value from a unsorted property map to a sorted property map.
 * @param {object} args Arguments.
 * @param {string} args.key Property name.
 * @param {Field} [args.field] Associated field.
 * @param {InternalLocaleCode} args.locale Locale code.
 * @param {FlattenedEntryContent} args.unsortedMap Unsorted property map.
 * @param {FlattenedEntryContent} args.sortedMap Sorted property map.
 * @param {boolean} args.isTomlOutput Whether the output it TOML format.
 * @param {boolean} args.omitEmptyOptionalFields Whether to prevent fields with `required: false`
 * and an empty value from being included in the data output.
 */
export const copyProperty = ({
  key,
  field,
  locale,
  unsortedMap,
  sortedMap,
  isTomlOutput,
  omitEmptyOptionalFields,
}) => {
  // Skip internal UUIDs added to list items
  if (key.endsWith('.__sc_item_id')) {
    delete unsortedMap[key];
    return;
  }

  let value = unsortedMap[key];

  // Use native date for TOML if a custom format is not defined
  // @see https://github.com/squirrelchat/smol-toml?tab=readme-ov-file#dates
  // @see https://toml.io/en/v1.0.0#offset-date-time
  if (
    isTomlOutput &&
    typeof value === 'string' &&
    FULL_DATE_TIME_REGEX.test(value) &&
    field?.widget === 'datetime' &&
    !parseDateTimeConfig(/** @type {DateTimeField} */ (field)).format
  ) {
    try {
      value = new TomlDate(value);
    } catch {
      //
    }
  }

  if (
    omitEmptyOptionalFields &&
    field &&
    !isFieldRequired({ fieldConfig: field, locale }) &&
    !Object.keys(unsortedMap).some((_key) => _key.startsWith(`${key}.`)) &&
    isValueEmpty(value)
  ) {
    // Omit the empty value
  } else {
    sortedMap[key] = value;
  }

  delete unsortedMap[key];
};

/**
 * Finalize the content by sorting the entry draft content’s object properties by the order of the
 * configured collection fields. The result can be formatted as expected with `JSON.stringify()`, as
 * the built-in method uses insertion order for string key ordering.
 * @param {object} args Arguments.
 * @param {string} args.collectionName Collection name.
 * @param {string} [args.fileName] Collection file name. File/singleton collection only.
 * @param {Field[]} args.fields Field list of a collection or a file.
 * @param {InternalLocaleCode} args.locale Locale code.
 * @param {FlattenedEntryContent} args.valueMap Flattened entry content.
 * @param {string} [args.canonicalSlugKey] Property name of a canonical slug.
 * @param {boolean} [args.isIndexFile] Whether the corresponding entry is the collection’s special
 * index file used specifically in Hugo.
 * @param {boolean} [args.isTomlOutput] Whether the output it TOML format.
 * @returns {RawEntryContent} Unflattened entry content sorted by fields.
 */
const finalizeContent = ({
  collectionName,
  fileName,
  fields,
  locale,
  valueMap,
  canonicalSlugKey,
  isIndexFile = false,
  isTomlOutput = false,
}) => {
  /** @type {FlattenedEntryContent} */
  const unsortedMap = toRaw(valueMap);
  /** @type {FlattenedEntryContent} */
  const sortedMap = {};

  const { omit_empty_optional_fields: omitEmptyOptionalFields = false } =
    get(siteConfig)?.output ?? {};

  const getFieldArgs = { collectionName, fileName, valueMap, isIndexFile };
  const copyArgs = { locale, unsortedMap, sortedMap, isTomlOutput, omitEmptyOptionalFields };

  // Add the slug first
  if (canonicalSlugKey && canonicalSlugKey in unsortedMap) {
    copyProperty({ ...copyArgs, key: canonicalSlugKey });
  }

  // Move the listed properties to a new object
  createKeyPathList(fields).forEach((keyPath) => {
    const field = getField({ ...getFieldArgs, keyPath });

    if (keyPath in unsortedMap) {
      copyProperty({ ...copyArgs, key: keyPath, field });
    } else if (field?.widget === 'keyvalue') {
      // Work around a bug in the flat library where numeric property keys used for KeyValue fields
      // trigger a wrong conversion to an array instead of an object
      // @see https://github.com/hughsk/flat/issues/103
      sortedMap[keyPath] = {};

      // Copy key-value pairs
      Object.entries(unsortedMap)
        .filter(([_keyPath]) => _keyPath.startsWith(`${keyPath}.`))
        .forEach(([_keyPath]) => {
          copyProperty({ ...copyArgs, key: _keyPath, field });
        });
    } else {
      const regex = new RegExp(
        `^${escapeRegExp(keyPath.replaceAll('*', '\\d+')).replaceAll('\\\\d\\+', '\\d+')}$`,
      );

      Object.keys(unsortedMap)
        .filter((_keyPath) => regex.test(_keyPath))
        .sort(([a, b]) => compare(a, b))
        .forEach((_keyPath) => {
          copyProperty({ ...copyArgs, key: _keyPath, field });
        });
    }
  });

  // Move the remainder, if any, to a new object
  Object.keys(unsortedMap)
    .sort(([a, b]) => compare(a, b))
    .forEach((key) => {
      copyProperty({ ...copyArgs, key });
    });

  return unflatten(sortedMap);
};

/**
 * Serialize the content for the output.
 * @param {object} args Arguments.
 * @param {EntryDraft} args.draft Entry draft.
 * @param {InternalLocaleCode} args.locale Locale code.
 * @param {FlattenedEntryContent} args.valueMap Original content.
 * @returns {RawEntryContent} Modified and unflattened content.
 */
export const serializeContent = ({ draft, locale, valueMap }) => {
  const { collection, collectionName, collectionFile, fields, isIndexFile } = draft;

  const {
    _file,
    _i18n: {
      canonicalSlug: { key: canonicalSlugKey },
    },
  } = collectionFile ?? /** @type {InternalEntryCollection} */ (collection);

  const isTomlOutput = ['toml', 'toml-frontmatter'].includes(_file.format);

  const content = finalizeContent({
    collectionName,
    fileName: collectionFile?.name,
    fields,
    locale,
    valueMap,
    canonicalSlugKey,
    isIndexFile,
    isTomlOutput,
  });

  // Handle a special case: top-level list field. TOML doesn’t support top-level arrays, so we
  // ignore the `root` option for such cases.
  if (!isTomlOutput && hasRootListField(fields)) {
    return content[fields[0].name] ?? [];
  }

  return content;
};
