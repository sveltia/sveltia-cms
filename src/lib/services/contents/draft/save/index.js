import { callEventHooks } from '$lib/services/api/events';
import { isCommitCancelled } from '$lib/services/backends/commit-prompt';
import { skipCIConfigured, skipCIEnabled } from '$lib/services/backends/git/shared/integration';
import { saveChanges } from '$lib/services/backends/save';
import { getReadonlyMessage, isDraftReadonly } from '$lib/services/config/readonly';
import { getCollection } from '$lib/services/contents/collection';
import {
  contentUpdatesToast,
  UPDATE_TOAST_DEFAULT_STATE,
} from '$lib/services/contents/collection/data';
import { buildNestedMoveChanges } from '$lib/services/contents/collection/nested/move';
import { cancelBackup, deleteBackup, getBackupSlug } from '$lib/services/contents/draft/backup';
import { getReferencedPendingEntries } from '$lib/services/contents/draft/pending-entries';
import { buildEntryAssetMoveChanges } from '$lib/services/contents/draft/save/asset-move';
import {
  createSavingEntryData,
  preparePendingEntryCommit,
  removeDisabledLocales,
} from '$lib/services/contents/draft/save/changes';
import { detectEntryConflict } from '$lib/services/contents/draft/save/conflict';
import { assignManualSortOrder } from '$lib/services/contents/draft/save/sort-order';
import { getSlugs } from '$lib/services/contents/draft/slugs';
import { isRequiredEnforced } from '$lib/services/contents/draft/validate/required';
import { validateAndRevealErrors } from '$lib/services/contents/draft/validate/reveal';
import { clearEntryHistoryCache } from '$lib/services/contents/entry/history';
import { buildCascadeChanges } from '$lib/services/contents/entry/relations/cascade/update';
import { assignAutoNowValues } from '$lib/services/contents/fields/date-time/auto-now';
import { assignAutoIncrementValues } from '$lib/services/contents/fields/number/auto-increment';
import { setLastCommitPublishHint } from '$lib/services/deployments';
import { getUnpublishedEntryByDraft, isWorkflowDraft } from '$lib/services/workflow';
import { detectWorkflowConflict } from '$lib/services/workflow/conflict';
import { saveWorkflowChanges } from '$lib/services/workflow/save';

/**
 * @import {
 * Asset,
 * ChangeResults,
 * CommitOptions,
 * Entry,
 * EntryDraft,
 * EntrySlugVariants,
 * FileChange,
 * InternalCollection,
 * PendingEntry,
 * } from '$lib/types/private';
 * @import { EntryConflict } from '$lib/services/contents/draft/save/conflict';
 */

/**
 * Update the application stores with deployment settings.
 * @param {object} args Arguments.
 * @param {boolean} args.useWorkflow Whether the changes went to a pull request rather than the
 * configured branch.
 * @param {boolean | undefined} args.skipCI Whether to disable automatic deployments for the change.
 * @param {number} args.count Number of entries saved, including any entry rewritten to keep its
 * references to the saved entry up to date.
 */
const updateStores = ({ useWorkflow, skipCI, count }) => {
  // With Editorial Workflow, changes go to a pull request, so nothing is published yet
  const published = !useWorkflow && skipCIConfigured.current && !(skipCI ?? skipCIEnabled.current);

  contentUpdatesToast.current = {
    ...UPDATE_TOAST_DEFAULT_STATE,
    saved: true,
    published,
    count,
  };

  setLastCommitPublishHint(published);
};

/**
 * Work out the file changes for saving the entry draft, including those of the entries and assets
 * the save takes along. An entry file that can’t be formatted, e.g. in a custom format registered
 * without a formatter, fails the save rather than being written empty.
 * @param {object} args Arguments.
 * @param {EntryDraft} args.draft Draft to save.
 * @param {EntrySlugVariants} args.slugs Entry slugs.
 * @param {boolean} args.recreate Whether to write the entry anew, because someone else has deleted
 * it since the draft was opened. See {@link createSavingEntryData}.
 * @returns {Promise<{ savingEntry: Entry, changes: FileChange[], savingAssets: Asset[],
 * cascadeEntries: Entry[], movedEntries: Entry[] }>} Saving entry, file changes, assets, and the
 * other entries rewritten in the same commit.
 * @throws {Error} A `saving_failed` error when the changes could not be worked out, with the
 * original error as its `cause`, so the message can be shown to the user.
 */
