import { callEventHooks } from '$lib/services/api/events';
import { skipCIConfigured, skipCIEnabled } from '$lib/services/backends/git/shared/integration';
import { saveChanges } from '$lib/services/backends/save';
import { getCollection } from '$lib/services/contents/collection';
import {
  contentUpdatesToast,
  UPDATE_TOAST_DEFAULT_STATE,
} from '$lib/services/contents/collection/data';
import { buildNestedMoveChanges } from '$lib/services/contents/collection/nested/move';
import { deleteBackup } from '$lib/services/contents/draft/backup';
import { getReferencedPendingEntries } from '$lib/services/contents/draft/pending-entries';
import { buildEntryAssetMoveChanges } from '$lib/services/contents/draft/save/asset-move';
import { createSavingEntryData } from '$lib/services/contents/draft/save/changes';
import { assignManualSortOrder } from '$lib/services/contents/draft/save/sort-order';
import { getSlugs } from '$lib/services/contents/draft/slugs';
import { validateEntry } from '$lib/services/contents/draft/validate';
import { awaitCustomFieldValidations } from '$lib/services/contents/draft/validate/custom-fields';
import { isRequiredEnforced } from '$lib/services/contents/draft/validate/required';
import { expandInvalidFields } from '$lib/services/contents/editor/fields';
import { awaitPendingFieldUpdates } from '$lib/services/contents/editor/pending';
import { clearEntryHistoryCache } from '$lib/services/contents/entry/history';
import { buildCascadeChanges } from '$lib/services/contents/entry/relations/cascade/update';
import { setLastCommitPublishHint } from '$lib/services/deployments/publish';
import { isWorkflowDraft } from '$lib/services/workflow';
import { saveWorkflowChanges } from '$lib/services/workflow/save';

/**
 * @import {
 * ChangeResults,
 * CommitOptions,
 * Entry,
 * EntryDraft,
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
 * Save the entry draft.
 * @param {object} args Arguments.
 * @param {EntryDraft} args.draft Draft to save.
 * @param {boolean} [args.skipCI] Whether to disable automatic deployments for the change.
 * @returns {Promise<Entry>} Saved entry.
 * @throws {Error} When the entry could not be validated or saved.
 */
export const saveEntry = async ({ draft, skipCI = undefined }) => {
  const { isNew, collection, collectionName, fileName, originalEntry } = draft;

  // A rich text editor writes what was just typed to the draft with a short delay, so wait for such
  // updates first. Otherwise a save right after typing would validate the field’s previous value,
  // e.g. an empty required field, and the error would clear itself moments later
  await awaitPendingFieldUpdates();
  // Custom field validators can be async, so wait for any in-flight results before validating.
  // Otherwise a field made invalid moments ago would be validated against a stale verdict.
  await awaitCustomFieldValidations();

  if (!validateEntry({ draft, enforceRequired: isRequiredEnforced(draft) })) {
    expandInvalidFields({ draft });

    throw new Error('validation_failed');
  }

  if (isNew && collection._type === 'entry') {
    assignManualSortOrder(draft);
  }

  const slugs = getSlugs({ draft });
  const { defaultLocaleSlug } = slugs;
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
  const { changes: assetMoveChanges, savingAssets: movedAssets } = await buildEntryAssetMoveChanges(
    { collection, fileName, originalEntry, savingEntry, changes },
  );

  changes.push(...assetMoveChanges);
  savingAssets.push(...movedAssets);

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
  // A collection can opt in or out of Editorial Workflow on its own, but an entry that already has
  // a pull request stays in it
  const useWorkflow = isWorkflowDraft(draft);

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
  deleteBackup(collectionName, isNew ? '' : defaultLocaleSlug);

  if (originalEntry) {
    clearEntryHistoryCache(originalEntry.id);
  }

  return results.savedEntries[0];
};
