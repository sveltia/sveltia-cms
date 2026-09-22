import { checkForRemoteChanges, MIN_CHECK_GAP } from '$lib/services/backends/refresh';
import { isDraftModified } from '$lib/services/contents/draft';
import { deleteBackup, getBackup, getBackupSlug } from '$lib/services/contents/draft/backup';
import { createDraft } from '$lib/services/contents/draft/create';
import { compareWithStore } from '$lib/services/contents/draft/save/conflict';
import { isWorkflowDraft } from '$lib/services/workflow';

/**
 * @import { EntryDraftState } from '$lib/services/contents/draft/state.svelte';
 * @import { Entry, EntryDraft } from '$lib/types/private';
 */

/**
 * Replace the draft in the editor with a fresh one made from the given version of its entry — the
 * one now on the branch, after someone else has changed it. Whatever the user had typed is dropped,
 * along with the backup made of it; otherwise the new draft would offer to restore the edits that
 * were just given up. The caller asks the user first when there is anything to lose.
 * @param {object} args Arguments.
 * @param {EntryDraftState} args.entryDraft Entry draft state of the editor.
 * @param {Entry} args.entry Entry to make the new draft from.
 * @returns {Promise<EntryDraft>} The new draft.
 */
export const reloadDraft = async ({ entryDraft, entry }) => {
  const draft = /** @type {EntryDraft} */ (entryDraft.current);
  const { collectionName, collection, collectionFile, expanderStates } = draft;

  await deleteBackup(collectionName, getBackupSlug(draft));

  return createDraft({
    entryDraft,
    collection,
    collectionFile,
    originalEntry: entry,
    // Keep the fields expanded or collapsed as the user had them
    expanderStates,
  });
};

/**
 * Bring a draft that has just been opened for an existing entry up to date with the repository, so
 * the editor shows the entry as it is rather than as it was when the site data was loaded. The
 * check is made in passing, so an entry opened right after another costs nothing. If the entry has
 * been changed in the meantime and the user hasn’t touched the draft yet, it’s quietly made again
 * from the new version. Otherwise — the user has started editing, has a backup to be asked about,
 * or the entry is gone — the notice in the editor takes over, so nothing is lost.
 * @param {EntryDraftState} entryDraft Entry draft state of the editor.
 * @returns {Promise<void>}
 */
export const refreshOpenedDraft = async (entryDraft) => {
  const draft = entryDraft.current;

  // A new entry has nothing to compare; a workflow draft is saved to its own branch
  if (!draft || draft.isNew || !draft.originalEntry || isWorkflowDraft(draft)) {
    return;
  }

  try {
    await checkForRemoteChanges({ maxAge: MIN_CHECK_GAP });
  } catch (ex) {
    // eslint-disable-next-line no-console
    console.error('Failed to check the repository for changes.', ex);

    return;
  }

  if (entryDraft.current !== draft || draft.interacted || isDraftModified(draft)) {
    return;
  }

  const conflict = compareWithStore(draft.originalEntry);

  if (conflict?.type !== 'modified') {
    return;
  }

  const { collectionName, collection, collectionFile, expanderStates } = draft;

  // A backup from an earlier session is being offered, or about to be — the draft looks it up on
  // its own time, so the dialog can’t be relied upon to be showing yet. Restoring it into a draft
  // that has just been replaced would lose the restored edits, so the draft is left alone
  if (await getBackup(collectionName, getBackupSlug(draft))) {
    return;
  }

  createDraft({
    entryDraft,
    collection,
    collectionFile,
    originalEntry: conflict.entry,
    expanderStates,
  });
};
