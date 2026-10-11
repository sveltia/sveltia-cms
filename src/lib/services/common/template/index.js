import { getDateTimeParts } from '@sveltia/utils/datetime';
import { escapeRegExp, truncate } from '@sveltia/utils/string';

import { replaceTemplatePlaceholder } from '$lib/services/common/template/replacers';
import { replaceTemplateTags } from '$lib/services/common/template/tags';
import { cmsConfig } from '$lib/services/config';
import { getEntriesInCollectionFolder } from '$lib/services/contents/collection/entries';
import { renameIfNeeded } from '$lib/services/utils/file';
import { getUnpublishedEntriesByCollection } from '$lib/services/workflow';

/**
 * @import { ReplaceContext } from '$lib/services/common/template/replacers';
 * @import { FillTemplateOptions } from '$lib/types/private';
 */

/**
 * Creates existing slugs list for uniqueness validation. With Editorial Workflow, the entries that
 * are still in a pull request count as well: a new entry taking the slug of one of them would take
 * its file path and its workflow branch too. Every entry stored in the collection folder counts,
 * including those the collection’s `filter` option leaves out, which can belong to another
 * collection sharing the folder.
 * @param {string} collectionName Collection name.
 * @param {string | undefined} locale Locale string.
 * @param {string} [dirPath] Folder within the collection folder the new entry goes to, as chosen
 * with the path editor of a nested collection. The slug of an entry there is its sub path, e.g.
 * `docs/intro`, so only the entries directly in the folder are taken into account, by their file
 * names.
 * @returns {string[]} List of existing slugs.
 */
const getExistingSlugs = (collectionName, locale, dirPath) => {
  const slugs = /** @type {string[]} */ (
    [
      ...getEntriesInCollectionFolder(collectionName),
      ...getUnpublishedEntriesByCollection(collectionName),
    ]
      .map((e) => (locale ? e.locales[locale]?.slug : e.slug))
      .filter(Boolean)
  );

  if (dirPath === undefined) {
    return slugs;
  }

  const prefix = dirPath ? `${dirPath}/` : '';

  return slugs
    .filter((slug) => slug.startsWith(prefix) && !slug.slice(prefix.length).includes('/'))
    .map((slug) => slug.slice(prefix.length));
};

/**
 * Fills a template string with values from the given options.
 * @param {string} template Template string literal containing tags like `{{title}}`.
 * @param {FillTemplateOptions} options Options.
 * @returns {string} Filled template that can be used for an entry slug, path, etc.
 * @see https://decapcms.org/docs/configuration-options/#slug-type
 * @see https://decapcms.org/docs/configuration-options/#slug
 * @see https://decapcms.org/docs/collection-folder/#media-and-public-folder
 * @see https://sveltiacms.app/en/docs/collections/entries/slugs#entry-slugs
 * @see https://sveltiacms.app/en/docs/media/internal#using-placeholders
 */
export const fillTemplate = (template, options) => {
  const {
    collection,
    content: valueMap,
    currentSlug,
    locale,
    dateTimeParts,
    isIndexFile = false,
    dirPath,
  } = options;

  const { _type, name: collectionName } = collection;

  const {
    identifier_field: identifierField = 'title',
    slug_length: legacySlugLength = undefined,
    _file: { basePath, fullPathRegEx } = {},
  } = _type === 'entry' ? collection : {};

  const slugOptions = cmsConfig.current?.slug;
  // @todo Remove the legacy option prior to the 1.0 release.
  const maxlength = legacySlugLength ?? slugOptions?.maxlength;
  const timeZone = slugOptions?.timezone === 'local' ? undefined : 'UTC';

  /** @type {ReplaceContext} */
  const context = {
    replaceSubContext: {
      ...options,
      dateTimeParts: dateTimeParts ?? getDateTimeParts({ timeZone }),
      identifierField,
      basePath,
      fullPathRegEx,
    },
    getFieldArgs: { collectionName, keyPath: '', valueMap, isIndexFile },
  };

  // Use a negative lookahead assertion to support nested template tags in transformations like
  // `{{fields.slug | default('{{fields.title}}')}}` or `{{draft | ternary('{{subtitle}}',
  // '{{title}}')}}`
  let slug = replaceTemplateTags(template, (_match, tag) =>
    replaceTemplatePlaceholder(tag, context),
  ).trim();

  // We don’t have to rename it when creating a path with a slug given. Skip truncation because the
  // slug has already been truncated during its own generation, and truncating the entire filled
  // path template (e.g. `{{slug}}/+page`) would break the non-slug parts of the path.
  if (currentSlug) {
    return slug;
  }

  // Truncate a long slug if needed, and remove the replacement character the cut may leave at the
  // end, which is a hyphen by default but can be configured with `slug.sanitize_replacement`. Like
  // `slugify`, leave the end alone if the slug isn’t cut or `slug.trim` is turned off, so a slug
  // can still end with the replacement
  if (typeof maxlength === 'number') {
    const { sanitize_replacement: replacement = '-', trim = true } = slugOptions ?? {};
    const truncated = truncate(slug, maxlength, { ellipsis: '' });

    if (truncated !== slug && replacement && trim) {
      slug = truncated.replace(new RegExp(`(?:${escapeRegExp(replacement)})+$`), '');
    } else {
      slug = truncated;
    }
  }

  return renameIfNeeded(slug, getExistingSlugs(collectionName, locale, dirPath));
};
