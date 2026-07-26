import { unflatten } from 'flat';
import { fromJS } from 'immutable';

/**
 * @import { MapOf } from 'immutable';
 * @import { Asset, Entry, FlattenedEntryContent, InternalLocaleCode } from '$lib/types/private';
 * @import { ApiEntry } from '$lib/types/public';
 */

/**
 * Create an Immutable.js Map representing the entry data, compatible with Netlify/Decap CMS event
 * hook handlers.
 * @param {object} args Arguments.
 * @param {FlattenedEntryContent} args.content Entry content for the default locale.
 * @param {string[]} args.otherLocales Other locale keys.
 * @param {Entry['locales']} args.locales All locale data keyed by locale.
 * @param {string} args.slug Entry slug.
 * @param {string} args.path Entry file path.
 * @param {boolean} args.isNew Whether the entry is new.
 * @param {string} args.collectionName Collection name.
 * @param {Asset[]} args.associatedAssets Assets associated with the entry.
 * @returns {MapOf<ApiEntry>} Immutable Map of the entry data.
 * @see https://immutable-js.com/docs/v5/Map/
 */
export const createEntryMap = ({
  content,
  otherLocales,
  locales,
  slug,
  path,
  isNew,
  collectionName,
  associatedAssets,
}) =>
  // @ts-ignore
  fromJS({
    // Entry data for the default locale
    data: unflatten(content),
    // Entry data for other locales
    // @see https://github.com/decaporg/decap-cms/issues/4729
    i18n: Object.fromEntries(
      otherLocales.map((locale) => [locale, { data: unflatten(locales[locale].content) }]),
    ),
    // Other entry properties
    slug,
    path,
    newRecord: isNew,
    collection: collectionName,
    mediaFiles: associatedAssets.map(({ sha, file, size, blobURL, ...asset }) => ({
      id: sha,
      name: asset.name,
      path: asset.path,
      file,
      size,
      url: blobURL,
      displayURL: blobURL,
    })),
    // Additional properties included for compatibility with Netlify/Decap CMS
    meta: { path },
    isModification: null,
    label: null,
    partial: false,
    author: '',
    raw: '',
    status: '',
    updatedOn: '',
  });

/**
 * Convert an entry to an Immutable Map for preview templates.
 * @param {object} args Arguments.
 * @param {Entry | undefined} args.entry Entry object to convert.
 * @param {InternalLocaleCode} args.locale Locale to use for content and path extraction.
 * @param {string} args.collectionName Collection name.
 * @param {Asset[]} args.associatedAssets Associated assets to include.
 * @param {FlattenedEntryContent} [args.content] Optional content override (if not provided,
 * extracted from entry).
 * @returns {MapOf<ApiEntry>} Immutable Map of entry data.
 */
export const convertEntryToMap = ({ entry, locale, collectionName, associatedAssets, content }) => {
  const entryContent = content ?? entry?.locales?.[locale]?.content ?? {};

  return /** @type {MapOf<ApiEntry>} */ (
    createEntryMap({
      content: entryContent,
      otherLocales: Object.keys(entry?.locales ?? {}).filter((l) => l !== locale),
      locales: entry?.locales ?? {},
      slug: entry?.slug ?? '',
      path: entry?.locales?.[locale]?.path ?? '',
      isNew: false,
      collectionName,
      associatedAssets,
    })
  );
};
