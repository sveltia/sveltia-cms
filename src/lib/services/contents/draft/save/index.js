import { callEventHooks } from '$lib/services/api/events';
import { skipCIConfigured, skipCIEnabled } from '$lib/services/backends/git/shared/integration';
import { saveChanges } from '$lib/services/backends/save';
import { getReadonlyMessage, isDraftReadonly } from '$lib/services/config/readonly';
import { getCollection } from '$lib/services/contents/collection';
import {
  contentUpdatesToast,
  UPDATE_TOAST_DEFAULT_STATE,
} from '$lib/services/contents/collection/data';
import { buildNestedMoveChanges } from '$lib/services/contents/collection/nested/move';
import { deleteBackup, getBackupSlug } from '$lib/services/contents/draft/backup';
import { getReferencedPendingEntries } from '$lib/services/contents/draft/pending-entries';
import { buildEntryAssetMoveChanges } from '$lib/services/contents/draft/save/asset-move';
import { createSavingEntryData } from '$lib/services/contents/draft/save/changes';
import { detectEntryConflict } from '$lib/services/contents/draft/save/conflict';
import { assignManualSortOrder } from '$lib/services/contents/draft/save/sort-order';
import { getSlugs } from '$lib/services/contents/draft/slugs';
import { isRequiredEnforced } from '$lib/services/contents/draft/validate/required';
import { validateAndRevealErrors } from '$lib/services/contents/draft/validate/reveal';
import { clearEntryHistoryCache } from '$lib/services/contents/entry/history';
import { buildCascadeChanges } from '$lib/services/contents/entry/relations/cascade/update';
import { assignAutoNowValues } from '$lib/services/contents/fields/date-time/auto-now';
import { setLastCommitPublishHint } from '$lib/services/deployments';
import { isWorkflowDraft } from '$lib/services/workflow';
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
 * } from '$lib/types/private';
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
 * @returns {Promise<{ savingEntry: Entry, changes: FileChange[], savingAssets: Asset[],
 * cascadeEntries: Entry[], movedEntries: Entry[] }>} Saving entry, file changes, assets, and the
 * other entries rewritten in the same commit.
 * @throws {Error} A `saving_failed` error when the changes could not be worked out, with the
 * original error as its `cause`, so the message can be shown to the user.
 */
const buildChanges = async ({ draft, slugs }) => {
  const { collection, fileName, originalEntry } = draft;

  try {
    const { savingEntry, changes, savingAssets } = await createSavingEntryData({ draft, slugs });

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

    // Assets stored next to the entry belong to it, so they follow it to its new folder
    const { changes: assetMoveChanges, savingAssets: movedAssets } =
      await buildEntryAssetMoveChanges({
        collection,
        fileName,
        originalEntry,
        savingEntry,
        changes,
      });

    changes.push(...assetMoveChanges);
    savingAssets.push(...movedAssets);

    return { savingEntry, changes, savingAssets, cascadeEntries, movedEntries };
  } catch (/** @type {any} */ ex) {
    // eslint-disable-next-line no-console
    console.error(ex);

    throw new Error('saving_failed', { cause: ex });
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
 * @returns {Promise<Entry>} Saved entry.
 * @throws {Error} When the entry is read-only, could not be validated or saved, or would overwrite
 * someone else’s change.
 */
export const saveEntry = async ({ draft, skipCI = undefined, overwrite = false }) => {
  // The editor offers no way to save a read-only entry, but make sure nothing is written anyway
  if (isDraftReadonly(draft)) {
    const { collection, collectionFile } = draft;

    throw new Error('saving_failed', {
      cause: new Error(getReadonlyMessage('entry', { collection, collectionFile })),
    });
  }

  const { isNew, collection, collectionName, fileName, originalEntry } = draft;
  // A collection can opt in or out of Editorial Workflow on its own, but an entry that already has
  // a pull request stays in it
  const useWorkflow = isWorkflowDraft(draft);

  // Wait for what was just typed to reach the draft first. Otherwise a save right after typing
  // would validate the field’s previous value, e.g. an empty required field, and the error would
  // clear itself moments later
  if (!(await validateAndRevealErrors({ draft, enforceRequired: isRequiredEnforced(draft) }))) {
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

  if (isNew && collection._type === 'entry') {
    // The entries added to the same collection from a Relation field have already taken the orders
    // after the highest one, so the new entry comes after them
    assignManualSortOrder(
      draft,
      draft.pendingEntries.filter((pendingEntry) => pendingEntry.collectionName === collectionName)
        .length,
    );
  }

  // Set the DateTime fields with the `auto_now` option at save time rather than when the draft was
  // created, so the value tells when the entry was actually saved
  assignAutoNowValues(draft);

  const slugs = getSlugs({ draft });
  const { defaultLocaleSlug } = slugs;

  const { savingEntry, changes, savingAssets, cascadeEntries, movedEntries } = await buildChanges({
    draft,
    slugs,
  });

  // The entries created from a Relation field go into the same commit as the entry referring to
  // them, so neither can end up without the other
  const pendingEntries = getReferencedPendingEntries(draft);

  changes.push(...pendingEntries.flatMap((pendingEntry) => pendingEntry.changes));
  savingAssets.push(...pendingEntries.flatMap((pendingEntry) => pendingEntry.savingAssets));

  const savingPendingEntries = pendingEntries.map((pendingEntry) => pendingEntry.entry);
  /** @type {ChangeResults} */
  let results;
  /** @type {CommitOptions} */
  const options = { commitType: isNew ? 'create' : 'update', collection, skipCI };

  try {
    results = useWorkflow
      ? await saveWorkflowChanges({
          changes,
          savingEntry,
          savingAssets,
          options,
          collectionName,
          fileName,
          slug: defaultLocaleSlug,
          originalEntry,
        })
      : await saveChanges({
          changes,
          savingEntries: [savingEntry, ...cascadeEntries, ...movedEntries, ...savingPendingEntries],
          savingAssets,
          options,
        });
  } catch (/** @type {any} */ ex) {
    // eslint-disable-next-line no-console
    console.error(ex.cause ?? ex);

    throw new Error('saving_failed', { cause: ex.cause ?? ex });
  }

  // Delete the backup as soon as the changes are saved. A dev server that watches the content files
  // may reload the page right after they’re written, e.g. Eleventy, and a backup that outlives the
  // save would then offer to restore a draft that has already been saved. The changes are saved
  // already, so a backup that can’t be deleted doesn’t fail the save. The backup is stored under
  // the slug the entry had when it was opened, which a rename leaves behind
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

  updateStores({
    useWorkflow,
    skipCI,
    count: 1 + cascadeEntries.length + movedEntries.length + pendingEntries.length,
  });

  if (originalEntry) {
    clearEntryHistoryCache(originalEntry.id);
  }

  return results.savedEntries[0];
};
