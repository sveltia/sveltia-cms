import { _ } from '@sveltia/i18n';
import { getPathInfo } from '@sveltia/utils/file';

import { isInCmsFolder } from '$lib/services/assets/reserved';
import { getErrorMessage } from '$lib/services/backends/git/shared/errors';
import { createFileList } from '$lib/services/backends/process';
import { findEntryByPaths } from '$lib/services/contents';
import { getCollection } from '$lib/services/contents/collection';
import { getEntriesByCollection } from '$lib/services/contents/collection/entries';
import { getCollectionFile } from '$lib/services/contents/collection/files';
import {
  getEntryDirPath,
  getNestedConfig,
  isDescendantPath,
} from '$lib/services/contents/collection/nested';
import { getEntryPaths } from '$lib/services/contents/entry/paths';
import { planCascadeDelete } from '$lib/services/contents/entry/relations/cascade/delete';
import { collectRenameTargets } from '$lib/services/contents/entry/relations/cascade/update';
import { unpublishedEntries } from '$lib/services/workflow';

/**
 * @import {
 * Entry,
 * InternalCollection,
 * UnpublishedEntry,
 * WorkflowBackendService,
 * WorkflowChangedFile,
 * WorkflowMergeState,
 * } from '$lib/types/private';
 */

/**
 * Message of the error thrown when publishing is refused, whose `cause` is a
 * {@link PublishRefusal}.
 */
export const PUBLISH_REFUSED = 'publish_refused';

/**
 * Why publishing an entry was refused.
 * @typedef {object} PublishRefusal
 * @property {'entry_changed' | 'other_changes'} reason `entry_changed` when the branch has moved on
 * since the entry was loaded or saved, so what would be merged isn’t what was reviewed;
 * `other_changes` when the pull request changes something the CMS doesn’t show for the entry, goes
 * somewhere other than the configured branch, or has too many files to tell.
 * @property {string[]} paths Paths of the files the CMS doesn’t account for, if any.
 */

/**
 * Git file modes of a regular file, executable or not. Anything else — a symbolic link, which a
 * site build would follow to a file outside the content, or a submodule, which brings in another
 * repository — isn’t something the CMS ever commits, and can’t be shown as an entry or an asset.
 */
const REGULAR_FILE_MODES = ['100644', '100755'];
/**
 * How a pull request touches a single path: a rename touches two, removing one and adding the
 * other.
 * @typedef {{ path: string, change: 'added' | 'modified' | 'removed', mode?: string }} PathChange
 */

/**
 * Split the given changed files into the paths they touch.
 * @param {WorkflowChangedFile[]} files Changed files.
 * @returns {PathChange[]} Path changes.
 */
const getPathChanges = (files) =>
  files.flatMap(({ path, status, previousPath, mode }) => {
    if (status === 'renamed') {
      return /** @type {PathChange[]} */ ([
        ...(previousPath ? [{ path: previousPath, change: 'removed' }] : []),
        { path, change: 'added', mode },
      ]);
    }

    return [{ path, change: status, mode }];
  });

/**
 * Classify the given path the way the file list is built on load.
 * @param {string} path File path.
 * @returns {{ type: 'entry', collectionName: string } | { type: 'asset' } | undefined} Entry
 * file with the collection it belongs to, asset file, or `undefined` for anything else, including
 * Git config files, which the CMS never commits to a workflow branch.
 */
const classifyPath = (path) => {
  const { entryFiles, assetFiles } = createFileList([
    { path, name: getPathInfo(path).basename, sha: '', size: 0 },
  ]);

  if (entryFiles.length) {
    return { type: 'entry', collectionName: entryFiles[0].folder.collectionName };
  }

  if (assetFiles.length) {
    return { type: 'asset' };
  }

  return undefined;
};

/**
 * Get the published entry the given unpublished entry updates. Unlike `getPublishedVersion()`, an
 * entry that still sits at one of its paths is matched by those alone: the paths the pull request
 * vacates are only consulted for a renamed entry, so a pull request that edits one entry while
 * deleting another can’t pass the deletion off as the rename of the first. Moving a nested entry
 * vacates the paths of the entries below it as well, so of the entries found there, the one
 * highest up the tree is the one that moved.
 * @param {UnpublishedEntry} entry Unpublished entry.
 * @returns {Entry | undefined} Published entry, if any.
 */
const getUpdatedEntry = (entry) => {
  const current = findEntryByPaths(getEntryPaths(entry));

  if (current) {
    return current;
  }

  /**
   * Get the depth of the given entry in its collection.
   * @param {Entry} e Entry.
   * @returns {number} Number of path segments in its sub path.
   */
  const getDepth = (e) => e.subPath.split('/').length;

  return (entry.workflow.previousPaths ?? [])
    .map((path) => findEntryByPaths([path]))
    .filter((e) => !!e)
    .reduce(
      (highest, e) => (!highest || getDepth(e) < getDepth(highest) ? e : highest),
      /** @type {Entry | undefined} */ (undefined),
    );
};

