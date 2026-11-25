import { DOCS_BASE_URL } from '$lib/services/app';

/**
 * Mapping of deprecation warnings that have been issued once. This prevents flooding the console
 * with repeated warnings.
 * @type {Record<string, boolean>}
 */
export const warnedOnceMap = {
  logo_url: false,
  flat_metadata_keys: false,
};

/**
 * Deprecation warning messages.
 * @type {Record<string, string>}
 */
export const warningMessages = {
  logo_url:
    'The `logo_url` option is deprecated and will be removed in a future version of Sveltia CMS. ' +
    'Use the `logo.src` option instead. ' +
    `${DOCS_BASE_URL}/customization#custom-logo`,
  flat_metadata_keys:
    'Reading the `fieldsMetaData` of a nested field with its flat key path, like `details.author` ' +
    'or `books.0.author`, or the metadata of a List field’s single `field` under the List field’s ' +
    'name is deprecated and will be removed in a future version of Sveltia CMS. Use the nested ' +
    "path instead, like `fieldsMetaData.getIn(['books', 'author'])` or " +
    "`fieldsMetaData.getIn(['tags', 'tag'])`. " +
    `${DOCS_BASE_URL}/api/preview-templates`,
};

/**
 * Issue a deprecation warning if it hasn’t been issued yet.
 * @param {string} key Key of the warning to issue.
 * @param {string} [message] Custom message to display instead of the default one.
 */
export const warnDeprecation = (key, message) => {
  // Skip during tests
  if (import.meta.env.VITEST) {
    return;
  }

  if (!warnedOnceMap[key]) {
    // eslint-disable-next-line no-console
    console.warn(message ?? warningMessages[key]);
    warnedOnceMap[key] = true;
  }
};
