import { generateUUID } from '@sveltia/utils/crypto';

import { slugify } from '$lib/services/common/slug';
import {
  getFieldValue,
  handleDateTimeTag,
  handleFilePathTag,
  handleSlugTag,
  handleUuidTag,
} from '$lib/services/common/template/handlers';
import { processTransformations } from '$lib/services/common/template/transformations';
import {
  applyTransformations,
  TRANSFORMATION_SPLIT_REGEX,
} from '$lib/services/common/transformations';
import { getField } from '$lib/services/contents/entry/fields';

/**
 * @import { FillTemplateOptions, GetFieldArgs } from '$lib/types/private';
 */

/**
 * @typedef {object} ReplaceSubContextBase
 * @property {string} identifierField Field name to identify the title.
 * @property {string | undefined} basePath Base path for the entry file.
 */

/**
 * @typedef {FillTemplateOptions & ReplaceSubContextBase} ReplaceSubContext
 */

/**
 * @typedef {object} ReplaceContext
 * @property {ReplaceSubContext} replaceSubContext Context for `replaceSub`.
 * @property {GetFieldArgs} getFieldArgs Arguments for `getField`.
 */

/**
 * Template tag replacer subroutine.
 * @internal
 * @param {string} tag Field name or special tag.
 * @param {ReplaceSubContext} context Replacement context.
 * @returns {any} Replaced value.
 */
export const replaceTemplateTag = (tag, context) => {
  const {
    type,
    content: valueMap,
    currentSlug,
    entryFilePath,
    locale,
    dateTimeParts,
    identifierField,
    basePath,
    isIndexFile = false,
  } = context;

  // Handle date-time fields. Parts are pre-calculated in `fillTemplate` to avoid redundant
  // calculations for multiple date-time tags in the same template.
  const _dateTimeParts = /** @type {Record<string, string>} */ (dateTimeParts);
  const dateTimeValue = handleDateTimeTag(tag, _dateTimeParts);

  if (dateTimeValue !== undefined) {
    return dateTimeValue;
  }

  // Handle slug tag
  const slugValue = handleSlugTag(tag, currentSlug, type ?? '', isIndexFile);

  if (slugValue !== undefined) {
    return slugValue;
  }

  // Handle UUID tags
  const uuidValue = handleUuidTag(tag);

  if (uuidValue !== undefined) {
    return uuidValue;
  }

  // Handle locale tag for preview path
  if (type === 'preview_path' && tag === 'locale') {
    return locale;
  }

  // Handle file path related tags
  if (type === 'preview_path' || type === 'media_folder') {
    const filePathValue = handleFilePathTag(tag, entryFilePath, basePath);

    if (filePathValue !== undefined) {
      return filePathValue;
    }
  }

  // Handle field values
  return getFieldValue(tag, valueMap, identifierField);
};

/**
 * Template placeholder replacer.
 * @internal
 * @param {string} placeholder Field name or one of special tags. May contain transformations.
 * @param {ReplaceContext} context Context for replacement.
 * @returns {string} Replaced string.
 */
export const replaceTemplatePlaceholder = (placeholder, context) => {
  const { replaceSubContext, getFieldArgs } = context;
  const [tag, ...rawTransformations] = placeholder.split(TRANSFORMATION_SPLIT_REGEX);
  let value = replaceTemplateTag(tag, replaceSubContext);

  const { transformations, hasDefaultTransformation } = processTransformations(
    rawTransformations,
    replaceSubContext,
    replaceTemplateTag,
  );

  // Fall back with a random ID unless the `default` transformation is defined
  if (value === undefined && !hasDefaultTransformation) {
    return generateUUID('short');
  }

  const { type, locale } = replaceSubContext;

  if (transformations.length) {
    value = applyTransformations({
      fieldConfig: getField({ ...getFieldArgs, keyPath: tag }),
      value,
      transformations,
      locale,
    });
  }

  // Return the value as is when generating the preview path or media folder path
  if (type) {
    return String(value);
  }

  // Slugify the value for a slug or filename. Don't limit the length here; it will be handled later
  // in `fillTemplate`.
  return slugify(String(value), { locale, maxLength: Infinity });
};