/**
 * Get the paths below the given entry’s folder in a nested collection with subfolders, which moving
 * the entry moves along with it. An entry at the top of the collection has no folder of its own,
 * and nothing can be moved with it.
 * @param {InternalCollection | undefined} collection Collection.
 * @param {Entry} entry Entry as it stands on the configured branch.
 * @returns {string[]} Paths of the descendant entries, as they stand on the configured branch.
 */
const getDescendantPaths = (collection, entry) => {
  if (!collection || !getNestedConfig(collection)?.subfolders) {
    return [];
  }

  const dirPath = getEntryDirPath(entry.subPath);

  if (!dirPath) {
    return [];
  }

  return getEntriesByCollection(collection.name)
    .filter((e) => e.id !== entry.id && isDescendantPath(dirPath, e.subPath))
    .flatMap((e) => getEntryPaths(e));
};

/**
 * Get the folders below which the given entry’s descendants land once it has moved, which are the
 * folders of its own files in a nested collection with subfolders.
 * @param {InternalCollection | undefined} collection Collection.
 * @param {Entry} entry Entry as it stands on the pull request’s branch.
 * @returns {string[]} Folder paths, each with a trailing slash.
 */
const getDescendantFolders = (collection, entry) => {
  if (!collection || !getNestedConfig(collection)?.subfolders || !getEntryDirPath(entry.subPath)) {
    return [];
  }

  return getEntryPaths(entry).map((path) => path.slice(0, path.lastIndexOf('/') + 1));
};

/**
 * Get the paths of the entries whose references to the given entry the CMS rewrites along with it:
 * those referencing its published version when it’s renamed, or when it’s deleted. A selection of
 * entries is deleted with the same rewrite in each pull request, so the references to the other
 * entries of the collection awaiting deletion count as well. The entries are worked out from the
 * published ones, the way the CMS did when it committed the rewrite.
 * @param {object} args Arguments.
 * @param {UnpublishedEntry} args.entry Unpublished entry being published.
 * @param {InternalCollection | undefined} args.collection Collection the entry belongs to.
 * @param {Entry | undefined} args.updatedEntry Published version of the entry.
 * @param {boolean} args.deletion Whether the entry is being deleted.
 * @returns {string[]} Paths.
 */
const getReferencingPaths = ({ entry, collection, updatedEntry, deletion }) => {
  const { collectionName, fileName } = entry.workflow;

  if (!collection) {
    return [];
  }

  const collectionFile = fileName ? getCollectionFile(collection, fileName) : undefined;

  const targets = deletion
    ? planCascadeDelete({
        collection,
        collectionFile,
        entries: [
          entry,
          ...unpublishedEntries.current.filter(
            (e) =>
              e !== entry &&
              e.workflow.status === 'pending_deletion' &&
              e.workflow.collectionName === collectionName &&
              e.workflow.fileName === fileName,
          ),
        ],
      }).targets
    : collectRenameTargets({
        collection,
        collectionFile,
        originalEntry: updatedEntry,
        savingEntry: entry,
      });

  return targets.flatMap((target) => getEntryPaths(target.entry));
};

/**
 * Find the changes in a pull request that the CMS doesn’t account for. The board shows an entry
 * and its assets, but publishing merges the whole pull request, so anything else on the branch —
 * code, workflows, configuration, another entry — would otherwise go live without having been seen.
 * What the CMS itself commits along with an entry is allowed: the entry’s own files, and those of
 * its published version, which a rename removes; assets, which go with the entry and are listed as
 * its unpublished assets, and are only removed when the entry is moved or deleted, except for any
 * file in an `admin` or `cms` folder, where the CMS itself is served from; when the entry
 * is renamed or deleted, the entries referencing it, which are rewritten; and, in a nested
 * collection with subfolders, the entries below the folder of an entry being moved, which move
 * along with it. A Relation field doesn’t offer to add an entry while an entry is saved through
 * Editorial Workflow, so no other new entry is expected.
 * @param {UnpublishedEntry} entry Unpublished entry being published.
 * @param {WorkflowChangedFile[]} files Files the pull request changes.
 * @returns {string[]} Paths of the files that aren’t accounted for.
 */
