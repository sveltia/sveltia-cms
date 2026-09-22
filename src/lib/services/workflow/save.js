import { _ } from '@sveltia/i18n';
import { unique } from '@sveltia/utils/array';

import { callEventHooks } from '$lib/services/api/events';
import { backend } from '$lib/services/backends';
import { createCommitMessage } from '$lib/services/backends/git/shared/commits';
import { runConcurrently } from '$lib/services/backends/git/shared/concurrency';
import { getCommitAuthor } from '$lib/services/backends/save';
import { allEntries } from '$lib/services/contents';
import { getCollection } from '$lib/services/contents/collection';
import { getCollectionFile } from '$lib/services/contents/collection/files';
import {
  buildCascadeDeleteChanges,
  planCascadeDelete,
} from '$lib/services/contents/entry/relations/cascade/delete';
import { forgetDeployments } from '$lib/services/deployments';
import { refreshProductionSHA } from '$lib/services/deployments/resolve';
import { getOrCreate } from '$lib/services/utils/cache';
import {
  getUnpublishedEntryByBranch,
  getUnpublishedEntryBySlug,
  publishingBranches,
  unpublishedEntries,
} from '$lib/services/workflow';
import {
  mergeWorkflowAssets,
  publishWorkflowAssets,
  removeWorkflowAssets,
} from '$lib/services/workflow/assets';
import { getBranchName } from '$lib/services/workflow/branch';
import { trackDeployingEntry } from '$lib/services/workflow/deploy';
import { openAuthoring } from '$lib/services/workflow/open-authoring';

/**
 * @import {
 * Asset,
 * CascadeTarget,
 * ChangeResults,
 * Entry,
 * FileChange,
 * CommitOptions,
 * InternalCollection,
 * InternalCollectionFile,
 * UnpublishedEntry,
 * WorkflowBackendService,
 * WorkflowPullRequest,
 * WorkflowStatus,
 * } from '$lib/types/private';
 */

/**
 * Get the backend’s Editorial Workflow implementation.
 * @returns {WorkflowBackendService} Implementation.
 * @throws {Error} When the current backend doesn’t support Editorial Workflow.
 */
const getWorkflowService = () => {
  const workflow = backend.current?.workflow;

  if (!workflow) {
    throw new Error('Editorial Workflow is not supported by the current backend');
  }

  return workflow;
};

/**
 * Resolve the arguments the event hooks need for the given unpublished entry.
 * @param {UnpublishedEntry} entry Unpublished entry.
 * @returns {{ entry: UnpublishedEntry, collection: InternalCollection,
 * collectionFile: InternalCollectionFile | undefined } | undefined} Arguments, or `undefined` if
 * the collection is no longer configured, in which case no hook can be called.
 */
const getEventHookArgs = (entry) => {
  const { collectionName, fileName } = entry.workflow;
  const collection = getCollection(collectionName);

  if (!collection) {
    return undefined;
  }

  return {
    entry,
    collection,
    collectionFile: fileName ? getCollectionFile(collection, fileName) : undefined,
  };
};

/**
 * Replace or append the given unpublished entry in the {@link unpublishedEntries} store, keyed by
 * the workflow branch name. An existing entry is replaced in place, so a status change doesn’t make
 * the entry jump to the end of the list on the Editorial Workflow page.
 * @param {UnpublishedEntry} entry Unpublished entry.
 */
export const upsertUnpublishedEntry = (entry) => {
  const { branch } = entry.workflow.pullRequest;
  const entries = unpublishedEntries.current;
  const index = entries.findIndex((e) => e.workflow.pullRequest.branch === branch);

  unpublishedEntries.current = index === -1 ? [...entries, entry] : entries.with(index, entry);
};

/**
 * Remove the unpublished entry associated with the given workflow branch from the store.
 * @param {string} branch Branch name.
 */
export const removeUnpublishedEntry = (branch) => {
  unpublishedEntries.current = unpublishedEntries.current.filter(
    (e) => e.workflow.pullRequest.branch !== branch,
  );
};

/**
 * Save the given entry changes as a pull request instead of committing them directly to the
 * configured branch. The pull request and the workflow branch are created on the first save, and
 * updated on subsequent saves.
 * @param {object} args Arguments.
 * @param {FileChange[]} args.changes Changes to be committed.
 * @param {Entry} args.savingEntry Entry being saved.
 * @param {Asset[]} [args.savingAssets] Assets to be saved along with the entry.
 * @param {CommitOptions} args.options Commit options.
 * @param {string} args.collectionName Collection name.
 * @param {string} [args.fileName] Collection file name. File/singleton collection only.
 * @param {string} args.slug Entry slug used for the workflow branch name.
 * @param {Entry} [args.originalEntry] Entry being edited, before the changes.
 * @returns {Promise<ChangeResults>} Change results.
 */
