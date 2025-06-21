import transliterate from '@sindresorhus/transliterate';
import { generateUUID } from '@sveltia/utils/crypto';
import { getDateTimeParts } from '@sveltia/utils/datetime';
import { truncate } from '@sveltia/utils/string';
import { get } from 'svelte/store';
import {
  applyTransformations,
  DEFAULT_TRANSFORMATION_REGEX,
} from '$lib/services/common/transformations';
import { siteConfig } from '$lib/services/config';
import { getEntriesByCollection } from '$lib/services/contents/collection/entries';
import { getField } from '$lib/services/contents/entry/fields';
import { getEntrySummaryFromContent } from '$lib/services/contents/entry/summary';
import { renameIfNeeded } from '$lib/services/utils/file';

/**
 * @import {
 * EntryCollection,
 * FillSlugTemplateOptions,
 * InternalSiteConfig,
 * } from '$lib/types/private';
 */

/**
 * @typedef {object} ReplaceSubContext
 * @property {string} identifierField Field name to identify the title.
 * @property {string | undefined} basePath Base path for the entry file.
 */

/**
 * @typedef {object} ReplaceContext
 * @property {FillSlugTemplateOptions & ReplaceSubContext} replaceSubContext Context for
 * `replaceSub`.
 * @property {object} getFieldArgs Arguments for `getField`.
 * @property {string} getFieldArgs.collectionName Collection name.
 * @property {object} getFieldArgs.valueMap Value map for the collection.
 * @property {boolean} getFieldArgs.isIndexFile Whether the slug is for an index file.
 */

/**
 * Slugify the given string to be used as a filename or URL slug, based on the `slug` configuration.
 * This function can be used for both entry slugs and asset file names.
 * @param {string} string String to be normalized.
 * @param {object} [options] Options.
 * @param {boolean} [options.fallback] Whether to return a fallback value if the slug is empty.
 * Defaults to `true`, which returns a part of a UUID.
 * @returns {string} Slug.
 * @see https://decapcms.org/docs/configuration-options/#slug-type
 */
