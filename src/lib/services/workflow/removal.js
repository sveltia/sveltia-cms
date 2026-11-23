import { unique } from '@sveltia/utils/array';
import { generateUUID } from '@sveltia/utils/crypto';

import { getAdditions } from '$lib/services/app/additions';
import { promptCommitMessage } from '$lib/services/backends/commit-prompt';
import { createCommitMessage } from '$lib/services/backends/git/shared/commits';
import { runConcurrently } from '$lib/services/backends/git/shared/concurrency';
import { createLocalizedError } from '$lib/services/backends/git/shared/errors';
import { toFileListItem } from '$lib/services/backends/git/shared/tree';
import { createFileList } from '$lib/services/backends/process';
import { toRepoChanges } from '$lib/services/backends/root-dir';
import { getEntriesByCollection } from '$lib/services/contents/collection/entries';
import { resolveCacheDB } from '$lib/services/contents/draft/save/file-changes';
import { getEntryKey } from '$lib/services/contents/entry/entry-key';
import { getEntryPaths } from '$lib/services/contents/entry/paths';
import {
  buildCascadeDeleteChanges,
  planCascadeDeleteOrThrow,
} from '$lib/services/contents/entry/relations/cascade/delete';
import { getEditedCompanionPaths } from '$lib/services/workflow';
import { removeWorkflowAssets } from '$lib/services/workflow/assets';
import { isForkEntry } from '$lib/services/workflow/forks';
import { openAuthoring } from '$lib/services/workflow/open-authoring';
import {
  applyCommitToFiles,
  clearUnpublishedEntry,
  getFileRevertChange,
  getPreviousPaths,
  getWorkflowService,
  resolveWorkflowBranch,
  storeUnpublishedEntry,
} from '$lib/services/workflow/save';

/**
 * @import {
 * Asset,
 * CascadeTarget,
 * Entry,
 * FileChange,
 * InternalCollection,
 * InternalCollectionFile,
 * RepositoryFileInfo,
 * UnpublishedEntry,
 * WorkflowPullRequest,
 * } from '$lib/types/private';
 */

/**
 * Discard the given unpublished entry by closing the corresponding pull request without merging it.
 * @param {UnpublishedEntry} entry Unpublished entry.
 * @returns {Promise<void>}
 */
export const discardWorkflowEntry = async (entry) => {
  const workflow = getWorkflowService();
  const { pullRequest } = entry.workflow;

  await workflow.discard(pullRequest);
  clearUnpublishedEntry(pullRequest, removeWorkflowAssets);

  const { collectionName } = entry.workflow;
  const key = getEntryKey(collectionName, entry.subPath);
  // Paths of the files the pull request renamed, if it renames a published entry
  const previousPaths = new Set(pullRequest.files.map(({ previousPath }) => previousPath));

  const publishedEntry = getEntriesByCollection(collectionName).find(
    ({ subPath, locales }) =>
      subPath === entry.subPath ||
      Object.values(locales).some(({ path }) => previousPaths.has(path)),
  );

  if (!publishedEntry) {
    // A draft that was never published takes its comments along
    getAdditions()?.deleteEntryComments(key);
  } else if (publishedEntry.subPath !== entry.subPath) {
    // The comments moved with the rename when the draft was saved; give them back
    getAdditions()?.moveEntryConversation(key, getEntryKey(collectionName, publishedEntry.subPath));
  }
};

/**
 * Get the changes that stand for the deletion of an entry in the commit message prompt and the
 * pull request title: a single change naming the entry’s first file.
 * @param {Entry} entry Entry to be deleted.
 * @returns {FileChange[]} Changes.
 */
const getDeletionTitleChanges = (entry) => [
  { action: 'delete', slug: entry.slug, path: getEntryPaths(entry)[0] },
];

/**
 * Get the changes that put the existing entries a pull request has changed along with its entry
 * back the way they are on the configured branch, which is where the pull request will land, so
 * publishing it leaves them alone. Only the files the pull request changes are written: those it
 * has added are removed, and the others get the text the configured branch has.
 * @param {UnpublishedEntry} unpublishedEntry Unpublished entry whose pull request is reused.
 * @param {string} slug Slug of the entry, for the commit message.
 * @returns {Promise<FileChange[]>} Changes.
 * @throws {Error} When the text of a file on the configured branch isn’t known.
 */
