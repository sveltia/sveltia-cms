import { isObject } from '@sveltia/utils/object';

/**
 * @import { EntryCollection } from '$lib/types/public';
 */

/**
 * Key of the column holding the entry summary, the same as the sort key for it.
 */
export const SUMMARY_COLUMN_KEY = '_summary';

/**
 * Entry metadata property keys that can be used in place of a field key path: in the `filter`,
 * `sortable_fields`, `view_groups`, `view_filters` and `table_columns` options, and as sort keys.
 * These are resolved from the entry itself rather than the collection’s `fields`.
 * @type {string[]}
 */
export const METADATA_KEYS = ['slug', 'commit_author', 'commit_date'];

/**
 * Template tags for entry metadata that a template column can use, the same as in the `summary`
 * option, besides the special keys, which have localized labels of their own.
 */
export const METADATA_TEMPLATE_TAGS = ['dirname', 'filename', 'extension', 'locales'];

/**
 * Regular expression matching a template column key, which contains a template tag like `{{…}}`.
 */
const TEMPLATE_TAG_REGEX = /\{\{.+?\}\}/;

/**
 * Regular expression matching a template made of a single tag without transformations, e.g.
 * `{{locales}}` or `{{fields.date}}`, capturing the tag name.
 */
export const SINGLE_TAG_REGEX = /^\{\{\s*(?:fields\.)?([^\s|{}]+)\s*\}\}$/;

/**
 * Check whether a column key is a template, like a `summary` template, e.g. `{{locales}}` or
 * `{{dirname}}/{{filename}}.{{extension}}`, rather than a field name or a special key.
 * @param {string} key Column key.
 * @returns {boolean} Result.
 */
export const isTemplateColumnKey = (key) => TEMPLATE_TAG_REGEX.test(key);

/**
 * Get the columns configured for a collection’s table view with the `table_columns` option, or its
 * Static CMS alias `summary_fields`, where `summary` stands for the entry summary.
 * @param {Pick<EntryCollection, 'table_columns' | 'summary_fields'>} collection Entry collection,
 * or its raw configuration.
 * @returns {{ key: string, label?: string }[] | undefined} Columns, as configured. `undefined` if
 * neither option is defined.
 */
export const getConfiguredTableColumns = (collection) => {
  const { table_columns: tableColumns, summary_fields: summaryFields } = collection;

  if (Array.isArray(tableColumns)) {
    return tableColumns.map((column) =>
      isObject(column)
        ? { key: /** @type {any} */ (column).field, label: /** @type {any} */ (column).label }
        : { key: column },
    );
  }

  if (Array.isArray(summaryFields)) {
    return summaryFields.map((name) => ({ key: name === 'summary' ? SUMMARY_COLUMN_KEY : name }));
  }

  return undefined;
};
