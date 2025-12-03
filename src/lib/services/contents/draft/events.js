import { isObject } from '@sveltia/utils/object';
import { flatten, unflatten } from 'flat';
import { fromJS, isMap } from 'immutable';
import { get } from 'svelte/store';

import { getAssociatedAssets } from '$lib/services/contents/entry/assets';
import { user } from '$lib/services/user';

/**
 * @import { AppEventListener, AppEventType } from '$lib/types/public';
 * @import { Asset, Entry, EntryDraft, User } from '$lib/types/private';
 */

/**
 * Supported event hooks.
 * @type {AppEventType[]}
 */
export const SUPPORTED_EVENT_TYPES = [
  'preSave',
  'postSave',
  'prePublish',
  'postPublish',
  'preUnpublish',
  'postUnpublish',
];

/**
 * Event types that allow updating of the entry data.
 * @type {AppEventType[]}
 */
export const UPDATABLE_EVENT_TYPES = ['preSave', 'prePublish'];

/**
 * @type {Set<AppEventListener>}
 */
export const eventHookRegistry = new Set();

/**
 * Call the registered event hooks.
 * @param {object} args Arguments.
 * @param {AppEventType} args.type Type of event.
 * @param {EntryDraft} args.draft Entry draft being saved.
 * @param {Entry} args.savingEntry Entry being saved. This object may be mutated by the hook.
 * @see https://immutable-js.com/docs/v5/Map/
 */
export const callEventHooks = async ({ type, draft, savingEntry }) => {
  const { login = '', name = '' } = /** @type {User} */ (get(user));
  const { collection, collectionFile, isNew, collectionName, fileName } = draft;

  const {
    _i18n: { defaultLocale },
  } = collectionFile ?? collection;

  const { slug, locales } = savingEntry;
  const otherLocales = Object.keys(locales).filter((locale) => locale !== defaultLocale);
  const { content, path } = locales[defaultLocale];
  const associatedAssets = getAssociatedAssets({ entry: savingEntry, collectionName, fileName });

  // We need to use a for loop here to call handlers sequentially
  // eslint-disable-next-line no-restricted-syntax
  for (const hook of eventHookRegistry) {
    if (hook.name !== type) {
      // eslint-disable-next-line no-continue
      continue;
    }

    // eslint-disable-next-line no-await-in-loop
    const updatedMap = await hook.handler({
      author: { login, name },
      // Create an Immutable.js Map representing the entry data with deep conversion
      // @ts-ignore
      entry: fromJS({
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
      }),
    });

    // If the hook returned an updated entry, merge its data back into the savingEntry
    if (UPDATABLE_EVENT_TYPES.includes(type) && isMap(updatedMap)) {
      const map = updatedMap.toJS();

      if (isObject(map.data) && isObject(map.i18n)) {
        locales[defaultLocale].content = flatten(map.data);

        otherLocales.forEach((locale) => {
          if (isObject(map.i18n[locale]?.data)) {
            locales[locale].content = flatten(map.i18n[locale].data);
          }
        });
      } else if (isObject(map)) {
        locales[defaultLocale].content = flatten(map);
      }
    }
  }
};