const buildChanges = async ({ draft, slugs, recreate }) => {
  const { collection, fileName, originalEntry } = draft;

  try {
    const { savingEntry, changes, savingAssets } = await createSavingEntryData({
      draft,
      slugs,
      recreate,
    });

    // When the slug has been edited, the entries referencing this one through a Relation field have
    // to be rewritten in the same commit, or they would be left pointing at an entry that no longer
    // exists under that name
    const { changes: cascadeChanges, savingEntries: cascadeEntries } = await buildCascadeChanges({
      collection,
      collectionFile: draft.collectionFile,
      originalEntry,
      savingEntry,
    });

    changes.push(...cascadeChanges);

    // Moving an entry in a nested collection takes everything below it to the new location
    const { changes: moveChanges, savingEntries: movedEntries } = await buildNestedMoveChanges({
      collection,
      originalEntry,
      savingEntry,
    });

    changes.push(...moveChanges);

    // Assets stored next to the entry belong to it, so they follow it to its new folder. An entry
    // someone else has deleted has taken its assets along, so there’s nothing left to move
    const { changes: assetMoveChanges, savingAssets: movedAssets } =
      await buildEntryAssetMoveChanges({
        collection,
        fileName,
        originalEntry: recreate ? undefined : originalEntry,
        savingEntry,
        changes,
      });

    changes.push(...assetMoveChanges);
    savingAssets.push(...movedAssets);

    return {
      // The locales turned off have served their purpose in the change plan, deleting their files
      savingEntry: removeDisabledLocales(savingEntry),
      changes,
      savingAssets,
      cascadeEntries,
      movedEntries,
    };
  } catch (/** @type {any} */ ex) {
    // eslint-disable-next-line no-console
    console.error(ex);

    throw new Error('saving_failed', { cause: ex });
  }
};

/**
 * Make sure the entry draft can be saved: it’s editable, its values are valid, and no one else has
 * changed the entry since the draft was opened, unless the user has said to save over it.
 * @param {object} args Arguments.
 * @param {EntryDraft} args.draft Draft to save.
 * @param {boolean} args.useWorkflow Whether the changes go to a pull request rather than the
 * configured branch.
 * @param {boolean} args.overwrite Whether to save even if someone else has changed the entry.
 * @param {boolean} args.publish Whether the entry is published along with the save, in which case
 * its required fields have to be filled in, even if it’s a workflow draft.
 * @returns {Promise<EntryConflict | undefined>} Conflict found, if any, which the save overwrites.
 * @throws {Error} When the entry is read-only, could not be validated, or would overwrite someone
 * else’s change.
 */
const checkSavable = async ({ draft, useWorkflow, overwrite, publish }) => {
  // The editor offers no way to save a read-only entry, but make sure nothing is written anyway
  if (isDraftReadonly(draft)) {
    const { collection, collectionFile } = draft;

    throw new Error('saving_failed', {
      cause: new Error(getReadonlyMessage('entry', { collection, collectionFile })),
    });
  }

  // Wait for what was just typed to reach the draft first. Otherwise a save right after typing
  // would validate the field’s previous value, e.g. an empty required field, and the error would
  // clear itself moments later
  const enforceRequired = publish || isRequiredEnforced(draft);

  if (!(await validateAndRevealErrors({ draft, enforceRequired }))) {
    throw new Error('validation_failed');
  }

  // Bring the site data up to date before the changes are worked out from it, and refuse to save
  // over someone else’s change to this entry unless the user has said so. A workflow draft is
  // compared with its own branch instead of the configured one: the branch is named after the
  // entry, not the editor, so a colleague working on the same entry writes to it too
  const conflict = useWorkflow
    ? await detectWorkflowConflict(draft)
    : await detectEntryConflict(draft);

  if (conflict && !overwrite) {
    throw new Error('save_conflict', { cause: conflict });
  }

  return conflict;
};

/**
 * Assign the values that are only given when the entry draft is saved: the manual sort order of a
 * new entry, the auto-increment numbers and the `auto_now` dates.
 * @param {EntryDraft} draft Draft to save, updated in place.
 */
