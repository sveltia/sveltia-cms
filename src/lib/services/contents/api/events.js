import { isObject } from '@sveltia/utils/object';
import { flatten } from 'flat';
import { isMap } from 'immutable';

import { createEntryMap } from '$lib/services/contents/api/entries';
import { getAssociatedAssets } from '$lib/services/contents/entry/assets';
import { user } from '$lib/services/user/account.svelte';

/**
 * @import { Entry, EntryDraft, User } from '$lib/types/private';
 * @import { AppEventListener, AppEventType } from '$lib/types/public';
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
 */
export const callEventHooks = async ({ type, draft, savingEntry }) => {
  const { login = '', name = '' } = /** @type {User} */ (user.account);
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
      entry: createEntryMap({
        content,
        otherLocales,
        locales,
        slug,
        path,
        isNew,
        collectionName,
        associatedAssets,
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
      } else {
        // `map` is always a plain object here (guaranteed by `isMap(updatedMap)` above)
        locales[defaultLocale].content = flatten(map);
      }
    }
  }
};
