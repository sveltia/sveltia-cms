import { generateUUID } from '@sveltia/utils/crypto';
import { getDateTimeParts } from '@sveltia/utils/datetime';
import { truncate } from '@sveltia/utils/string';
import moment from 'moment';
import { get } from 'svelte/store';
import { renameIfNeeded } from '$lib/services/utils/file';
import { getFieldConfig } from '$lib/services/contents/entry';
import { getEntriesByCollection } from '$lib/services/contents';
import { siteConfig } from '$lib/services/config';

/**
 * Transform slug template.
 * @param {any} slugPart - Original slug part.
 * @param {string} tf - Transformation.
 * @param {Field} [fieldConfig] - Field configuration.
 * @returns {string} Transformed slug part.
 * @see https://decapcms.org/docs/summary-strings/
 */
export const applyTemplateFilter = (slugPart, tf, fieldConfig) => {
  const slugPartStr = String(slugPart);

  if (tf === 'upper') {
    return slugPartStr.toUpperCase();
  }

  if (tf === 'lower') {
    return slugPartStr.toLowerCase();
  }

  const dateTransformer = tf.match(/^date\('(.*?)'\)$/);

  if (dateTransformer) {
    const [, format] = dateTransformer;

    const { time_format: timeFormat = undefined, picker_utc: pickerUTC = false } =
      /** @type {DateTimeField} */ (fieldConfig) ?? /** @type {DateTimeField} */ ({});

    const dateOnly = timeFormat === false;

    return (
      pickerUTC ||
      (dateOnly && !!slugPartStr?.match(/^\d{4}-[01]\d-[0-3]\d$/)) ||
      (dateOnly && !!slugPartStr.match(/T00:00(?::00)?(?:\.000)?Z$/))
        ? moment.utc(slugPartStr)
        : moment(slugPartStr)
    ).format(format);
  }

  const defaultTransformer = tf.match(/^default\('?(.*?)'?\)$/);

  if (defaultTransformer) {
    const [, defaultValue] = defaultTransformer;

    return slugPart ? slugPartStr : defaultValue;
  }

  const ternaryTransformer = tf.match(/^ternary\('?(.*?)'?,\s*'?(.*?)'?\)$/);

  if (ternaryTransformer) {
    const [, truthyValue, falsyValue] = ternaryTransformer;

    return slugPart ? truthyValue : falsyValue;
  }

  const truncateTransformer = tf.match(/^truncate\((\d+)(?:,\s*'?(.*?)'?)?\)$/);

  if (truncateTransformer) {
    const [, max, ellipsis = ''] = truncateTransformer;

    return truncate(slugPartStr, Number(max), { ellipsis });
  }

  return slugPartStr;
};

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
    // Remove any accent @see https://stackoverflow.com/q/990904
    slug = slug.normalize('NFD').replace(/\p{Diacritic}/gu, '');
  }

  if (encoding === 'ascii') {
    slug = slug.replaceAll(/[^\w-~]/g, ' ');
  } else {
    // Allow Unicode letters and numbers @see https://stackoverflow.com/q/280712
    slug = slug.replaceAll(/[^\p{L}\p{N}]/gu, ' ');
  }

  // Make the string lowercase; replace all the spaces with replacers (hyphens by default)
  return slug.toLocaleLowerCase().trim().replaceAll(/\s+/g, sanitizeReplacement);
};

/**
 * Fill the given slug template.
 * @param {string} template - Template string literal containing tags like `{{title}}`.
 * @param {object} options - Options.
 * @param {'preview_path' | 'media_folder'} [options.type] - Slug type.
 * @param {Collection} options.collection - Entry collection.
 * @param {FlattenedEntryContent} options.content - Entry content for the default locale.
 * @param {string} [options.currentSlug] - Entry slug already created for the path.
 * @param {string} [options.entryFilePath] - File path of the entry. Required if the `type` is
 * `preview_path` or `media_folder`.
 * @param {LocaleCode} [options.locale] - Locale. Required if the `type` is `preview_path`.
 * @param {Record<string, string>} [options.dateTimeParts] - Map of date/time parts. Required if the
 * `type` is `preview_path`.
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
    dateTimeParts = getDateTimeParts(),
  },
) => {
  const {
    name: collectionName,
    identifier_field: identifierField = 'title',
    folder: collectionFolderPath,
    slug_length: slugMaxLength = undefined,
  } = collection;

  /**
   * Replacer subroutine.
   * @param {string} tag - Field name or one of special tags.
   * @returns {any} Slug part.
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
        return (
          (entryFilePath.replace(collectionFolderPath ?? '', '').match(/(.+?)(?:\/[^/]+)?$/) ??
            [])[1] ?? ''
        );
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
      value = valueMap[identifierField] || valueMap.title || valueMap.name || valueMap.label;
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
    let slugPart = replaceSub(tag);

    if (slugPart === undefined) {
      // Use a random ID as a fallback
      return generateUUID('short');
    }

    if (transformations.length) {
      const fieldConfig = getFieldConfig({ collectionName, valueMap, keyPath: tag });

      transformations.forEach((tf) => {
        slugPart = applyTemplateFilter(slugPart, tf, fieldConfig);
      });
    }

    if (slugPart !== undefined) {
      slugPart = normalizeSlug(String(slugPart));
    }

    if (slugPart) {
      return String(slugPart);
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
    getEntriesByCollection(collectionName).map((e) => e.slug),
  );
};
