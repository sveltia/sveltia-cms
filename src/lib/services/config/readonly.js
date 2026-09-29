import { _ } from '@sveltia/i18n';

import { lockedBranch } from '$lib/services/backends/branch-access';
import { cmsConfig } from '$lib/services/config/state';
import { getPublishMode } from '$lib/services/workflow/config';

/**
 * @import { AssetFolderInfo, EntryDraft, InternalCmsConfig } from '$lib/types/private';
 * @import { AssetCollection, Collection, CollectionFile } from '$lib/types/public';
 */

/**
 * Check whether a collection, a collection file or the whole CMS is made read-only with the
 * `readonly` option. The option can be set globally, on a collection and on a collection file, and
 * any of them makes everything below it read-only: a collection can’t opt out while the whole CMS
 * is locked for maintenance, for example, and a file can’t while its collection is locked.
 * @param {object} [args] Arguments.
 * @param {InternalCmsConfig} [args.config] CMS configuration. Default: the current one.
 * @param {Collection | AssetCollection} [args.collection] Entry, file or asset collection.
 * @param {CollectionFile} [args.collectionFile] Collection file. File/singleton collection only.
 * @returns {boolean} Result.
 */
export const isConfigReadonly = ({ config = cmsConfig.current, collection, collectionFile } = {}) =>
  !!(config?.readonly || collection?.readonly || collectionFile?.readonly);

/**
 * Check whether a collection is read-only because the signed-in user can’t push to the configured
 * branch. A collection with the simple publish mode commits to the branch directly, while one with
 * Editorial Workflow commits to a branch of its own and still works.
 * @param {Collection} [collection] Collection.
 * @returns {boolean} Result.
 */
export const isLockedByBranch = (collection) =>
  !!lockedBranch.current &&
  !!collection &&
  getPublishMode({ cmsConfig: cmsConfig.current, collection }) !== 'editorial_workflow';

/**
 * Check whether a collection, a collection file or the whole CMS is read-only, either with the
 * `readonly` option (see {@link isConfigReadonly}) or because the signed-in user can’t push to the
 * configured branch (see {@link isLockedByBranch}).
 * @param {object} [args] Arguments.
 * @param {Collection} [args.collection] Entry or file collection.
 * @param {CollectionFile} [args.collectionFile] Collection file. File/singleton collection only.
 * @returns {boolean} Result.
 */
export const isReadonly = ({ collection, collectionFile } = {}) =>
  isConfigReadonly({ collection, collectionFile }) || isLockedByBranch(collection);

/**
 * Check whether an entry draft is read-only, which is when its collection or collection file is,
 * or the whole CMS is. The draft can be viewed but not changed or saved.
 * @param {EntryDraft | null | undefined} draft Entry draft.
 * @returns {boolean} Result.
 */
export const isDraftReadonly = (draft) =>
  !!draft && isReadonly({ collection: draft.collection, collectionFile: draft.collectionFile });

/**
 * Get the message that says something is read-only. The whole CMS being read-only is what users
 * most need to know, e.g. during maintenance, so that message takes precedence. Otherwise a target
 * made read-only with the `readonly` option gets the message for its scope, and one that is only
 * read-only because the user can’t push to the branch gets a message naming the branch.
 * @param {'collection' | 'entry' | 'asset_folder'} scope What is read-only.
 * @param {object} [target] What is read-only.
 * @param {Collection} [target.collection] Collection of the collection or entry.
 * @param {CollectionFile} [target.collectionFile] Collection file of the entry.
 * @param {AssetFolderInfo} [target.folder] Asset folder.
 * @returns {string} Message.
 */
export const getReadonlyMessage = (scope, { collection, collectionFile, folder } = {}) => {
  if (cmsConfig.current?.readonly) {
    return _('readonly_cms');
  }

  const configReadonly =
    scope === 'asset_folder'
      ? !!folder?.readonly
      : isConfigReadonly({ collection, collectionFile });

  if (!configReadonly && lockedBranch.current) {
    return _('readonly_branch', { values: { branch: lockedBranch.current } });
  }

  return _(`readonly_${scope}`);
};
