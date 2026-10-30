import { getDateTimeParts } from '@sveltia/utils/datetime';
import { truncate } from '@sveltia/utils/string';

import { getSlugTimeZone, trimSlugEnd } from '$lib/services/common/slug';
import { replaceTemplatePlaceholder } from '$lib/services/common/template/replacers';
import { replaceTemplateTags } from '$lib/services/common/template/tags';
import { cmsConfig } from '$lib/services/config';
import { getEntriesInCollectionFolder } from '$lib/services/contents/collection/entries';
import { getIdentifierFieldName } from '$lib/services/contents/collection/identifier';
import { renameIfNeeded } from '$lib/services/utils/file';
import { getPullRequestEntries } from '$lib/services/workflow';
import {
  getMaxSlugBytes,
  getSlugByteLength,
  truncateSlugBytes,
} from '$lib/services/workflow/branch';

/**
 * @import { ReplaceContext } from '$lib/services/common/template/replacers';
 * @import { FillTemplateOptions } from '$lib/types/private';
 */

/**
 * Creates existing slugs list for uniqueness validation. With Editorial Workflow, the entries that
 * are still in a pull request count as well: a new entry taking the slug of one of them would take
 * its file path and its workflow branch too. So do the new entries riding along in the pull request
 * of an entry of another collection, whose files would collide when it’s published. Every entry
 * stored in the collection folder counts, including those the collection’s `filter` option leaves
 * out, which can belong to another collection sharing the folder.
 * @param {string} collectionName Collection name.
 * @param {string | undefined} locale Locale string.
 * @param {string} [dirPath] Folder within the collection folder the new entry goes to, as chosen
 * with the path editor of a collection with nested entries. The slug of an entry there is its sub
 * path, e.g. `docs/intro`, so only the entries directly in the folder are taken into account, by
 * their file names.
 * @returns {string[]} List of existing slugs.
 */
const getExistingSlugs = (collectionName, locale, dirPath) => {
  const slugs = /** @type {string[]} */ (
    [...getEntriesInCollectionFolder(collectionName), ...getPullRequestEntries(collectionName)]
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
  const identifierField = getIdentifierFieldName(_type === 'entry' ? collection : undefined);

  const { slug_length: legacySlugLength = undefined, _file: { basePath, fullPathRegEx } = {} } =
    _type === 'entry' ? collection : {};

  const slugOptions = cmsConfig.current?.slug;
  // @todo Remove the legacy option prior to the 1.0 release.
  const maxlength = legacySlugLength ?? slugOptions?.maxlength;

  /** @type {ReplaceContext} */
  const context = {
    replaceSubContext: {
      ...options,
      dateTimeParts: dateTimeParts ?? getDateTimeParts({ timeZone: getSlugTimeZone() }),
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

  // A cut may leave the replacement character at the end, which is a hyphen by default but can be
  // configured with `slug.sanitize_replacement`, and dots, which a branch name can’t end with; they
  // go with `trimSlugEnd()`
  let maxBytes = Infinity;

  // Truncate a long slug if the `slug.maxlength` option is set. Leave the end alone if the slug
  // isn’t cut
  if (typeof maxlength === 'number') {
    const truncated = truncate(slug, maxlength, { ellipsis: '' });

    slug = truncated === slug ? slug : trimSlugEnd(truncated);
  } else {
    // Otherwise, cap the slug in bytes so the file name and the Editorial Workflow branch name stay
    // valid. Existing entries are never renamed, since this only applies to a new slug
    maxBytes = getMaxSlugBytes({ collectionName, dirPath });

    if (getSlugByteLength(slug) > maxBytes) {
      slug = trimSlugEnd(truncateSlugBytes(slug, maxBytes));
    }
  }

  // `slugify` removes the trailing dots of a value, but the template may still end with one, as in
  // `{{title}}.`, which a branch name can’t end with. A replacement character in front of it goes
  // as well, like after a cut
  if (slug.endsWith('.')) {
    slug = trimSlugEnd(slug);
  }

  const existingSlugs = getExistingSlugs(collectionName, locale, dirPath);
  /**
   * Make the given slug unique. A dot in a slug is part of the name rather than a file extension,
   * so a number goes at the end.
   * @param {string} str Slug.
   * @returns {string} Unique slug.
   */
  const rename = (str) => renameIfNeeded(str, existingSlugs, { hasExtension: false });
  let uniqueSlug = rename(slug);

  // If the number pushes the slug over the cap, the slug in front of it gives way, so the number
  // stays distinct, like Decap CMS. Another number may be needed then, so try again
  while (maxBytes !== Infinity && getSlugByteLength(uniqueSlug) > maxBytes) {
    const suffixBytes = getSlugByteLength(uniqueSlug) - getSlugByteLength(slug);

    slug = trimSlugEnd(truncateSlugBytes(slug, maxBytes - suffixBytes));
    uniqueSlug = rename(slug);
  }

  return uniqueSlug;
};
