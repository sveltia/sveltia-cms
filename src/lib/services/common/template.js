import { generateUUID } from '@sveltia/utils/crypto';
import { getDateTimeParts } from '@sveltia/utils/datetime';
import { truncate } from '@sveltia/utils/string';
import { get } from 'svelte/store';

import { slugify } from '$lib/services/common/slug';
import {
  applyTransformations,
  DEFAULT_TRANSFORMATION_REGEX,
} from '$lib/services/common/transformations';
import { cmsConfig } from '$lib/services/config';
import { getEntriesByCollection } from '$lib/services/contents/collection/entries';
import { getField } from '$lib/services/contents/entry/fields';
import { getEntrySummaryFromContent } from '$lib/services/contents/entry/summary';
import { renameIfNeeded } from '$lib/services/utils/file';

/**
 * @import { FillTemplateOptions, GetFieldArgs } from '$lib/types/private';
 */

/**
 * @typedef {object} ReplaceSubContext
 * @property {string} identifierField Field name to identify the title.
 * @property {string | undefined} basePath Base path for the entry file.
 */

/**
 * @typedef {object} ReplaceContext
 * @property {FillTemplateOptions & ReplaceSubContext} replaceSubContext Context for `replaceSub`.
 * @property {GetFieldArgs} getFieldArgs Arguments for `getField`.
 */

const DATE_TIME_FIELDS = ['year', 'month', 'day', 'hour', 'minute', 'second'];
const TEMPLATE_REGEX = /{{(.+?)}}(?!'\))/g;

/**
 * UUID generator functions mapped by tag name.
 */
const UUID_TYPES = {
  // eslint-disable-next-line jsdoc/require-jsdoc
  uuid: () => generateUUID(),
  // eslint-disable-next-line jsdoc/require-jsdoc
  uuid_short: () => generateUUID('short'),
  // eslint-disable-next-line jsdoc/require-jsdoc
  uuid_shorter: () => generateUUID('shorter'),
};

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
  const uuidGenerator = UUID_TYPES[/** @type {keyof typeof UUID_TYPES} */ (tag)];

  return uuidGenerator ? uuidGenerator() : undefined;
};

/**
 * Handles slug-related template tags.
 * @internal
 * @param {string} tag The template tag.
 * @param {string | undefined} currentSlug Current slug value.
 * @param {string} type Template type.
 * @param {boolean} isIndexFile Whether this is an index file.
 * @returns {string | undefined} The slug value or undefined if not a slug tag.
 */
