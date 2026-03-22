import { escapeRegExp } from '@sveltia/utils/string';
import { get } from 'svelte/store';

import { collectors } from '$lib/services/config';
import { allEntries } from '$lib/services/contents';
import { getCollection } from '$lib/services/contents/collection';
import { getEntriesByCollection } from '$lib/services/contents/collection/entries';
import { getEntrySummary } from '$lib/services/contents/entry/summary';
import { getOptions } from '$lib/services/contents/fields/relation/helper';

/**
 * @import { Entry, FlattenedEntryContent, InternalLocaleCode } from '$lib/types/private';
 * @import { FieldKeyPath, RelationField } from '$lib/types/public';
 */

/**
 * @typedef {object} ReferringEntry
 * @property {string} collectionName Source collection name.
 * @property {string} collectionLabel Source collection label.
 * @property {string} fieldLabel Relation field label.
 * @property {Entry} entry Source entry referencing the target.
 * @property {string} summary Display summary for the source entry.
 */

/**
 * Get the stored relation values for a field in a given entry content map.
 * @param {FlattenedEntryContent} content Flattened entry content.
 * @param {FieldKeyPath} keyPath Field key path.
 * @param {boolean} multiple Whether the field accepts multiple values.
 * @returns {any[]} Array of stored values.
 */
const getRelationValues = (content, keyPath, multiple) => {
  if (multiple) {
    return Object.entries(content)
      .filter(([key]) => new RegExp(`^${escapeRegExp(keyPath)}\\.\\d+$`).test(key))
      .map(([, value]) => value);
  }

  const value = content[keyPath];

  return value !== undefined && value !== null ? [value] : [];
};

/**
 * Get the value that would be stored for the target entry in a relation field. This resolves what
 * the `value_field` template produces for a given entry.
 * @param {RelationField} fieldConfig Relation field config.
 * @param {Entry} targetEntry The target entry.
 * @param {InternalLocaleCode} locale Locale.
 * @returns {Set<any>} Set of values that represent this entry in the relation field.
 */
const getTargetValues = (fieldConfig, targetEntry, locale) => {
  const { collection: refCollectionName, file: refFileName } = fieldConfig;
  const refCollection = getCollection(refCollectionName);

  if (!refCollection) {
    return new Set();
  }

  // Build the options list for the target collection and find which values correspond to the target
  // entry. This reuses the same logic that the relation editor widget uses.
  const refEntries = refFileName
    ? get(allEntries).filter((e) =>
        Object.values(e.locales).some(({ path }) => path.includes(refFileName)),
      )
    : getEntriesByCollection(refCollectionName);

  const options = getOptions(locale, fieldConfig, refEntries);
  const valueField = fieldConfig.value_field;
  const usesSlug = !valueField || valueField === '{{slug}}' || valueField === 'slug';

  if (usesSlug) {
    return new Set([targetEntry.slug]);
  }

  // For custom value_field, find which option values this target entry would produce
  const targetContent =
    targetEntry.locales[locale]?.content ?? Object.values(targetEntry.locales)[0]?.content ?? {};

  // If the value field is a simple field name (no template syntax), use it directly
  if (!valueField.includes('{{') && !valueField.includes('*')) {
    const val = targetContent[valueField];

    return val !== undefined && val !== null ? new Set([val]) : new Set();
  }

  // For template-based value fields, find options whose values contain the target entry’s slug
  const targetSlug = targetEntry.slug;

  const matchingValues = new Set(
    options.filter((o) => String(o.value).includes(targetSlug)).map((o) => o.value),
  );

  // Fallback: also check if any option value equals a simple field value
  if (matchingValues.size === 0) {
    const simpleKey = valueField.replace(/^{{|}}$/g, '');
    const val = targetContent[simpleKey];

    if (val !== undefined && val !== null) {
      matchingValues.add(val);
    }
  }

  return matchingValues;
};

/**
 * Check if a source entry references the target through the given relation field at the given key
 * path. Returns `true` if a reference is found.
 * @param {FlattenedEntryContent} content Flattened source entry content.
 * @param {FieldKeyPath} effectiveKeyPath Key path, possibly containing wildcards.
 * @param {boolean} multiple Whether the relation field is multiple.
 * @param {Set<any>} targetValues Target values to match.
 * @returns {boolean} Whether a reference was found.
 */
