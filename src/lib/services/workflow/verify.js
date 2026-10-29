import { _ } from '@sveltia/i18n';

import { getAssetFolder } from '$lib/services/assets/folders';
import { findEntriesByAssets } from '$lib/services/assets/references';
import { isInCmsFolder } from '$lib/services/assets/reserved';
import { allAssets } from '$lib/services/assets/state';
import { getErrorMessage } from '$lib/services/backends/git/shared/errors';
import { toFileListItem } from '$lib/services/backends/git/shared/tree';
import { createFileList } from '$lib/services/backends/process';
import { findEntryByPaths } from '$lib/services/contents';
import { getCollection } from '$lib/services/contents/collection';
import { getCollectionFile } from '$lib/services/contents/collection/files';
import { buildNestedMoveChanges } from '$lib/services/contents/collection/nested/move';
import { getMovedFolders } from '$lib/services/contents/draft/save/asset-move';
import { getEntryRelativeAssets } from '$lib/services/contents/entry/assets';
import { buildTargetChanges } from '$lib/services/contents/entry/cascade';
import { getEntryPaths } from '$lib/services/contents/entry/paths';
import { planCascadeDelete } from '$lib/services/contents/entry/relations/cascade/delete';
import { collectRenameTargets } from '$lib/services/contents/entry/relations/cascade/update';
import { unpublishedEntries } from '$lib/services/workflow';
import { getEntryAssetVersion } from '$lib/services/workflow/assets';

/**
 * @import {
 * Asset,
 * CascadeTarget,
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
  const { entryFiles, assetFiles } = createFileList([toFileListItem(path)]);

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
 * Get the entries whose references to the given entry the CMS rewrites along with it: those
 * referencing its published version when it’s renamed, or when it’s deleted. A selection of entries
 * is deleted with the same rewrite in each pull request, so the references to the other entries of
 * the collection awaiting deletion count as well. The entries are worked out from the published
 * ones, the way the CMS did when it committed the rewrite.
 * @param {object} args Arguments.
 * @param {UnpublishedEntry} args.entry Unpublished entry being published.
 * @param {InternalCollection} args.collection Collection the entry belongs to.
 * @param {Entry | undefined} args.updatedEntry Published version of the entry.
 * @param {boolean} args.deletion Whether the entry is being deleted.
 * @returns {CascadeTarget[]} Referencing entries, with their references rewritten.
 */
const getReferencingTargets = ({ entry, collection, updatedEntry, deletion }) => {
  const { collectionName, fileName } = entry.workflow;
  const collectionFile = fileName ? getCollectionFile(collection, fileName) : undefined;

  return deletion
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
};

/**
 * Get the other entries’ files the CMS writes along with the given entry: those of the entries
 * whose references to it a rename or a deletion rewrites, and, in a nested collection with
 * subfolders, those of the entries below the folder of an entry being moved, which move along with
 * it. They’re worked out from the published entries with the same functions the CMS committed them
 * with, so the pull request has to hold them exactly as written: the board doesn’t show them, and
 * checking their paths alone would let any change to such an entry through.
 * @param {object} args Arguments.
 * @param {UnpublishedEntry} args.entry Unpublished entry being published.
 * @param {InternalCollection | undefined} args.collection Collection the entry belongs to.
 * @param {Entry | undefined} args.updatedEntry Published version of the entry.
 * @param {boolean} args.deletion Whether the entry is being deleted.
 * @param {boolean} args.moved Whether the entry is being moved.
 * @returns {Promise<Map<string, string | null>>} Text of each file written, keyed by path, or
 * `null` for a file moved away.
 */
const getExpectedRewrites = async ({ entry, collection, updatedEntry, deletion, moved }) => {
  /** @type {Map<string, string | null>} */
  const rewrites = new Map();

  if (!collection) {
    return rewrites;
  }

  const [{ changes: cascadeChanges }, { changes: moveChanges }] = await Promise.all([
    buildTargetChanges({
      targets: getReferencingTargets({ entry, collection, updatedEntry, deletion }),
    }),
    moved
      ? buildNestedMoveChanges({ collection, originalEntry: updatedEntry, savingEntry: entry })
      : { changes: [] },
  ]);

  // In the order the save commits them, so a file written twice is left the way the last write
  // leaves it
  [...cascadeChanges, ...moveChanges].forEach(({ path, previousPath, data }) => {
    if (previousPath) {
      rewrites.set(previousPath, null);
    }

    rewrites.set(path, /** @type {string} */ (data));
  });

  return rewrites;
};

