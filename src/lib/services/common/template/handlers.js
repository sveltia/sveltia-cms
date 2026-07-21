import { generateUUID } from '@sveltia/utils/crypto';

import { DATE_TIME_FIELDS } from '$lib/services/common/template/constants';
import { getEntrySummaryFromContent } from '$lib/services/contents/entry/summary';

/**
 * @import { ReplaceSubContext } from '$lib/services/common/template/replacers';
 */

/**
 * Handles date-time related template tags.
 * @internal
 * @param {string} tag The template tag.
 * @param {Record<string, string>} dateTimeParts Date-time parts object.
 * @returns {string | undefined} The date-time value or undefined if not a date-time tag.
 */
export const handleDateTimeTag = (tag, dateTimeParts) =>
  DATE_TIME_FIELDS.includes(tag) ? dateTimeParts[tag] : undefined;

/**
 * Handles UUID-related template tags.
 * @internal
 * @param {string} tag The template tag.
 * @returns {string | undefined} The UUID value or undefined if not a UUID tag.
 */
export const handleUuidTag = (tag) => {
  switch (tag) {
    case 'uuid':
      return generateUUID();
    case 'uuid_short':
      return generateUUID('short');
    case 'uuid_shorter':
      return generateUUID('shorter');
    default:
      return undefined;
  }
};

/**
 * Handles slug-related template tags.
 * @internal
 * @param {string} tag Field name or special tag.
 * @param {ReplaceSubContext} context Replacement context.
 * @returns {string | undefined} The slug value or undefined if not a slug tag.
 */
export const handleSlugTag = (tag, context) => {
  if (tag !== 'slug') {
    return undefined;
  }

  const { type, isIndexFile, currentSlug, content, identifierField } = context;

  // Return an empty string instead of `_index` when generating the preview path for an index file
  // @see https://github.com/sveltia/sveltia-cms/issues/468
  if (type === 'preview_path' && isIndexFile) {
    return '';
  }

  return currentSlug ?? getEntrySummaryFromContent(content, { identifierField });
};

/**
 * Handles file path related template tags.
 * @internal
 * @param {string} tag The template tag.
 * @param {string | undefined} entryFilePath Entry file path.
 * @param {string | undefined} basePath Base path.
 * @returns {string | undefined} The file path value or undefined if not a file path tag.
 */
export const handleFilePathTag = (tag, entryFilePath, basePath) => {
  if (!entryFilePath) {
    return '';
  }

  switch (tag) {
    case 'dirname': {
      const pathAfterBase = entryFilePath.replace(basePath ?? '', '');
      const lastSlashIndex = pathAfterBase.lastIndexOf('/');

      return lastSlashIndex > 0 ? pathAfterBase.substring(0, lastSlashIndex) : '';
    }

    case 'filename': {
      const fileName = /** @type {string} */ (entryFilePath.split('/').pop());

      return fileName.split('.').shift();
    }

    case 'extension': {
      const fileName = /** @type {string} */ (entryFilePath.split('/').pop());

      return fileName.split('.').pop();
    }

    default:
      return undefined;
  }
};