const getEditedCompanionRevertChanges = async (unpublishedEntry, slug) => {
  const { companions = [], pullRequest } = unpublishedEntry.workflow;
  const changedPaths = new Set(pullRequest.files.map(({ path }) => path));
  const { paths, publishedPaths } = getEditedCompanionPaths(companions);
  const cacheDB = resolveCacheDB();

  return Promise.all(
    unique([...paths, ...publishedPaths])
      .filter((path) => changedPaths.has(path))
      .map(async (path) => {
        if (!publishedPaths.has(path)) {
          return /** @type {FileChange} */ ({ action: 'delete', slug, path });
        }

        const text = /** @type {RepositoryFileInfo | undefined} */ (await cacheDB?.get(path))?.text;

        if (text === undefined) {
          throw new Error(`The published version of ${path} could not be found.`);
        }

        // A file the pull request deletes, e.g. that of a locale turned off, is created again
        return /** @type {FileChange} */ ({
          action: paths.includes(path) ? 'update' : 'create',
          slug,
          path,
          data: text,
        });
      }),
  );
};

/**
 * Get the changes that put back the rest of the files a reused pull request changes, other than
 * those the deletion of its entry handles itself, so publishing the removal leaves them as they are
 * on the configured branch: an asset uploaded for the entry, or the entries a rename rewrote or
 * moved along with it. See {@link getFileRevertChange}. Only the entry and asset files the CMS
 * commits are touched: a change made outside the CMS is left for the publish check to refuse, as
 * nothing tells whether the file is new or what it held.
 * @param {object} args Arguments.
 * @param {UnpublishedEntry} args.unpublishedEntry Unpublished entry whose pull request is reused.
 * @param {string} args.slug Slug of the entry, for the commit message.
 * @param {Set<string>} args.handledPaths Paths the deletion takes care of otherwise.
 * @returns {Promise<FileChange[]>} Changes.
 * @throws {Error} When the content of a file on the configured branch isn’t known.
 */
const getOtherFileRevertChanges = async ({ unpublishedEntry, slug, handledPaths }) => {
  const files = unpublishedEntry.workflow.pullRequest.files.filter(
    ({ path }) => !handledPaths.has(path),
  );

  if (!files.length) {
    return [];
  }

  const { entryFiles, assetFiles } = createFileList(files.map(({ path }) => toFileListItem(path)));
  const knownPaths = new Set([...entryFiles, ...assetFiles].map(({ path }) => path));
  const cacheDB = resolveCacheDB();

  return Promise.all(
    files
      .filter(({ path }) => knownPaths.has(path))
      .map((file) => getFileRevertChange(file, slug, cacheDB)),
  );
};

/**
 * Delete the given published entry through Editorial Workflow: instead of committing the removal
 * straight to the configured branch, open a pull request that removes it, so taking an entry off
 * the site is reviewed and released like any other change. The entry stays on the site until that
 * pull request is published. The entries referencing it through Relation fields are rewritten in
 * the same pull request, so that no reference is left dangling once the removal lands.
 * @param {Entry} entry Entry to be deleted.
 * @param {InternalCollection} collection Collection the entry belongs to.
 * @param {InternalCollectionFile} [collectionFile] Collection file, if the entry is one.
 * @param {Asset[]} [assets] Assets stored alongside the entry, which are removed with it. Only
 * applies to a collection with an entry-relative asset folder.
 * @param {object} [options] Options.
 * @param {CascadeTarget[]} [options.targets] Referencing entries to rewrite, already worked out
 * by {@link deleteWorkflowEntries} for a whole selection. Worked out for the entry alone if
 * omitted.
 * @param {string} [options.userMessage] Commit message the user has entered, already asked for by
 * {@link deleteWorkflowEntries} for a whole selection. Asked for if omitted and configured.
 * @param {string} [options.deletionGroup] ID of the selection the entry is deleted with, recorded
 * in the pull request so publishing can tell which references it removes. Omitted for an entry
 * deleted on its own.
 * @returns {Promise<UnpublishedEntry>} Entry with the pull request attached.
 * @throws {Error} When the user has cancelled the commit when asked for a commit message.
 * @throws {Error} When removing the references would leave another entry invalid. The dialogs
 * report this before the deletion is confirmed, so this is only a safeguard.
 * @throws {Error} When the entry comes from a contributor’s pull request.
 * @see https://github.com/sveltia/sveltia-cms/issues/770
 */