export const saveWorkflowChanges = async ({
  changes,
  savingEntry,
  savingAssets = [],
  options,
  collectionName,
  fileName,
  slug,
  originalEntry,
}) => {
  const workflow = getWorkflowService();

  // The branch name is derived from the slug, so looking the pull request up by branch alone would
  // miss it after the slug has been edited and start a second pull request for the same entry. Use
  // the branch the entry is already associated with when there is one, and keep that branch name
  // even though it no longer matches the slug: only the collection name is read back from it.
  const currentBranch = /** @type {UnpublishedEntry} */ (originalEntry)?.workflow?.pullRequest
    .branch;

  const existingEntry =
    (currentBranch ? getUnpublishedEntryByBranch(currentBranch) : undefined) ??
    getUnpublishedEntryBySlug({ collectionName, slug });

  const branch =
    existingEntry?.workflow.pullRequest.branch ?? getBranchName({ collectionName, slug });

  const { commit, pullRequest } = await workflow.savePullRequest({
    changes,
    options,
    branch,
    title: createCommitMessage(changes, options),
    status: 'draft',
    pullRequest: existingEntry?.workflow.pullRequest,
  });

  const commitAuthor = getCommitAuthor();
  const { date: commitDate } = commit;

  // Remember where the entry lived before the pull request, so the entry list can still match it
  // with its published counterpart after the slug — and therefore the file path — has changed. Once
  // recorded, the paths are the published ones, so keep them on later saves. An empty list means
  // nothing has been recorded yet, which is not the same as having no previous location: a pull
  // request that hasn’t renamed anything still needs the paths captured when the slug is edited.
  const previousPaths = existingEntry?.workflow.previousPaths?.length
    ? existingEntry.workflow.previousPaths
    : (originalEntry?.locales && Object.values(originalEntry.locales).map(({ path }) => path)) ||
      [];

  /** @type {UnpublishedEntry} */
  const unpublishedEntry = {
    ...savingEntry,
    // Reuse the existing ID so the editor doesn’t lose track of the entry after a save
    id: existingEntry?.id ?? savingEntry.id,
    commitAuthor,
    commitDate,
    workflow: {
      // The backend returns the existing pull request as is when there already is one, so the head
      // commit it carries is the one from before this save. Point it at the new commit, so the
      // deploy preview lookup doesn’t keep reporting the previous build until the next full load
      pullRequest: { ...pullRequest, headSHA: commit.sha },
      status: pullRequest.status,
      collectionName,
      fileName,
      previousPaths,
    },
  };

  // The assets are committed to the workflow branch only, but add them to the regular asset list
  // right away, so the image attached to the entry can be previewed before it’s published
  const savedAssets = savingAssets.map((asset) => ({
    ...asset,
    sha: commit.files[asset.path]?.sha ?? asset.sha,
    commitAuthor,
    commitDate,
    workflow: { branch },
  }));

  upsertUnpublishedEntry(unpublishedEntry);
  mergeWorkflowAssets(savedAssets);

  return {
    commit: { ...commit, author: commitAuthor },
    savedEntries: [unpublishedEntry],
    savedAssets,
  };
};

/**
 * Change the Editorial Workflow status of the given unpublished entry, which updates the label and
 * the draft state on the corresponding pull request.
 * @param {UnpublishedEntry} entry Unpublished entry.
 * @param {WorkflowStatus} status New status.
 * @returns {Promise<UnpublishedEntry>} Updated entry.
 */
export const updateWorkflowStatus = async (entry, status) => {
  const workflow = getWorkflowService();
  const { pullRequest } = entry.workflow;

  // Update the store before the request so the UI reflects the new status right away, rather than
  // after the round trip to the backend. The change is rolled back if the request fails.
  upsertUnpublishedEntry({
    ...entry,
    workflow: { ...entry.workflow, status, pullRequest: { ...pullRequest, status } },
  });

  /** @type {WorkflowPullRequest} */
  let newPullRequest;

  try {
    newPullRequest = await workflow.updateStatus(pullRequest, status);
  } catch (ex) {
    upsertUnpublishedEntry(entry);

    throw ex;
  }

  const updatedEntry = {
    ...entry,
    workflow: { ...entry.workflow, pullRequest: newPullRequest, status },
  };

  upsertUnpublishedEntry(updatedEntry);

  return updatedEntry;
};

/**
 * Publishes in flight, keyed by workflow branch. See {@link publishWorkflowEntry}.
 * @type {Map<string, Promise<void>>}
 */
const pendingPublishes = new Map();

/**
 * Merge the pull request of the given unpublished entry, and move the entry from the unpublished
 * entry list to the regular entry list once it has.
 * @param {UnpublishedEntry} entry Unpublished entry.
 * @returns {Promise<void>}
 */