export const handleSlugTag = (tag, currentSlug, type, isIndexFile) => {
  if (tag !== 'slug' || !currentSlug) {
    return undefined;
  }

  // Return an empty string instead of `_index` when generating the preview path for an index file
  // @see https://github.com/sveltia/sveltia-cms/issues/468
  if (type === 'preview_path' && isIndexFile) {
    return '';
  }

  return currentSlug;
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

/**
 * Gets field value from the value map.
 * @param {string} tag The template tag.
 * @param {Record<string, any>} valueMap Value map object.
 * @param {string} identifierField Identifier field name.
 * @returns {any} The field value.
 */
const getFieldValue = (tag, valueMap, identifierField) => {
  if (tag.startsWith('fields.')) {
    return valueMap[tag.replace(/^fields\./, '')];
  }

  if (tag === 'slug') {
    return getEntrySummaryFromContent(valueMap, { identifierField });
  }

  return valueMap[tag];
};

/**
 * Template tag replacer subroutine.
 * @param {string} tag Field name or one of special tags.
 * @param {FillTemplateOptions & ReplaceSubContext} context Context for replacement.
 * @returns {any} Replaced value.
 */
const replaceTemplateTag = (tag, context) => {
  const {
    type,
    content: valueMap,
    currentSlug,
    entryFilePath,
    locale,
    dateTimeParts = getDateTimeParts({ timeZone: 'UTC' }),
    identifierField,
    basePath,
    isIndexFile = false,
  } = context;

  // Handle date-time fields
  const dateTimeValue = handleDateTimeTag(tag, dateTimeParts);

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
 * Processes transformations for a template placeholder.
 * @param {string[]} transformations Array of transformation strings.
 * @param {FillTemplateOptions & ReplaceSubContext} replaceSubContext Context for replacement.
 * @returns {{ transformations: string[], hasDefaultTransformation: boolean }} Processed result.
 */
const processTransformations = (transformations, replaceSubContext) => {
  let hasDefaultTransformation = false;

  transformations.forEach((tf, index) => {
    const { defaultValue } = tf.match(DEFAULT_TRANSFORMATION_REGEX)?.groups ?? {};

    if (defaultValue !== undefined) {
      hasDefaultTransformation = true;

      // Support a template tag for the `default` transformation like
      // `{{fields.slug | default('{{fields.title}}')}}`
      const { innerTag } = defaultValue.match(/^{{(?<innerTag>.+?)}}$/)?.groups ?? {};

      if (innerTag !== undefined) {
        transformations[index] =
          `default('${replaceTemplateTag(innerTag, replaceSubContext) ?? ''}')`;
      }
    }
  });

  return { transformations, hasDefaultTransformation };
};

/**
 * Template placeholder replacer.
 * @param {string} placeholder Field name or one of special tags. May contain transformations.
 * @param {ReplaceContext} context Context for replacement.
 * @returns {string} Replaced string.
 */
const replaceTemplatePlaceholder = (placeholder, { replaceSubContext, getFieldArgs }) => {
  const [tag, ...rawTransformations] = placeholder.split(/\s*\|\s*/);
  let value = replaceTemplateTag(tag, replaceSubContext);

  const { transformations, hasDefaultTransformation } = processTransformations(
    rawTransformations,
    replaceSubContext,
  );

  // Fall back with a random ID unless the `default` transformation is defined
  if (value === undefined && !hasDefaultTransformation) {
    return generateUUID('short');
  }

  if (transformations.length) {
    value = applyTransformations({
      fieldConfig: getField({ ...getFieldArgs, keyPath: tag }),
      value,
      transformations,
    });
  }

  // Return the value as is when generating the preview path or media folder path
  if (replaceSubContext.type) {
    return String(value);
  }

  // Slugify the value for a slug or filename. Don’t limit the length here; it will be handled later
  // in `fillTemplate`.
  return slugify(String(value), { maxLength: Infinity });
};

/**
 * Creates existing slugs list for uniqueness validation.
 * @param {string} collectionName Collection name.
 * @param {string | undefined} locale Locale string.
 * @returns {string[]} List of existing slugs.
 */
const getExistingSlugs = (collectionName, locale) =>
  getEntriesByCollection(collectionName)
    .map((e) => (locale ? e.locales[locale]?.slug : e.slug))
    .filter(Boolean);

/**
 * Fills a template string with values from the given options.
 * @param {string} template Template string literal containing tags like `{{title}}`.
 * @param {FillTemplateOptions} options Options.
 * @returns {string} Filled template that can be used for an entry slug, path, etc.
 * @see https://decapcms.org/docs/configuration-options/#slug-type
 * @see https://decapcms.org/docs/configuration-options/#slug
 * @see https://decapcms.org/docs/collection-folder/#media-and-public-folder
 */
export const fillTemplate = (template, options) => {
  const { collection, content: valueMap, currentSlug, locale, isIndexFile = false } = options;
  const { _type, name: collectionName } = collection;

  const {
    identifier_field: identifierField = 'title',
    slug_length: legacySlugLength = undefined,
    _file: { basePath } = {},
  } = _type === 'entry' ? collection : {};

  // @todo Remove the legacy option prior to the 1.0 release.
  const slugMaxLength = legacySlugLength ?? get(cmsConfig)?.slug?.maxlength;

  /** @type {ReplaceContext} */
  const context = {
    replaceSubContext: { ...options, identifierField, basePath },
    getFieldArgs: { collectionName, keyPath: '', valueMap, isIndexFile },
  };

  // Use a negative lookahead assertion to support a template tag for the `default` transformation
  // like `{{fields.slug | default('{{fields.title}}')}}`
  let slug = template
    .replace(TEMPLATE_REGEX, (_match, tag) => replaceTemplatePlaceholder(tag, context))
    .trim();

  // Truncate a long slug if needed
  if (typeof slugMaxLength === 'number') {
    slug = truncate(slug, slugMaxLength, { ellipsis: '' }).replace(/-$/, '');
  }

  // We don’t have to rename it when creating a path with a slug given
  if (currentSlug) {
    return slug;
  }

  return renameIfNeeded(slug, getExistingSlugs(collectionName, locale));
};
