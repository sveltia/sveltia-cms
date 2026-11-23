import { _, locale as appLocale } from '@sveltia/i18n';

import { allEntries } from '$lib/services/contents';
import { isCollectionIndexFile } from '$lib/services/contents/collection/entries/index-file';
import { getIdentifierFieldName } from '$lib/services/contents/collection/identifier';
import { getSortKeyLabel } from '$lib/services/contents/collection/view/sort-keys';
import {
  getConfiguredTableColumns,
  isTemplateColumnKey,
  METADATA_KEYS,
  METADATA_TEMPLATE_TAGS,
  SINGLE_TAG_REGEX,
  SUMMARY_COLUMN_KEY,
} from '$lib/services/contents/collection/view/table-keys';
import { getField } from '$lib/services/contents/entry/fields';
import { getEntryDisplayLocale } from '$lib/services/contents/entry/paths';
import { getEntrySummary } from '$lib/services/contents/entry/summary';
import { getFieldDisplayValue } from '$lib/services/contents/entry/values';
import { getLocalizedOption } from '$lib/services/contents/i18n/options';
import { getOrCreate } from '$lib/services/utils/cache';
import { getCommitAuthorName } from '$lib/services/utils/commit-author';
import { formatDate } from '$lib/services/utils/date';

/**
 * @import { Entry, EntryTableColumn, InternalEntryCollection } from '$lib/types/private';
 * @import { Field, FieldKeyPath } from '$lib/types/public';
 */

/**
 * Get the name of the only tag of a template column key, if it has no other content and no
 * transformations, e.g. `locales` for `{{locales}}` and `date` for `{{fields.date}}`.
 * @param {string} key Column key.
 * @returns {string | undefined} Tag name.
 */
const getSingleTagName = (key) => key.match(SINGLE_TAG_REGEX)?.[1];

/**
 * Check whether a collection has the columns of its table view configured with the `table_columns`
 * option, or its alias `summary_fields`. Only such a collection offers the table view.
 * @param {InternalEntryCollection} collection Entry collection.
 * @returns {boolean} Result.
 */
export const hasConfiguredTableColumns = (collection) =>
  !!getConfiguredTableColumns(collection)?.length;

/**
 * Classify a column key: whether it can be shown in a collection’s table view, and if so, the field
 * it names. A column key is a special key, a template, the key path of a field defined in the
 * collection, or the canonical slug key, e.g. `translationKey`, which is part of the content of
 * each localized entry without being a field.
 * @param {InternalEntryCollection} collection Entry collection.
 * @param {any} key Column key.
 * @returns {{ fieldConfig?: Field } | undefined} `undefined` if the key can’t be shown. Otherwise,
 * the field configuration if the key is the key path of a field, which is read from the content of
 * the entry; a key without one is shown some other way.
 */
const classifyColumnKey = (collection, key) => {
  if (typeof key !== 'string' || !key) {
    return undefined;
  }

  if (key === SUMMARY_COLUMN_KEY || METADATA_KEYS.includes(key) || isTemplateColumnKey(key)) {
    return {};
  }

  const fieldConfig = getField({ collectionName: collection.name, keyPath: key });

  if (fieldConfig) {
    return { fieldConfig };
  }

  const { i18nEnabled, canonicalSlug } = collection._i18n;

  return i18nEnabled && key === canonicalSlug.key ? {} : undefined;
};

/**
 * Check whether a column key can be shown in a collection’s table view: a special key, a template,
 * the key path of a field defined in the collection, or the canonical slug key, e.g.
 * `translationKey`, which is part of the content of each localized entry without being a field.
 * @param {InternalEntryCollection} collection Entry collection.
 * @param {any} key Column key.
 * @returns {boolean} Result.
 */
export const isTableColumnKey = (collection, key) => !!classifyColumnKey(collection, key);

/**
 * Get the default columns of a collection’s table view: the entry summary, followed by the keys the
 * Sort menu offers, as they are the fields that tell the entries apart. The identifier field, which
 * the summary shows by default, the manual order and the canonical slug are left out.
 * @param {InternalEntryCollection} collection Entry collection.
 * @param {string[]} sortKeys Available sort keys.
 * @returns {{ key: string, label?: string }[]} Columns.
 */
