import { get } from 'svelte/store';
import { siteConfig } from '$lib/services/config';
import { getEntriesByCollection } from '$lib/services/contents';
import { getDateTimeParts } from '$lib/services/utils/datetime';
import { renameIfNeeded } from '$lib/services/utils/files';
import { generateUUID } from '$lib/services/utils/strings';

/**
 * Normalize the given string as a slug for a filename.
 * @param {string} string String to be normalized.
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
  } = get(siteConfig);

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
 * @param {string} template Template string literal containing tags like `{{title}}`.
 * @param {object} options Options.
 * @param {Collection} options.collection Entry collection.
 * @param {FlattenedEntryContent} options.content Entry content for the default locale.
 * @param {string} [options.currentSlug] Entry slug already created for the path.
 * @param {boolean} [options.isMediaFolder] Whether to support additional template tags, for a
 * collection-specific media/public folder: `dirname`, `filename` and `extension`.
 * @param {string} [options.entryFilePath] File path of the entry. Required if the `isMediaFolder`
 * option is `true`.
 * @returns {string} Filled template that can be used for an entry slug, path, etc.
 * @see https://decapcms.org/docs/configuration-options/#slug-type
 * @see https://decapcms.org/docs/configuration-options/#slug
 * @see https://decapcms.org/docs/beta-features/#folder-collections-media-and-public-folder
 */
export const fillSlugTemplate = (
  template,
  { collection, content, currentSlug = '', isMediaFolder = false, entryFilePath = '' },
) => {
  const {
    name: collectionName,
    identifier_field: identifierField = 'title',
    folder: collectionFolderPath,
  } = collection;

  const dateTimeParts = getDateTimeParts();

  const slug = template.replaceAll(/{{(.+?)}}/g, (_match, tag) => {
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
      // Last 12 characters
      return generateUUID().split('-').pop();
    }

    if (tag === 'uuid_shorter') {
      // First 8 characters
      return generateUUID().split('-').shift();
    }

    if (isMediaFolder) {
      if (!entryFilePath) {
        return '';
      }

      if (tag === 'dirname') {
        return entryFilePath.replace(collectionFolderPath, '').split('/').slice(0, -1).join('/');
      }

      if (tag === 'filename') {
        return entryFilePath.split('/').pop().split('.').shift();
      }

      if (tag === 'extension') {
        return entryFilePath.split('/').pop().split('.').pop();
      }
    }

    let value;

    if (tag.startsWith('fields.')) {
      value = content[tag.replace(/^fields\./, '')];
    } else if (tag === 'slug') {
      value = content[identifierField] || content.title || content.name || content.label;
    } else {
      value = content[tag];
    }

    if (value) {
      value = normalizeSlug(value);
    }

    if (value) {
      return value;
    }

    // Use a random ID as a fallback
    return generateUUID().split('-').pop();
  });

  // We don’t have to rename it when creating a path with a slug given
  if (currentSlug) {
    return slug;
  }

  return renameIfNeeded(
    slug,
    getEntriesByCollection(collectionName).map((e) => e.slug),
  );
};
