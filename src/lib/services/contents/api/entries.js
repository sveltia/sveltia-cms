import { unflatten } from 'flat';
import { fromJS } from 'immutable';

/**
 * @import { MapOf } from 'immutable';
 * @import { Asset, Entry } from '$lib/types/private';
 * @import { ApiEntry } from '$lib/types/public';
 */

/**
 * Create an Immutable.js Map representing the entry data, compatible with Netlify/Decap CMS event
 * hook handlers.
 * @param {object} args Arguments.
 * @param {Record<string, any>} args.content Entry content for the default locale.
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