/**
 * Get the assets the CMS moves along with the given entry, in a collection storing them with the
 * entries: everything below a folder the entry occupies by itself goes to the folder it occupies
 * now, as is.
 * @param {object} args Arguments.
 * @param {UnpublishedEntry} args.entry Unpublished entry being published.
 * @param {InternalCollection | undefined} args.collection Collection the entry belongs to.
 * @param {Entry} args.updatedEntry Published version of the entry.
 * @returns {{ removedPaths: Set<string>, addedSHAs: Map<string, string> }} Paths the assets are
 * moved from, and the Git object ID of each asset keyed by the path it’s moved to.
 */
const getMovedAssets = ({ entry, collection, updatedEntry }) => {
  const { fileName } = entry.workflow;
  const removedPaths = new Set();
  /** @type {Map<string, string>} */
  const addedSHAs = new Map();

  if (
    !collection ||
    !getAssetFolder({ collectionName: collection.name, fileName })?.entryRelative
  ) {
    return { removedPaths, addedSHAs };
  }

  const movedFolders = getMovedFolders({
    collection,
    originalEntry: updatedEntry,
    savingEntry: entry,
  });

  // Only the versions of the assets the published entry has, like the save moves
  const assets = /** @type {Asset[]} */ (
    allAssets.current.map((asset) => getEntryAssetVersion(asset, updatedEntry)).filter(Boolean)
  );

  movedFolders.forEach((newFolderPath, oldFolderPath) => {
    assets
      .filter(({ path }) => path.startsWith(`${oldFolderPath}/`))
      .forEach(({ path, sha }) => {
        removedPaths.add(path);
        addedSHAs.set(`${newFolderPath}${path.slice(oldFolderPath.length)}`, sha);
      });
  });

  return { removedPaths, addedSHAs };
};

/**
 * Get those of the given asset paths that the given entry uses, in a media field or as a media URL
 * in a Markdown or RichText field, the way the editor resolves them to display the files. So do the
 * new entries created from a Relation field of the entry, which are committed along with it.
 * @param {UnpublishedEntry} entry Unpublished entry being published.
 * @param {string[]} paths Asset paths.
 * @returns {Set<string>} Paths used.
 */
const getUsedAssetPaths = (entry, paths) => {
  if (!paths.length) {
    return new Set();
  }

  const results = findEntriesByAssets(
    paths.map((path) => ({ asset: /** @type {Asset} */ ({ path }) })),
    {
      entries: [
        entry,
        ...(entry.workflow.companions ?? []).map(({ entry: companion }) => companion),
      ],
    },
  );

  return new Set(paths.filter((_path, index) => results[index].length));
};

/**
 * Find the changes in a pull request that the CMS doesn’t account for. The board shows an entry
 * and its assets, but publishing merges the whole pull request, so anything else on the branch —
 * code, workflows, configuration, another entry, a file in a media folder — would otherwise go
 * live without having been seen. What the CMS itself commits along with an entry is allowed: the
 * entry’s own files, and those of its published version, which a rename removes; the assets the
 * entry uses, which the editor shows, except for any file in an `admin` or `cms` folder, where the
 * CMS itself is served from; in a collection storing assets with the entries, those of the
 * published entry, which are removed when it’s deleted, or moved as they are when it’s moved; the
 * files of the other entries the CMS rewrites along with it, exactly as it writes them (see
 * {@link getExpectedRewrites}); and the new entries of other collections created from a Relation
 * field of the entry, which the board lists on the entry’s card. Those have to be new on the
 * configured branch as well: one that has appeared there since would be overwritten.
 *
 * The content of the files is that of the pull request as loaded, which is that of the commit the
 * merge is pinned to: see {@link verifyMergeState}.
 * @param {UnpublishedEntry} entry Unpublished entry being published.
 * @param {WorkflowChangedFile[]} files Files the pull request changes.
 * @returns {Promise<string[]>} Paths of the files that aren’t accounted for.
 */
