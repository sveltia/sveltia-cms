/**
 * Key of the column holding the entry summary, the same as the sort key for it.
 */
export const SUMMARY_COLUMN_KEY = '_summary';

/**
 * Keys that a column can show without a field: entry metadata, the same as the special sort keys.
 */
export const SPECIAL_COLUMN_KEYS = ['slug', 'commit_author', 'commit_date'];

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