const getDefaultTableColumns = (collection, sortKeys) => {
  const { i18nEnabled, canonicalSlug } = collection._i18n;
  const excludedKeys = [SUMMARY_COLUMN_KEY, '_manual', getIdentifierFieldName(collection)];

  if (i18nEnabled) {
    excludedKeys.push(canonicalSlug.key);
  }

  return [
    { key: SUMMARY_COLUMN_KEY },
    ...sortKeys.filter((key) => !excludedKeys.includes(key)).map((key) => ({ key })),
  ];
};

/**
 * Get the header label of a column.
 * @param {InternalEntryCollection} collection Entry collection.
 * @param {string} key Column key.
 * @returns {string} Label.
 */
const getColumnLabel = (collection, key) => {
  if (key === SUMMARY_COLUMN_KEY) {
    const { summary } = collection;
    const identifierField = getIdentifierFieldName(collection);

    // Without a summary template, the summary is the identifier field’s value
    const field = summary
      ? undefined
      : getField({ collectionName: collection.name, keyPath: identifierField });

    return getLocalizedOption({ config: field, option: 'label' }) || _('sort_keys._summary');
  }

  if (isTemplateColumnKey(key)) {
    const tagName = getSingleTagName(key);

    // A single tag is labelled like the metadata or field it shows; a longer template, such as
    // `{{dirname}}/{{filename}}`, by itself, as there is nothing to name it after
    if (!tagName) {
      return key;
    }

    if (METADATA_TEMPLATE_TAGS.includes(tagName)) {
      return _(`table_column_keys.${tagName}`);
    }

    return getSortKeyLabel({ collection, key: tagName });
  }

  return getSortKeyLabel({ collection, key });
};

/**
 * Resolve the given columns of a collection’s table view, leaving out the keys that name no field,
 * which the configuration parser reports. A key listed twice only gets one column.
 * @param {InternalEntryCollection} collection Entry collection.
 * @param {{ key: string, label?: string }[]} columns Columns, as configured or by default.
 * @returns {EntryTableColumn[]} Columns.
 */
const resolveTableColumns = (collection, columns) => {
  /** @type {Set<string>} */
  const seenKeys = new Set();

  return columns.flatMap(({ key, label }) => {
    const classified = classifyColumnKey(collection, key);

    if (!classified || seenKeys.has(key)) {
      return [];
    }

    seenKeys.add(key);

    /** @type {EntryTableColumn} */
    const column = { key, label: label || getColumnLabel(collection, key), ...classified };

    return [column];
  });
};

/**
 * Get the columns of a collection’s table view, which is only offered with the columns configured.
 * The configured columns are used, unless none of them can be shown, e.g. all naming a field the
 * collection doesn’t have; then the default columns, as a row needs something to tell which entry
 * it is.
 * @param {object} args Arguments.
 * @param {InternalEntryCollection} args.collection Entry collection.
 * @param {string[]} args.sortKeys Keys the Sort menu offers for the collection.
 * @returns {EntryTableColumn[]} Columns.
 */
export const getTableColumns = ({ collection, sortKeys }) => {
  const configured = getConfiguredTableColumns(collection);
  const columns = configured ? resolveTableColumns(collection, configured) : [];

  return columns.length
    ? columns
    : resolveTableColumns(collection, getDefaultTableColumns(collection, sortKeys));
};

/**
 * Cache of the Relation field cells, keyed by entry, then by column key and locale. Each value is
 * recorded with the entry store’s array it was computed against, as the label comes from another
 * entry, which can change without the referencing entry being replaced.
 * @type {WeakMap<Entry, Map<string, { entries: Entry[], value: TableCellValue }>>}
 */
const relationCellCache = new WeakMap();

/**
 * Value of a table view cell: either text, or a checked state for a Boolean field, which is shown
 * as a check mark rather than `true` or `false`.
 * @typedef {{ type: 'text', value: string } | { type: 'boolean', value: boolean }} TableCellValue
 */

