import transliterate from '@sindresorhus/transliterate';
import { generateUUID } from '@sveltia/utils/crypto';
import { getDateTimeParts } from '@sveltia/utils/datetime';
import { truncate } from '@sveltia/utils/string';
import moment from 'moment';
import { get } from 'svelte/store';
import { renameIfNeeded } from '$lib/services/utils/file';
import { getEntryTitleFromContent, getFieldConfig } from '$lib/services/contents/entry';
import { getEntriesByCollection } from '$lib/services/contents';
import { siteConfig } from '$lib/services/config';
import { parseDateTimeConfig } from '$lib/components/contents/details/widgets/date-time/helper';

/**
 * Apply a string transformation to the value.
 * @param {object} args - Arguments.
 * @param {Field} [args.fieldConfig] - Field configuration.
 * @param {string} args.value - Original value.
 * @param {string} args.transformation - List of transformations.
 * @returns {string} Transformed value.
 * @see https://decapcms.org/docs/summary-strings/
 */
const applyTransformation = ({ fieldConfig, value, transformation }) => {
  const slugPartStr = String(value);

  if (transformation === 'upper') {
    return slugPartStr.toUpperCase();
  }

  if (transformation === 'lower') {
    return slugPartStr.toLowerCase();
  }

  const dateTransformer = transformation.match(/^date\('(.*?)'\)$/);

  if (dateTransformer) {
    const [, format] = dateTransformer;
    const { dateOnly, utc } = parseDateTimeConfig(/** @type {DateTimeField} */ (fieldConfig ?? {}));

    return (
      utc ||
      (dateOnly && !!slugPartStr?.match(/^\d{4}-[01]\d-[0-3]\d$/)) ||
      (dateOnly && !!slugPartStr.match(/T00:00(?::00)?(?:\.000)?Z$/))
        ? moment.utc(slugPartStr)
        : moment(slugPartStr)
    ).format(format);
  }

  const defaultTransformer = transformation.match(/^default\('?(.*?)'?\)$/);

  if (defaultTransformer) {
    const [, defaultValue] = defaultTransformer;

    return value ? slugPartStr : defaultValue;
  }

  const ternaryTransformer = transformation.match(/^ternary\('?(.*?)'?,\s*'?(.*?)'?\)$/);

  if (ternaryTransformer) {
    const [, truthyValue, falsyValue] = ternaryTransformer;

    return value ? truthyValue : falsyValue;
  }

  const truncateTransformer = transformation.match(/^truncate\((\d+)(?:,\s*'?(.*?)'?)?\)$/);

  if (truncateTransformer) {
    const [, max, ellipsis = ''] = truncateTransformer;

    return truncate(slugPartStr, Number(max), { ellipsis });
  }

  return slugPartStr;
};

/**
 * Apply string transformations to the value.
 * @param {object} args - Arguments.
 * @param {Field} [args.fieldConfig] - Field configuration.
 * @param {string} args.value - Original value.
 * @param {string[]} args.transformations - List of transformations.
 * @returns {string} Transformed value.
 */
export const applyTransformations = ({ fieldConfig, value, transformations }) => {
  transformations.forEach((transformation) => {
    value = applyTransformation({ fieldConfig, value, transformation });
  });

  return value;
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
    // Allow Unicode letters and numbers @see https://stackoverflow.com/q/280712
    slug = slug.replaceAll(/[^\p{L}\p{N}]/gu, ' ');
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
    dateTimeParts = getDateTimeParts(),
  },
) => {
  const {
    name: collectionName,
    folder,
    identifier_field: identifierField = 'title',
    slug_length: slugMaxLength = undefined,
  } = collection;

  const basePath = folder ? /** @type {EntryCollection} */ (collection)._file.basePath : undefined;

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
      value = getEntryTitleFromContent(valueMap, { identifierField });
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