export const findUnexpectedChanges = async (entry, files) => {
  const { collectionName, fileName, pullRequest } = entry.workflow;
  const collection = getCollection(collectionName);
  const updatedEntry = getUpdatedEntry(entry);
  const deletion = entry.workflow.status === 'pending_deletion';
  const currentPaths = getEntryPaths(entry);
  const updatedPaths = updatedEntry ? getEntryPaths(updatedEntry) : [];
  const ownPaths = new Set([...currentPaths, ...updatedPaths]);
  const branchFiles = new Map(pullRequest.files.map((file) => [file.path, file]));

  const companionPaths = new Set(
    (entry.workflow.companions ?? []).flatMap(({ entry: companion }) => getEntryPaths(companion)),
  );

  // Whether the pull request moves the entry: a rename, or a move to another folder of a nested
  // collection, which takes the entries below it and the assets beside it along. Its location is
  // compared rather than its files, as dropping a locale’s file leaves the entry where it is
  const moved = !deletion && !!updatedEntry && updatedEntry.subPath !== entry.subPath;
  const rewrites = await getExpectedRewrites({ entry, collection, updatedEntry, deletion, moved });

  const { removedPaths: movedAssetPaths, addedSHAs: movedAssetSHAs } = moved
    ? getMovedAssets({ entry, collection, updatedEntry: /** @type {Entry} */ (updatedEntry) })
    : { removedPaths: new Set(), addedSHAs: new Map() };

  const deletedAssetPaths = new Set(
    deletion && updatedEntry
      ? getEntryRelativeAssets({ entry: updatedEntry, collectionName, fileName }).map(
          ({ path }) => path,
        )
      : [],
  );

  const pathChanges = getPathChanges(files).map((pathChange) => ({
    ...pathChange,
    kind: classifyPath(pathChange.path),
  }));

  // A removal adds nothing, so it has no asset of its own to bring in
  const usedAssetPaths = deletion
    ? new Set()
    : getUsedAssetPaths(
        entry,
        pathChanges
          .filter(({ change, kind }) => change !== 'removed' && kind?.type === 'asset')
          .map(({ path }) => path),
      );

  /**
   * Check whether the given change is one the CMS makes along with the entry.
   * @param {PathChange & { kind: ReturnType<typeof classifyPath> }} pathChange Path change.
   * @returns {boolean} Result.
   */
  const isExpected = ({ path, change, mode, kind }) => {
    // A file that’s still there after the merge has to be a regular one, whatever its path
    if (change !== 'removed' && !REGULAR_FILE_MODES.includes(/** @type {string} */ (mode))) {
      return false;
    }

    if (ownPaths.has(path)) {
      return true;
    }

    if (companionPaths.has(path)) {
      return change === 'added';
    }

    if (!kind) {
      return false;
    }

    // Nothing in the folder the CMS is served from is an asset of an entry, whatever the change
    if (kind.type === 'asset') {
      if (isInCmsFolder(path)) {
        return false;
      }

      if (change === 'removed') {
        return deletedAssetPaths.has(path) || movedAssetPaths.has(path);
      }

      const sha = movedAssetSHAs.get(path);

      return usedAssetPaths.has(path) || (sha !== undefined && branchFiles.get(path)?.sha === sha);
    }

    if (!rewrites.has(path)) {
      return false;
    }

    const text = rewrites.get(path);

    return change === 'removed'
      ? text === null
      : typeof text === 'string' && branchFiles.get(path)?.text === text;
  };

  return [
    ...new Set(pathChanges.filter((pathChange) => !isExpected(pathChange)).map(({ path }) => path)),
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

  const unexpected = await findUnexpectedChanges(entry, state.files);

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
 * Check that the given entry is the version of it the user has reviewed. The pull requests are read
 * again from time to time, so the entry in the store can carry a commit pushed since the editor or
 * the confirmation dialog was opened; merging that one would take content along that nobody has
 * seen. Nor can the files read at that commit vouch for the reviewed one, should the branch go back
 * to it: {@link verifyMergeState} compares the pull request with them. So the publish is refused,
 * and the user is asked to review the latest version first.
 * @param {UnpublishedEntry} entry Entry from the store.
 * @param {string | undefined} headSHA Head commit the user has reviewed. `undefined` if the user
 * hasn’t seen any version of the pull request, e.g. when the editor was opened before it existed,
 * which has the publish refused as well.
 * @throws {Error} A {@link PUBLISH_REFUSED} error when the entry is another version.
 */
export const checkReviewedHead = (entry, headSHA) => {
  if (entry.workflow.pullRequest.headSHA !== headSHA) {
    throw createRefusal({ reason: 'entry_changed', paths: [] });
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