/**
 * Get the value of a table view cell for an entry. A field is read from the default locale, or the
 * first locale the entry has if it doesn’t have the default one, as the entry list does, and shown
 * the way a summary template would show it: a date formatted, a Relation field’s referenced entry
 * by its label, the Markdown syntax removed and so on.
 * @param {object} args Arguments.
 * @param {InternalEntryCollection} args.collection Entry collection.
 * @param {Entry} args.entry Entry.
 * @param {EntryTableColumn} args.column Column.
 * @returns {TableCellValue} Value.
 */
export const getTableCellValue = ({ collection, entry, column }) => {
  const { fieldConfig } = column;
  // A template made of a special key’s tag, e.g. `{{commit_date}}`, shows the same as the key
  const tagName = isTemplateColumnKey(column.key) ? getSingleTagName(column.key) : undefined;
  const key = tagName && METADATA_KEYS.includes(tagName) ? tagName : column.key;

  if (key === SUMMARY_COLUMN_KEY) {
    return { type: 'text', value: getEntrySummary(collection, entry, { useTemplate: true }) };
  }

  // A template is formatted the way a `summary` template is, for the index file as well
  if (isTemplateColumnKey(key)) {
    return {
      type: 'text',
      value: getEntrySummary(collection, entry, {
        useTemplate: true,
        template: key,
        useIndexFileLabel: false,
      }),
    };
  }

  if (key === 'slug') {
    return { type: 'text', value: entry.slug };
  }

  if (key === 'commit_author') {
    return { type: 'text', value: getCommitAuthorName(entry.commitAuthor) || '' };
  }

  if (key === 'commit_date') {
    const { commitDate } = entry;

    return {
      type: 'text',
      value: commitDate ? formatDate(commitDate, /** @type {string} */ (appLocale.current)) : '',
    };
  }

  const { defaultLocale } = collection._i18n;
  const locale = /** @type {string} */ (getEntryDisplayLocale(entry.locales, defaultLocale));
  const valueMap = entry.locales[locale]?.content ?? {};

  if (/** @type {Field} */ (fieldConfig)?.widget === 'boolean') {
    return { type: 'boolean', value: valueMap[key] === true };
  }

  /**
   * Get the display value of the field.
   * @returns {TableCellValue} Value.
   */
  const getValue = () => ({
    type: 'text',
    value: getFieldDisplayValue({
      collectionName: collection.name,
      valueMap,
      keyPath: /** @type {FieldKeyPath} */ (key),
      locale,
      plainText: true,
      isIndexFile: isCollectionIndexFile(collection, entry),
    }),
  });

  // A Relation field’s label is looked up in the referenced collection, which is costly to repeat
  // for every row on every render, so it’s cached until the entry or any other entry changes
  if (/** @type {Field} */ (fieldConfig)?.widget === 'relation') {
    const { current: entries } = allEntries;
    const cacheKey = `${key}\0${locale}`;
    const entryCache = getOrCreate(relationCellCache, entry, () => new Map());
    const cached = entryCache.get(cacheKey);

    if (cached && cached.entries === entries) {
      return cached.value;
    }

    const value = getValue();

    entryCache.set(cacheKey, { entries, value });

    return value;
  }

  return getValue();
};

/**
 * Get the sort key a column header sorts the entries by when clicked. The summary column sorts by
 * the summary if the Sort menu offers it, which it does with a summary template; otherwise by the
 * identifier field the summary shows. A template column made of a single tag sorts by the tag.
 * @param {object} args Arguments.
 * @param {InternalEntryCollection} args.collection Entry collection.
 * @param {EntryTableColumn} args.column Column.
 * @param {string[]} args.sortKeys Keys the Sort menu offers for the collection.
 * @returns {string | undefined} Sort key, or `undefined` if the column can’t be sorted.
 */
export const getColumnSortKey = ({ collection, column: { key }, sortKeys }) => {
  if (key === SUMMARY_COLUMN_KEY && !sortKeys.includes(key)) {
    const identifierField = getIdentifierFieldName(collection);

    return sortKeys.includes(identifierField) ? identifierField : undefined;
  }

  // A template made of a single tag, e.g. `{{commit_date}}`, sorts by what the tag shows, if the
  // entries can be sorted by it
  const sortKey = isTemplateColumnKey(key) ? getSingleTagName(key) : key;

  return sortKey && sortKeys.includes(sortKey) ? sortKey : undefined;
};
