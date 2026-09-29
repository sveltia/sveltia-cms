import { cmsConfig } from '$lib/services/config/state';

/**
 * @import { EntryDraft, InternalCmsConfig } from '$lib/types/private';
 * @import { AssetCollection, Collection, CollectionFile } from '$lib/types/public';
 */

/**
 * Check whether a collection, a collection file or the whole CMS is read-only. The `readonly`
 * option can be set globally, on a collection and on a collection file, and any of them makes
 * everything below it read-only: a collection can’t opt out while the whole CMS is locked for
 * maintenance, for example, and a file can’t while its collection is locked.
 * @param {object} [args] Arguments.
 * @param {InternalCmsConfig} [args.config] CMS configuration. Default: the current one.
 * @param {Collection | AssetCollection} [args.collection] Entry, file or asset collection.
 * @param {CollectionFile} [args.collectionFile] Collection file. File/singleton collection only.
 * @returns {boolean} Result.
 */
export const isReadonly = ({ config = cmsConfig.current, collection, collectionFile } = {}) =>
  !!(config?.readonly || collection?.readonly || collectionFile?.readonly);

/**
 * Check whether an entry draft is read-only, which is when its collection or collection file is,
 * or the whole CMS is. The draft can be viewed but not changed or saved.
 * @param {EntryDraft | null | undefined} draft Entry draft.
 * @returns {boolean} Result.
 */
export const isDraftReadonly = (draft) =>
  !!draft && isReadonly({ collection: draft.collection, collectionFile: draft.collectionFile });

/**
 * Get the i18n key of the message that says something is read-only. The whole CMS being read-only
 * is what users most need to know, e.g. during maintenance, so that message takes precedence.
 * @param {'collection' | 'entry' | 'asset_folder'} scope What is read-only.
 * @returns {string} Message key.
 */
export const getReadonlyMessageKey = (scope) =>
  cmsConfig.current?.readonly ? 'readonly_cms' : `readonly_${scope}`;