const assignSaveTimeValues = (draft) => {
  const { isNew, collection, collectionName } = draft;

  // The entries added to the same collection from a Relation field have already taken the orders
  // and numbers after the highest ones, so the new entry comes after them
  const pendingEntryCount = draft.pendingEntries.filter(
    (pendingEntry) => pendingEntry.collectionName === collectionName,
  ).length;

  if (isNew && collection._type === 'entry') {
    assignManualSortOrder(draft, pendingEntryCount);
  }

  // Number the auto-increment Number fields at save time for the same reason, before the slugs are
  // created, so a slug template can use the number
  assignAutoIncrementValues(draft, pendingEntryCount);

  // Set the DateTime fields with the `auto_now` option at save time rather than when the draft was
  // created, so the value tells when the entry was actually saved
  assignAutoNowValues(draft);
};

/**
 * Prepare the commit of the entries created from a Relation field that the entry draft refers to.
 * They go into the same commit as the entry referring to them, so neither can end up without the
 * other.
 * @param {EntryDraft} draft Draft to save.
 * @returns {Promise<PendingEntry[]>} Pending entries, with their file changes and assets.
 */
const preparePendingEntries = async (draft) => {
  /** @type {PendingEntry[]} */
  const pendingEntries = [];

  // Call the `preSave` event hooks one entry after another, like for the hooks of a single entry
  // eslint-disable-next-line no-restricted-syntax
  for (const pendingEntry of getReferencedPendingEntries(draft)) {
    // eslint-disable-next-line no-await-in-loop
    pendingEntries.push(await preparePendingEntryCommit(pendingEntry));
  }

  return pendingEntries;
};

/**
 * Commit the file changes, to a pull request or the configured branch.
 * @param {object} args Arguments.
 * @param {EntryDraft} args.draft Draft to save.
 * @param {boolean} args.useWorkflow Whether the changes go to a pull request rather than the
 * configured branch.
 * @param {FileChange[]} args.changes File changes.
 * @param {Entry} args.savingEntry Entry to save.
 * @param {Entry[]} args.otherSavingEntries Other entries rewritten or created in the same commit.
 * @param {Asset[]} args.savingAssets Assets to save.
 * @param {CommitOptions} args.options Commit options.
 * @returns {Promise<ChangeResults>} Results.
 * @throws {Error} A `saving_failed` error when the changes could not be saved, with the original
 * error as its `cause`, or the cancellation error when the user has cancelled the commit.
 */
const commitChanges = async ({
  draft,
  useWorkflow,
  changes,
  savingEntry,
  otherSavingEntries,
  savingAssets,
  options,
}) => {
  const { collectionName, fileName, originalEntry } = draft;

  try {
    return useWorkflow
      ? await saveWorkflowChanges({
          changes,
          savingEntry,
          savingAssets,
          options,
          collectionName,
          fileName,
          // The slug the entry goes by, which is its path within the collection folder in a nested
          // collection, so an entry doesn’t take the branch of another with the same file name
          slug: savingEntry.slug,
          originalEntry,
        })
      : await saveChanges({
          changes,
          savingEntries: [savingEntry, ...otherSavingEntries],
          savingAssets,
          options,
        });
  } catch (/** @type {any} */ ex) {
    // Nothing has been saved if the user has cancelled the commit, which is not a failure
    if (isCommitCancelled(ex)) {
      throw ex;
    }

    // eslint-disable-next-line no-console
    console.error(ex.cause ?? ex);

    throw new Error('saving_failed', { cause: ex.cause ?? ex });
  }
};

/**
 * Clean up after the entry draft has been saved: delete its backup, call the `postSave` event
 * hooks and tell the user.
 * @param {object} args Arguments.
 * @param {EntryDraft} args.draft Saved draft.
 * @param {Entry} args.savingEntry Saved entry.
 * @param {PendingEntry[]} args.pendingEntries Entries created from a Relation field, saved along.
 * @param {boolean} args.useWorkflow Whether the changes went to a pull request.
 * @param {boolean | undefined} args.skipCI Whether automatic deployments were disabled.
 * @param {number} args.count Number of entries saved.
 */
