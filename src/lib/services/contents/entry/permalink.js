import { mapEntryContent } from '$lib/services/contents/entry/locales';
import { getManagedKey } from '$lib/services/contents/entry/managed-key';
import { getSitePath } from '$lib/services/contents/entry/site-path';

/**
 * @import {
 * Entry,
 * FlattenedEntryContent,
 * InternalCollection,
 * InternalEntryCollection,
 * InternalLocaleCode,
 * } from '$lib/types/private';
 * @import { Field, FieldKeyPath } from '$lib/types/public';
 */

/**
 * Property name used to store an entry’s permalink when the `permalink_field` option is `true`.
 * It’s what Eleventy reads to decide where to build a page.
 * @see https://www.11ty.dev/docs/permalinks/
 */
export const DEFAULT_PERMALINK_KEY = 'permalink';

/**
 * Get the property name used to store the permalink of entries in the given collection.
 * @param {object} args Arguments.
 * @param {InternalCollection} args.collection Collection.
 * @param {Field[]} [args.fields] Field list of the collection or the collection’s index file.
 * @returns {FieldKeyPath | undefined} Property name, or `undefined` if permalinks are not managed
 * by the CMS, which is the default as the property means something else to other generators.
 */
export const getPermalinkKey = ({ collection, fields }) =>
  getManagedKey({
    collection,
    fields,
    option: /** @type {InternalEntryCollection} */ (collection)?.permalink_field,
    defaultKey: DEFAULT_PERMALINK_KEY,
  });

/**
 * Store the entry’s path on the live site, filled from the `preview_path` option, in the property
 * named with the `permalink_field` option, so the site is built with the path the CMS links to. If
 * the path can’t be worked out, e.g. because the date it contains is empty, the property is
 * removed, as an outdated path could build the page over another one.
 *
 * Only a string is replaced: anything else in the property is the user’s, like Eleventy’s
 * `permalink: false`, which keeps a page from being built at all, or its object form.
 * @param {object} args Arguments.
 * @param {InternalCollection} args.collection Collection.
 * @param {Field[]} [args.fields] Field list of the collection or the collection’s index file.
 * @param {boolean} [args.isIndexFile] Whether the entry is the collection’s index file.
 * @param {InternalLocaleCode} args.locale Locale code.
 * @param {FlattenedEntryContent} args.content Flattened entry content to be modified in place.
 * @param {FlattenedEntryContent} [args.defaultContent] Entry content for the default locale.
 * @param {string} [args.slug] Entry slug for the locale.
 * @param {string} [args.path] Entry file path for the locale.
 * @see https://github.com/sveltia/sveltia-cms/discussions/1133
 */
export const fillPermalink = ({
  collection,
  fields,
  isIndexFile = false,
  locale,
  content,
  defaultContent,
  slug,
  path,
}) => {
  // This is `undefined` unless the option is enabled for an entry collection
  const permalinkKey = getPermalinkKey({ collection, fields });

  // The index file is Hugo’s, which doesn’t have a use for the property
  if (
    !permalinkKey ||
    isIndexFile ||
    !(/** @type {InternalEntryCollection} */ (collection).preview_path)
  ) {
    return;
  }

  const isUserValue =
    typeof (content[permalinkKey] ?? '') !== 'string' ||
    Object.keys(content).some((keyPath) => keyPath.startsWith(`${permalinkKey}.`));

  if (isUserValue) {
    return;
  }

  const sitePath = getSitePath({ collection, locale, slug, path, content, defaultContent });

  if (sitePath === undefined) {
    delete content[permalinkKey];
  } else {
    content[permalinkKey] = sitePath;
  }
};

/**
 * Refresh the permalink of an entry changed without the entry editor, such as one moved along with
 * its folder or changed by a bulk edit, as the path can depend on the slug and on any field.
 * @param {object} args Arguments.
 * @param {InternalCollection} args.collection Collection the entry belongs to.
 * @param {boolean} [args.isIndexFile] Whether the entry is the collection’s index file.
 * @param {Entry} args.entry Entry with the changes applied.
 * @returns {Entry} Entry with the permalink updated in every locale that has content. The given
 * entry is returned as is when the collection doesn’t store permalinks.
 */
export const refreshPermalinks = ({ collection, isIndexFile = false, entry }) => {
  const { fields } = /** @type {InternalEntryCollection} */ (collection);

  if (isIndexFile || !getPermalinkKey({ collection, fields })) {
    return entry;
  }

  const defaultContent = entry.locales[collection._i18n.defaultLocale]?.content;

  return mapEntryContent(entry, ({ locale, localizedEntry: { slug, path, content } }) => {
    const copiedContent = { .../** @type {FlattenedEntryContent} */ (content) };

    fillPermalink({
      collection,
      fields,
      locale,
      content: copiedContent,
      defaultContent,
      slug,
      path,
    });

    return copiedContent;
  });
};