const mergeWorkflowEntry = async (entry) => {
  const workflow = getWorkflowService();
  const { pullRequest, status } = entry.workflow;
  const deletion = status === 'pending_deletion';
  const hookArgs = getEventHookArgs(entry);

  // Merging a removal is what takes the entry off the configured branch, so that’s when the
  // unpublish hooks fire. Nothing is being published, so the publish hooks don’t apply
  const [preType, postType] = deletion
    ? /** @type {const} */ (['preUnpublish', 'postUnpublish'])
    : /** @type {const} */ (['prePublish', 'postPublish']);

  if (hookArgs) {
    await callEventHooks({ ...hookArgs, type: preType });
  }

  await workflow.publish(pullRequest);

  const { workflow: _workflow, ...publishedEntry } = entry;

  // Include the pre-rename paths, so the entry that the pull request renamed is replaced rather
  // than left behind as a duplicate
  const paths = new Set([
    ...Object.values(publishedEntry.locales).map(({ path }) => path),
    ...(_workflow.previousPaths ?? []),
  ]);

  // A removal also rewrote the entries referencing the deleted one, so the store is brought up to
  // date with those as well, or they would show the stale references until the next reload. The
  // references are worked out again rather than remembered from when the pull request was opened,
  // because the entries may have been reloaded since; this has to happen while the deleted entry
  // is still in the store, as it’s what the references are matched against
  /** @type {Map<string, Entry>} */
  const cascadedEntries = new Map(
    deletion && hookArgs
      ? planCascadeDelete({
          collection: hookArgs.collection,
          collectionFile: hookArgs.collectionFile,
          entries: [entry],
        }).targets.map(({ entry: target }) => [target.id, target])
      : [],
  );

  const remaining = allEntries.current
    .filter((e) => !Object.values(e.locales).some(({ path }) => paths.has(path)))
    .map((e) => cascadedEntries.get(e.id) ?? e);

  // Publishing a removal takes the entry off the configured branch rather than putting a new
  // version on it
  allEntries.current = deletion ? remaining : [...remaining, publishedEntry];

  removeUnpublishedEntry(pullRequest.branch);
  publishWorkflowAssets(pullRequest.branch);
  forgetDeployments([pullRequest.headSHA]);
  // The merge put a new commit on the configured branch, so the production build to watch is a
  // different one now. The entry is listed as on its way until that build is done, so the head has
  // to be known before it’s recorded
  await refreshProductionSHA();
  trackDeployingEntry(entry);

  if (hookArgs) {
    await callEventHooks({ ...hookArgs, type: postType });
  }
};

/**
 * Publish the given unpublished entry by merging the corresponding pull request. The entry is then
 * moved from the unpublished entry list to the regular entry list. The merge can take minutes when
 * the Git service waits for a pipeline, long enough for the user to leave and come back to the
 * entry, so publishing it again meanwhile joins the merge in progress rather than starting another:
 * the hooks would otherwise fire twice, and so would everything after the merge.
 * @param {UnpublishedEntry} entry Unpublished entry.
 * @returns {Promise<void>}
 */
export const publishWorkflowEntry = async (entry) => {
  const { branch } = entry.workflow.pullRequest;
  const pending = pendingPublishes.get(branch);

  if (pending) {
    return pending;
  }

  const promise = mergeWorkflowEntry(entry).finally(() => {
    pendingPublishes.delete(branch);
    publishingBranches.current = publishingBranches.current.filter((b) => b !== branch);
  });

  pendingPublishes.set(branch, promise);
  publishingBranches.current = [...publishingBranches.current, branch];

  return promise;
};

/**
 * Discard the given unpublished entry by closing the corresponding pull request without merging it.
 * @param {UnpublishedEntry} entry Unpublished entry.
 * @returns {Promise<void>}
 */