export const deleteWorkflowEntry = async (
  entry,
  collection,
  collectionFile,
  assets = [],
  { targets = undefined, userMessage = undefined, deletionGroup = undefined } = {},
) => {
  // Taking a published entry off the site is a maintainer’s call. A contributor can discard their
  // own draft, which leaves the published version alone, but not propose a removal
  if (openAuthoring.current) {
    throw createLocalizedError(
      'Cannot delete a published entry as an Open Authoring contributor',
      'open_authoring.direct_commit_unsupported',
    );
  }

  targets ??= planCascadeDeleteOrThrow(
    { collection, collectionFile, entries: [entry] },
    'Cannot delete an entry that other entries require',
  );

  const workflow = getWorkflowService();
  const collectionName = collection.name;
  const { slug } = entry;
  const { existingEntry, branch } = resolveWorkflowBranch({ collectionName, slug, entry });

  // A contributor’s pull request is theirs: a maintainer can close it, but not turn it into the
  // removal of the published entry. The editor doesn’t offer it, so this is only a safeguard
  if (isForkEntry(existingEntry)) {
    throw new Error('Cannot delete an entry through a pull request from a fork');
  }

  // Remove the files as they stand on the branch. A pull request that renamed the entry has already
  // staged the deletion of the old paths there, so removing the new ones leaves nothing behind once
  // the merge lands
  const paths = getEntryPaths(entry);
  const titleChanges = getDeletionTitleChanges(entry);

  const options = await promptCommitMessage(titleChanges, {
    commitType: 'delete',
    collection,
    userMessage,
  });

  // An entry-relative asset lives with the entry, so it goes in the same pull request rather than
  // being left behind once the removal lands
  const assetPaths = unique(assets.map(({ path }) => path));

  // A reused pull request may hold new entries created from a Relation field of the entry, which
  // would otherwise be published along with the removal. They have never been published, so taking
  // them off the branch is all it takes. The existing entries edited along with it are put back
  const companionPaths = (existingEntry?.workflow.companions ?? []).flatMap(
    ({ entry: e, edited }) => (edited ? [] : getEntryPaths(e)),
  );

  const companionRevertChanges = existingEntry
    ? await getEditedCompanionRevertChanges(existingEntry, slug)
    : [];

  // The references are removed from the published entries as they stand on the configured branch,
  // which is where the pull request will land
  const { changes: cascadeChanges } = await buildCascadeDeleteChanges({ targets });
  const previousPaths = getPreviousPaths(existingEntry, paths);

  // Anything else the reused pull request holds would be published along with the removal, which
  // the publish check refuses, so it’s put back as well. The paths the entry has on the configured
  // branch, which a rename has already removed, stay removed
  const otherRevertChanges = existingEntry
    ? await getOtherFileRevertChanges({
        unpublishedEntry: existingEntry,
        slug,
        handledPaths: new Set([
          ...paths,
          ...previousPaths,
          ...assetPaths,
          ...companionPaths,
          ...[...companionRevertChanges, ...cascadeChanges].map(({ path }) => path),
        ]),
      })
    : [];

  // Reuse any open pull request rather than discarding it first: closing it up front would throw
  // the pending changes away with no way back if opening the replacement then failed
  /** @type {FileChange[]} */
  const changes = [
    ...[...paths, ...assetPaths, ...companionPaths].map(
      (path) => /** @type {FileChange} */ ({ action: 'delete', slug, path }),
    ),
    // A file the references are removed from is written from the configured branch anyway
    ...companionRevertChanges.filter(({ path }) => !cascadeChanges.some((c) => c.path === path)),
    ...otherRevertChanges,
    ...cascadeChanges,
  ];

  const { commit, pullRequest } = await workflow.savePullRequest({
    changes,
    options,
    branch,
    title: createCommitMessage(toRepoChanges(titleChanges), options),
    // The removal is complete as committed, so it skips the review stages entirely. Opening it at
    // this status avoids the churn of creating a draft and relabelling it a moment later
    status: 'pending_deletion',
    pullRequest: existingEntry?.workflow.pullRequest,
    deletionGroup,
  });

  // A reused pull request carries the files and the head commit from before this one, which
  // publishing compares with the branch
  const files = applyCommitToFiles(pullRequest.files, changes, commit);

  // Every asset the reused pull request committed is now off its branch, or back as published
  if (existingEntry) {
    removeWorkflowAssets(branch);
  }

  /**
   * Store the entry with the given pull request, pointed at the new commit.
   * @param {WorkflowPullRequest} pr Pull request.
   * @returns {UnpublishedEntry} Unpublished entry.
   */
  const store = (pr) =>
    storeUnpublishedEntry(entry, {
      pullRequest: { ...pr, headSHA: commit.sha, files },
      collectionName,
      fileName: collectionFile?.name,
      // Where the entry lives on the configured branch, which a rename has already moved away from
      previousPaths,
      companions: [],
    });

  if (pullRequest.status === 'pending_deletion') {
    return store(pullRequest);
  }

  // A reused pull request keeps the status it already had, so it still needs the switch. The
  // commit has landed by now, so the entry is stored first with the status it has: if the switch
  // then fails, the entry still follows the branch rather than its previous head commit, which
  // would hold up publishing and saving until the next reload
  store(pullRequest);

  return store(await workflow.updateStatus(pullRequest, 'pending_deletion'));
};