export const slugify = (string, { fallback = true } = {}) => {
  const {
    slug: {
      encoding = 'unicode',
      clean_accents: cleanAccents = false,
      sanitize_replacement: sanitizeReplacement = '-',
    } = {},
  } = /** @type {InternalSiteConfig} */ (get(siteConfig)) ?? {};

  let slug = string;

  if (cleanAccents) {
    // Remove any accent after transliteration
    // @see https://www.npmjs.com/package/@sindresorhus/transliterate
    // @see https://stackoverflow.com/q/990904
    slug = transliterate(slug)
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '');
  }

  if (encoding === 'ascii') {
    slug = slug.replaceAll(/[^\w-~]/g, ' ');
  } else {
    // Disallow space, control, delimiter, reserved, unwise characters
    // @see https://stackoverflow.com/q/1547899
    slug = slug.replaceAll(/[\p{Z}\p{C}!"#$&'()*+,/:;<=>?@[\]^`{|}]/gu, ' ');
  }

  // Make the string lowercase; replace all the spaces with replacers (hyphens by default)
  slug = slug.toLocaleLowerCase().trim().replaceAll(/\s+/g, sanitizeReplacement);

  // Consolidate consecutive replacement characters into a single one and trim them from ends
  if (sanitizeReplacement) {
    const escapedReplacement = sanitizeReplacement.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const consecutivePattern = new RegExp(`${escapedReplacement}+`, 'g');

    slug = slug.replace(consecutivePattern, sanitizeReplacement);

    // Trim replacement characters from the beginning and end
    const trimPattern = new RegExp(`^${escapedReplacement}+|${escapedReplacement}+$`, 'g');

    slug = slug.replace(trimPattern, '');
  }

  if (!slug && fallback) {
    return generateUUID('short');
  }

  return slug;
};

/**
 * Replacer subroutine.
 * @param {string} tag Field name or one of special tags.
 * @param {FillSlugTemplateOptions & ReplaceSubContext} context Context for replacement.
 * @returns {any} Replaced value.
 */
const replaceSub = (tag, context) => {
  const {
    type,
    content: valueMap,
    currentSlug,
    entryFilePath,
    locale,
    dateTimeParts = getDateTimeParts({ timeZone: 'UTC' }),
    identifierField,
    basePath,
  } = context;

  if (['year', 'month', 'day', 'hour', 'minute', 'second'].includes(tag)) {
    return dateTimeParts[tag];
  }

  if (tag === 'slug' && currentSlug) {
    return currentSlug;
  }

  if (tag === 'uuid') {
    return generateUUID();
  }

  if (tag === 'uuid_short') {
    return generateUUID('short');
  }

  if (tag === 'uuid_shorter') {
    return generateUUID('shorter');
  }

  if (type === 'preview_path') {
    if (tag === 'locale') {
      return locale;
    }
  }

  if (type === 'preview_path' || type === 'media_folder') {
    if (!entryFilePath) {
      return '';
    }

    if (tag === 'dirname') {
      return entryFilePath.replace(basePath ?? '', '').match(/(.+?)(?:\/[^/]+)?$/)?.[1] ?? '';
    }

    if (tag === 'filename') {
      return /** @type {string} */ (entryFilePath.split('/').pop()).split('.').shift();
    }

    if (tag === 'extension') {
      return /** @type {string} */ (entryFilePath.split('/').pop()).split('.').pop();
    }
  }

  let value;

  if (tag.startsWith('fields.')) {
    value = valueMap[tag.replace(/^fields\./, '')];
  } else if (tag === 'slug') {
    value = getEntrySummaryFromContent(valueMap, { identifierField });
  } else {
    value = valueMap[tag];
  }

  return value;
};

/**
 * Replacer.
 * @param {string} placeholder Field name or one of special tags. May contain transformations.
 * @param {ReplaceContext} context Context for replacement.
 * @returns {string} Replaced string.
 */
const replace = (placeholder, { replaceSubContext, getFieldArgs }) => {
  const [tag, ...transformations] = placeholder.split(/\s*\|\s*/);
  let value = replaceSub(tag, replaceSubContext);
  let hasDefaultTransformation = false;

  transformations.forEach((tf, index) => {
    const { defaultValue } = tf.match(DEFAULT_TRANSFORMATION_REGEX)?.groups ?? {};

    if (defaultValue !== undefined) {
      hasDefaultTransformation = true;

      // Support a template tag for the `default` transformation like
      // `{{fields.slug | default('{{fields.title}}')}}`
      const { innerTag } = defaultValue.match(/^{{(?<innerTag>.+?)}}$/)?.groups ?? {};

      if (innerTag !== undefined) {
        transformations[index] = `default('${replaceSub(innerTag, replaceSubContext) ?? ''}')`;
      }
    }
  });

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

  if (value) {
    return slugify(String(value));
  }

  // Use a random ID as a fallback
  return generateUUID('short');
};

/**
 * Fill the given slug template.
 * @param {string} template Template string literal containing tags like `{{title}}`.
 * @param {FillSlugTemplateOptions} options Options.
 * @returns {string} Filled template that can be used for an entry slug, path, etc.
 * @see https://decapcms.org/docs/configuration-options/#slug-type
 * @see https://decapcms.org/docs/configuration-options/#slug
 * @see https://decapcms.org/docs/collection-folder/#media-and-public-folder
 */
export const fillSlugTemplate = (template, options) => {
  const { collection, content: valueMap, currentSlug, locale, isIndexFile = false } = options;

  const {
    name: collectionName,
    identifier_field: identifierField = 'title',
    slug_length: slugMaxLength = undefined,
  } = collection;

  const basePath =
    collection._type === 'entry'
      ? /** @type {EntryCollection} */ (collection)._file.basePath
      : undefined;

  /** @type {ReplaceContext} */
  const context = {
    replaceSubContext: { ...options, identifierField, basePath },
    getFieldArgs: { collectionName, valueMap, isIndexFile },
  };

  // Use a negative lookahead assertion to support a template tag for the `default` transformation
  // like `{{fields.slug | default('{{fields.title}}')}}`
  let slug = template.replace(/{{(.+?)}}(?!'\))/g, (_match, tag) => replace(tag, context)).trim();

  // Truncate a long slug if needed
  if (typeof slugMaxLength === 'number') {
    slug = truncate(slug, slugMaxLength, { ellipsis: '' }).replace(/-$/, '');
  }

  // We don’t have to rename it when creating a path with a slug given
  if (currentSlug) {
    return slug;
  }

  return renameIfNeeded(
    slug,
    getEntriesByCollection(collectionName)
      .map((e) => (locale ? e.locales[locale]?.slug : e.slug))
      .filter(Boolean),
  );
};