const hasReference = (content, effectiveKeyPath, multiple, targetValues) => {
  const hasWildcard = effectiveKeyPath.includes('*');

  if (hasWildcard) {
    const pattern = new RegExp(`^${escapeRegExp(effectiveKeyPath).replace(/\\\*/g, '\\d+')}$`);

    return Object.keys(content)
      .filter((key) => pattern.test(key))
      .some((key) => getRelationValues(content, key, multiple).some((v) => targetValues.has(v)));
  }

  return getRelationValues(content, effectiveKeyPath, multiple).some((v) => targetValues.has(v));
};

/**
 * Find all entries that reference the given target entry through relation fields.
 * @param {object} args Arguments.
 * @param {string} args.collectionName Target collection name.
 * @param {string} [args.fileName] Target file name (for file/singleton collections).
 * @param {Entry} args.entry Target entry.
 * @returns {ReferringEntry[]} Referring entries.
 */
export const getBacklinks = ({ collectionName, fileName, entry }) => {
  const targetCollection = getCollection(collectionName);

  if (!targetCollection) {
    return [];
  }

  const {
    _i18n: { defaultLocale },
  } = targetCollection;

  // Find all relation fields that reference the target collection (and optionally file)
  const relevantRelations = [...collectors.relationFields].filter(({ fieldConfig }) => {
    if (fieldConfig.collection !== collectionName) {
      return false;
    }

    if (fileName && fieldConfig.file && fieldConfig.file !== fileName) {
      return false;
    }

    return true;
  });

  if (relevantRelations.length === 0) {
    return [];
  }

  // Compute what values identify the target entry in each relation field
  /** @type {Map<RelationField, Set<any>>} */
  const targetValuesMap = new Map(
    relevantRelations.map(({ fieldConfig }) => [
      fieldConfig,
      getTargetValues(fieldConfig, entry, defaultLocale),
    ]),
  );

  // For each relation field, scan entries in the source collection and find matches
  return relevantRelations.flatMap(({ fieldConfig, context }) => {
    const sourceCollectionConfig = context.collection;

    if (!sourceCollectionConfig || !('name' in sourceCollectionConfig)) {
      return [];
    }

    const sourceCollectionName = sourceCollectionConfig.name;
    const sourceCollection = getCollection(sourceCollectionName);

    if (!sourceCollection) {
      return [];
    }

    const sourceLocale = sourceCollection._i18n.defaultLocale;
    /* v8 ignore next */
    const targetValues = targetValuesMap.get(fieldConfig) ?? new Set();

    if (targetValues.size === 0) {
      return [];
    }

    // Determine the key path of the relation field in the source entry’s content. The
    // `typedKeyPath` may contain type annotations like `blocks.*<image>.src`; strip them.
    const typedKeyPath = context.typedKeyPath ?? '';

    const keyPath = typedKeyPath
      .replace(/<[^>]+>/g, '')
      .replace(/\.\*\./g, '.*.')
      .replace(/\.\*$/, '.*');

    const fieldName = fieldConfig.name;
    const baseKeyPath = keyPath.replace(/\*\./g, '').replace(/\*$/g, '');
    const effectiveKeyPath = baseKeyPath || fieldName;

    const sourceEntries =
      sourceCollectionName === collectionName
        ? getEntriesByCollection(sourceCollectionName).filter((e) => e.slug !== entry.slug)
        : getEntriesByCollection(sourceCollectionName);

    return sourceEntries
      .map((sourceEntry) => {
        const content =
          sourceEntry.locales[sourceLocale]?.content ??
          Object.values(sourceEntry.locales)[0]?.content;

        if (
          !content ||
          !hasReference(content, effectiveKeyPath, !!fieldConfig.multiple, targetValues)
        ) {
          return undefined;
        }

        return /** @type {ReferringEntry} */ ({
          collectionName: sourceCollectionName,
          collectionLabel: sourceCollection.label ?? sourceCollectionName,
          fieldLabel: fieldConfig.label ?? fieldName,
          entry: sourceEntry,
          summary: getEntrySummary(sourceCollection, sourceEntry),
        });
      })
      .filter((/** @type {ReferringEntry | undefined} */ b) => !!b);
  });
};