/**
 * Discard the given unpublished entries. Used when multiple entries are deleted at once from the
 * entry list. Each entry takes a couple of requests — closing the pull request and deleting the
 * branch — so the batch is throttled like any other, rather than firing them all at once.
 * @param {UnpublishedEntry[]} entries Unpublished entries.
 * @returns {Promise<void>}
 */
export const discardWorkflowEntries = async (entries) => {
  await runConcurrently(entries, discardWorkflowEntry);
};

/**
 * Delete the given published entries through Editorial Workflow. A branch is named after the entry
 * it holds, so a selection can’t share one pull request: each entry gets its own, and the requests
 * are throttled like any other batch.
 *
 * The entries referencing the selection are another matter. An entry referencing two of the
 * selected entries can’t be rewritten one reference at a time, one pull request each: the second
 * pull request to be published would conflict with the first, as both change the same lines of the
 * same file, and there’s no way to resolve that from the CMS. So the references to the whole
 * selection are worked out once, and every pull request carries the same rewrite; identical changes
 * merge cleanly whichever is published first. The trade-off is that the selection is taken as a
 * whole: if one of the pull requests is then cancelled, the others still remove the references to
 * that entry when they’re published. Each pull request records the selection it belongs to, so
 * publishing it works out the same rewrite, rather than taking in the entries of the collection
 * deleted one at a time, whose pull requests rewrite only the references to their own entry.
 * @param {{ entry: Entry, collection: InternalCollection,
 * collectionFile?: InternalCollectionFile, assets?: Asset[] }[]} items Entries to be deleted, with
 * the context each one needs.
 * @throws {Error} When removing the references would leave another entry invalid. The dialog
 * reports this before the deletion is confirmed, so this is only a safeguard.
 */
export const deleteWorkflowEntries = async (items) => {
  /**
   * Get the key of the group the given item belongs to: its collection and collection file.
   * @param {(typeof items)[number]} item Item.
   * @returns {string} Group key.
   */
  const getKey = ({ collection, collectionFile }) =>
    `${collection.name}\0${collectionFile?.name ?? ''}`;

  // A selection comes from one entry list, so it’s normally a single group
  const groups = Map.groupBy(items, getKey);
  /** @type {Map<string, { targets: CascadeTarget[], deletionGroup?: string }>} */
  const planMap = new Map();

  groups.forEach((group, key) => {
    const [{ collection, collectionFile }] = group;

    planMap.set(key, {
      targets: planCascadeDeleteOrThrow(
        { collection, collectionFile, entries: group.map(({ entry }) => entry) },
        'Cannot delete entries that other entries require',
      ),
      // An entry deleted alone in its group is planned on its own, which needs no record
      deletionGroup: group.length > 1 ? generateUUID() : undefined,
    });
  });

  // Ask for a commit message once for the whole selection rather than for each pull request. Each
  // pull request is titled after its own entry, so the first one stands for the rest
  const [{ entry: firstEntry, collection: firstCollection }] = items;

  const { userMessage } = await promptCommitMessage(getDeletionTitleChanges(firstEntry), {
    commitType: 'delete',
    collection: firstCollection,
  });

  await runConcurrently(items, async (item) => {
    const { entry, collection, collectionFile, assets } = item;

    await deleteWorkflowEntry(entry, collection, collectionFile, assets, {
      ...planMap.get(getKey(item)),
      // A string, even an empty one, tells the user has been asked already
      userMessage,
    });
  });
};