const finishSave = async ({ draft, savingEntry, pendingEntries, useWorkflow, skipCI, count }) => {
  const { isNew, collection, collectionName, originalEntry } = draft;

  // Delete the backup as soon as the changes are saved. A dev server that watches the content files
  // may reload the page right after they’re written, e.g. Eleventy, and a backup that outlives the
  // save would then offer to restore a draft that has already been saved. The changes are saved
  // already, so a backup that can’t be deleted doesn’t fail the save. The backup is stored under
  // the slug the entry had when it was opened, which a rename leaves behind. A backup scheduled for
  // a change made just before the save is dropped as well: the editor may stay open on the saved
  // draft for a while, e.g. while asking whether to send it for review, and the backup made then
  // would take the place of the one deleted here and be offered the next time the entry is opened
  cancelBackup();

  try {
    await deleteBackup(collectionName, getBackupSlug(draft));
  } catch (ex) {
    // eslint-disable-next-line no-console
    console.error(ex);
  }

  await callEventHooks({
    type: 'postSave',
    entry: savingEntry,
    collection,
    collectionFile: draft.collectionFile,
    isNew,
  });

  await Promise.all(
    pendingEntries.map(({ collectionName: pendingCollectionName, entry }) =>
      callEventHooks({
        type: 'postSave',
        entry,
        collection: /** @type {InternalCollection} */ (getCollection(pendingCollectionName)),
        isNew: true,
      }),
    ),
  );

  updateStores({ useWorkflow, skipCI, count });

  if (originalEntry) {
    clearEntryHistoryCache(originalEntry.id);
  }
};

/**
 * Save the entry draft.
 * @param {object} args Arguments.
 * @param {EntryDraft} args.draft Draft to save.
 * @param {boolean} [args.skipCI] Whether to disable automatic deployments for the change.
 * @param {boolean} [args.overwrite] Whether to save even if someone else has changed the entry
 * since the draft was opened. Without it, such a save is refused with a `save_conflict` error whose
 * `cause` is the conflict found by {@link detectEntryConflict}, so the user can be asked first.
 * An entry stored in a file with the other entries of the collection is still refused if its item
 * has changed, as it’s told by its position, and the item at the position may now be another entry
 * that has moved there.
 * @param {boolean} [args.publish] Whether to publish the entry along with the save, bypassing the
 * review: see the `direct_publish` publish mode option. A workflow draft without a pull request is
 * then committed straight to the configured branch. One with a pull request is still saved to it,
 * as the pull request may hold earlier changes too, and it’s up to the caller to merge it.
 * @returns {Promise<Entry>} Saved entry.
 * @throws {Error} When the entry is read-only, could not be validated or saved, or would overwrite
 * someone else’s change.
 */
export const saveEntry = async ({
  draft,
  skipCI = undefined,
  overwrite = false,
  publish = false,
}) => {
  // A collection can opt in or out of Editorial Workflow on its own, but an entry that already has
  // a pull request stays in it
  const useWorkflow = publish ? !!getUnpublishedEntryByDraft(draft) : isWorkflowDraft(draft);
  const conflict = await checkSavable({ draft, useWorkflow, overwrite, publish });

  assignSaveTimeValues(draft);

  const slugs = getSlugs({ draft });
  // Saving over a deletion writes the entry anew, as its files and the assets stored with it are
  // gone
  const recreate = conflict?.type === 'deleted';

  const { savingEntry, changes, savingAssets, cascadeEntries, movedEntries } = await buildChanges({
    draft,
    slugs,
    recreate,
  });

  const pendingEntries = await preparePendingEntries(draft);

  changes.push(...pendingEntries.flatMap((pendingEntry) => pendingEntry.changes));
  savingAssets.push(...pendingEntries.flatMap((pendingEntry) => pendingEntry.savingAssets));

  const results = await commitChanges({
    draft,
    useWorkflow,
    changes,
    savingEntry,
    otherSavingEntries: [
      ...cascadeEntries,
      ...movedEntries,
      ...pendingEntries.map((pendingEntry) => pendingEntry.entry),
    ],
    savingAssets,
    options: {
      commitType: draft.isNew || recreate ? 'create' : 'update',
      collection: draft.collection,
      skipCI,
    },
  });

  await finishSave({
    draft,
    savingEntry,
    pendingEntries,
    useWorkflow,
    skipCI,
    count: 1 + cascadeEntries.length + movedEntries.length + pendingEntries.length,
  });

  return results.savedEntries[0];
};