export const findUnexpectedChanges = (entry, files) => {
  const { collectionName } = entry.workflow;
  const collection = getCollection(collectionName);
  const updatedEntry = getUpdatedEntry(entry);
  const deletion = entry.workflow.status === 'pending_deletion';
  const currentPaths = getEntryPaths(entry);
  const updatedPaths = updatedEntry ? getEntryPaths(updatedEntry) : [];
  const ownPaths = new Set([...currentPaths, ...updatedPaths]);
  // Whether the pull request moves the entry: a rename, or a move to another folder of a nested
  // collection, which takes the entries below it and the assets beside it along. Its location is
  // compared rather than its files, as dropping a locale’s file leaves the entry where it is
  const moved = !deletion && !!updatedEntry && updatedEntry.subPath !== entry.subPath;

  const descendantPaths = new Set(
    moved ? getDescendantPaths(collection, /** @type {Entry} */ (updatedEntry)) : [],
  );

  const descendantFolders = moved ? getDescendantFolders(collection, entry) : [];

  const referencingPaths = new Set(
    getReferencingPaths({ entry, collection, updatedEntry, deletion }),
  );

  /**
   * Check whether the given change is one the CMS makes along with the entry.
   * @param {PathChange} pathChange Path change.
   * @returns {boolean} Result.
   */
  const isExpected = ({ path, change, mode }) => {
    // A file that’s still there after the merge has to be a regular one, whatever its path
    if (change !== 'removed' && !REGULAR_FILE_MODES.includes(/** @type {string} */ (mode))) {
      return false;
    }

    if (ownPaths.has(path)) {
      return true;
    }

    const kind = classifyPath(path);

    if (!kind) {
      return false;
    }

    // An asset is only removed along with the entry it sits beside, or moved away with it. Nothing
    // in the folder the CMS is served from is an asset of an entry, whatever the change
    if (kind.type === 'asset') {
      return !isInCmsFolder(path) && (change !== 'removed' || deletion || moved);
    }

    const sameCollection = kind.collectionName === collectionName;

    if (change === 'removed') {
      return sameCollection && descendantPaths.has(path);
    }

    if (change === 'added') {
      return sameCollection && descendantFolders.some((folder) => path.startsWith(folder));
    }

    return referencingPaths.has(path) || (sameCollection && descendantPaths.has(path));
  };

  return [
    ...new Set(
      getPathChanges(files)
        .filter((pathChange) => !isExpected(pathChange))
        .map(({ path }) => path),
    ),
  ];
};

/**
 * Create the error thrown when publishing is refused.
 * @param {PublishRefusal} refusal Refusal.
 * @returns {Error} Error.
 */
const createRefusal = (refusal) => new Error(PUBLISH_REFUSED, { cause: refusal });

/**
 * Check that the given pull request can be merged as the entry the CMS has shown. It has to go to
 * the configured branch from a branch of the configured repository, its branch has to point at the
 * commit the entry was loaded or saved at, and every file it changes has to be accounted for by
 * {@link findUnexpectedChanges}, or be left as it is by the merge: a file the pull request has the
 * same as the configured branch already does publishes nothing. That’s the case of the reference
 * rewrite every pull request of a selection deleted at once carries, once the first of them has
 * been published.
 * @param {UnpublishedEntry} entry Unpublished entry being published.
 * @param {WorkflowMergeState} state Pull request state read right before the merge.
 * @param {WorkflowBackendService['fetchUnchangedPaths']} fetchUnchangedPaths Function to find the
 * files that are the same at the head commit as on the configured branch.
 * @throws {Error} A {@link PUBLISH_REFUSED} error when the pull request can’t be merged.
 */
export const verifyMergeState = async (entry, state, fetchUnchangedPaths) => {
  const { headSHA } = entry.workflow.pullRequest;

  if (!state.onConfiguredBranches || !state.complete) {
    throw createRefusal({ reason: 'other_changes', paths: [] });
  }

  if (!headSHA || state.headSHA !== headSHA) {
    throw createRefusal({ reason: 'entry_changed', paths: [] });
  }

  const unexpected = findUnexpectedChanges(entry, state.files);

  if (!unexpected.length) {
    return;
  }

  const unchanged = new Set(await fetchUnchangedPaths({ headSHA, paths: unexpected }));
  const paths = unexpected.filter((path) => !unchanged.has(path));

  if (paths.length) {
    throw createRefusal({ reason: 'other_changes', paths });
  }
};

/**
 * Get the message to show when an Editorial Workflow action has failed. A refused publish says what
 * the pull request holds, and a localized error from the backend what stands in the way, e.g.
 * another request open from the workflow branch, neither of which trying again would change. See
 * {@link getErrorMessage}.
 * @param {any} ex Error thrown by the action.
 * @param {string} fallback I18n key of the message for any other failure.
 * @returns {string} Localized message.
 */
export const getWorkflowErrorMessage = (ex, fallback) => {
  if (ex?.message !== PUBLISH_REFUSED) {
    return getErrorMessage(ex, fallback);
  }

  return _(
    /** @type {PublishRefusal} */ (ex.cause).reason === 'entry_changed'
      ? 'workflow.publish_refused_entry_changed'
      : 'workflow.publish_refused_other_changes',
  );
};