export const discardWorkflowEntry = async (entry) => {
  const workflow = getWorkflowService();
  const { pullRequest } = entry.workflow;

  await workflow.discard(pullRequest);
  removeUnpublishedEntry(pullRequest.branch);
  removeWorkflowAssets(pullRequest.branch);
  forgetDeployments([pullRequest.headSHA]);
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
 * @returns {Promise<UnpublishedEntry>} Entry with the pull request attached.
 * @throws {Error} When removing the references would leave another entry invalid. The dialogs
 * report this before the deletion is confirmed, so this is only a safeguard.
 * @see https://github.com/sveltia/sveltia-cms/issues/770
 */
export const deleteWorkflowEntry = async (
  entry,
  collection,
  collectionFile,
  assets = [],
  { targets = undefined } = {},
) => {
  // Taking a published entry off the site is a maintainer’s call. A contributor can discard their
  // own draft, which leaves the published version alone, but not propose a removal
  if (openAuthoring.current) {
    throw new Error('Cannot delete a published entry as an Open Authoring contributor', {
      cause: new Error(_('open_authoring.direct_commit_unsupported')),
    });
  }

  if (!targets) {
    const plan = planCascadeDelete({ collection, collectionFile, entries: [entry] });

    if (plan.blockers.length) {
      throw new Error('Cannot delete an entry that other entries require', {
        cause: plan.blockers,
      });
    }

    ({ targets } = plan);
  }

  const workflow = getWorkflowService();
  const collectionName = collection.name;
  const { slug } = entry;
  // The branch keeps the slug the entry had when the pull request was opened, so deriving it from
  // the current slug would miss the pull request after the slug has been edited, leaving it open
  // and starting a second one
  const currentBranch = /** @type {UnpublishedEntry} */ (entry)?.workflow?.pullRequest.branch;

  const existingEntry =
    (currentBranch ? getUnpublishedEntryByBranch(currentBranch) : undefined) ??
    getUnpublishedEntryBySlug({ collectionName, slug });

  const branch =
    existingEntry?.workflow.pullRequest.branch ?? getBranchName({ collectionName, slug });

  // Remove the files as they stand on the branch. A pull request that renamed the entry has already
  // staged the deletion of the old paths there, so removing the new ones leaves nothing behind once
  // the merge lands
  const paths = unique(Object.values(entry.locales).map(({ path }) => path));
  // An entry-relative asset lives with the entry, so it goes in the same pull request rather than
  // being left behind once the removal lands
  const assetPaths = unique(assets.map(({ path }) => path));
  // The references are removed from the published entries as they stand on the configured branch,
  // which is where the pull request will land
  const { changes: cascadeChanges } = await buildCascadeDeleteChanges({ targets });

  // Reuse any open pull request rather than discarding it first: closing it up front would throw
  // the pending changes away with no way back if opening the replacement then failed
  const { pullRequest } = await workflow.savePullRequest({
    changes: [
      ...[...paths, ...assetPaths].map(
        (path) => /** @type {FileChange} */ ({ action: 'delete', slug, path }),
      ),
      ...cascadeChanges,
    ],
    options: { commitType: 'delete', collection },
    branch,
    title: createCommitMessage([{ action: 'delete', slug, path: paths[0] }], {
      commitType: 'delete',
      collection,
    }),
    // The removal is complete as committed, so it skips the review stages entirely. Opening it at
    // this status avoids the churn of creating a draft and relabelling it a moment later
    status: 'pending_deletion',
    pullRequest: existingEntry?.workflow.pullRequest,
  });

  // A reused pull request keeps the status it already had, so it still needs the switch
  const readyPullRequest =
    pullRequest.status === 'pending_deletion'
      ? pullRequest
      : await workflow.updateStatus(pullRequest, 'pending_deletion');

  /** @type {UnpublishedEntry} */
  const unpublishedEntry = {
    ...entry,
    workflow: {
      pullRequest: readyPullRequest,
      status: readyPullRequest.status,
      collectionName,
      fileName: collectionFile?.name,
      // Where the entry lives on the configured branch, which a rename has already moved away from
      previousPaths: existingEntry?.workflow.previousPaths?.length
        ? existingEntry.workflow.previousPaths
        : paths,
    },
  };

  upsertUnpublishedEntry(unpublishedEntry);

  return unpublishedEntry;
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
 * that entry when they’re published.
 * @param {{ entry: Entry, collection: InternalCollection,
 * collectionFile?: InternalCollectionFile, assets?: Asset[] }[]} items Entries to be deleted, with
 * the context each one needs.
 * @throws {Error} When removing the references would leave another entry invalid. The dialog
 * reports this before the deletion is confirmed, so this is only a safeguard.
 */
export const deleteWorkflowEntries = async (items) => {
  // A selection comes from one entry list, so it’s normally a single group
  /** @type {Map<string, typeof items>} */
  const groups = new Map();

  items.forEach((item) => {
    const key = `${item.collection.name}\0${item.collectionFile?.name ?? ''}`;

    getOrCreate(groups, key, () => []).push(item);
  });

  /** @type {Map<string, CascadeTarget[]>} */
  const targetMap = new Map();

  groups.forEach((group, key) => {
    const [{ collection, collectionFile }] = group;

    const { targets, blockers } = planCascadeDelete({
      collection,
      collectionFile,
      entries: group.map(({ entry }) => entry),
    });

    if (blockers.length) {
      throw new Error('Cannot delete entries that other entries require', { cause: blockers });
    }

    targetMap.set(key, targets);
  });

  await runConcurrently(items, async ({ entry, collection, collectionFile, assets }) => {
    await deleteWorkflowEntry(entry, collection, collectionFile, assets, {
      targets: targetMap.get(`${collection.name}\0${collectionFile?.name ?? ''}`),
    });
  });
};
