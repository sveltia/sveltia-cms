import transliterate from '@sindresorhus/transliterate';
import { generateUUID } from '@sveltia/utils/crypto';
import { getDateTimeParts } from '@sveltia/utils/datetime';
import { truncate } from '@sveltia/utils/string';
import { get } from 'svelte/store';
import { siteConfig } from '$lib/services/config';
import { getEntriesByCollection } from '$lib/services/contents/collection/entries';
import { getFieldConfig } from '$lib/services/contents/entry/fields';
import { getEntrySummaryFromContent } from '$lib/services/contents/entry/summary';
import { applyTransformations } from '$lib/services/contents/entry/transformations';
import { renameIfNeeded } from '$lib/services/utils/file';

/**
 * Normalize the given string as a slug for a filename.
 * @param {string} string - String to be normalized.
 * @returns {string} Slug.
 * @see https://decapcms.org/docs/configuration-options/#slug-type
 */
export const normalizeSlug = (string) => {
  const {
    slug: {
      encoding = 'unicode',
      clean_accents: cleanAccents = false,
      sanitize_replacement: sanitizeReplacement = '-',
    } = {},
  } = /** @type {SiteConfig} */ (get(siteConfig)) ?? {};

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
  return slug.toLocaleLowerCase().trim().replaceAll(/\s+/g, sanitizeReplacement);
};

/**
 * Fill the given slug template.
 * @param {string} template - Template string literal containing tags like `{{title}}`.
 * @param {FillSlugTemplateOptions} options - Options.
 * @returns {string} Filled template that can be used for an entry slug, path, etc.
 * @see https://decapcms.org/docs/configuration-options/#slug-type
 * @see https://decapcms.org/docs/configuration-options/#slug
 * @see https://decapcms.org/docs/collection-folder/#media-and-public-folder
 */
export const fillSlugTemplate = (
  template,
  {
    type,
    collection,
    content: valueMap,
    currentSlug,
    entryFilePath,
    locale,
    dateTimeParts = getDateTimeParts({ timeZone: 'UTC' }),
  },
) => {
  const {
    name: collectionName,
    identifier_field: identifierField = 'title',
    slug_length: slugMaxLength = undefined,
  } = collection;

  const basePath =
    collection._type === 'entry'
      ? /** @type {EntryCollection} */ (collection)._file.basePath
      : undefined;

  /**
   * Replacer subroutine.
   * @param {string} tag - Field name or one of special tags.
   * @returns {any} Replaced value.
   */
  const replaceSub = (tag) => {
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
   * @param {string} placeholder - Field name or one of special tags. May contain transformations.
   * @returns {string} Replaced string.
   */
  const replace = (placeholder) => {
    const [tag, ...transformations] = placeholder.split(/\s*\|\s*/);
    let value = replaceSub(tag);

    if (value === undefined) {
      // Use a random ID as a fallback
      return generateUUID('short');
    }

    if (transformations.length) {
      value = applyTransformations({
        fieldConfig: getFieldConfig({ collectionName, valueMap, keyPath: tag }),
        value,
        transformations,
      });
    }

    if (value !== undefined) {
      value = normalizeSlug(String(value));
    }

    if (value) {
      return String(value);
    }

    // Use a random ID as a fallback
    return generateUUID('short');
  };

  let slug = template.replace(/{{(.+?)}}/g, (_match, tag) => replace(tag)).trim();

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
    getEntriesByCollection(collectionName).map((e) =>
      locale ? (e.locales[locale]?.slug ?? e.slug) : e.slug,
    ),
  );
};
