import { isObject } from '@sveltia/utils/object';
import { flatten } from 'flat';
import { isMap } from 'immutable';

import { createEntryMap } from '$lib/services/api/helpers';
import { eventHookRegistry } from '$lib/services/api/registries';
import { getAssociatedAssets } from '$lib/services/contents/entry/assets';
import { user } from '$lib/services/user/account.svelte';

/**
 * @import {
 * Entry,
 * InternalCollection,
 * InternalCollectionFile,
 * User,
 * } from '$lib/types/private';
 * @import { AppEventType } from '$lib/types/public';
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
 * Event types whose handler can return updated entry data, which is then written to the file.
 *
 * `prePublish` is deliberately absent: by the time an Editorial Workflow entry is published, its
 * content has already been committed to the pull request branch, and publishing only merges that
 * branch. Applying an update here would change the in-memory entry without changing the file,
 * leaving the two out of sync. Supporting it means re-serializing the entry and committing it to
 * the branch before the merge.
 * @type {AppEventType[]}
 */
export const UPDATABLE_EVENT_TYPES = ['preSave'];

/**
 * Call the registered event hooks.
 * @param {object} args Arguments.
 * @param {AppEventType} args.type Type of event.
 * @param {Entry} args.entry Entry the event is about. This object may be mutated by the hook when
 * the event type is in {@link UPDATABLE_EVENT_TYPES}.
 * @param {InternalCollection} args.collection Collection the entry belongs to.
 * @param {InternalCollectionFile} [args.collectionFile] Collection file. File/singleton collection
 * only.
 * @param {boolean} [args.isNew] Whether the entry is being created rather than updated.
 */
export const callEventHooks = async ({
  type,
  entry,
  collection,
  collectionFile,
  isNew = false,
}) => {
  const { login = '', name = '' } = /** @type {User} */ (user.account);
  const collectionName = collection.name;
  const fileName = collectionFile?.name;

  const {
    _i18n: { defaultLocale },
  } = collectionFile ?? collection;

  const { slug, locales } = entry;
  const otherLocales = Object.keys(locales).filter((locale) => locale !== defaultLocale);
  // A multi-file i18n entry can be missing its default locale file, in which case any locale
  // stands in rather than the destructuring throwing
  const { content, path } = locales[defaultLocale] ?? Object.values(locales)[0] ?? {};
  const associatedAssets = getAssociatedAssets({ entry, collectionName, fileName });

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
