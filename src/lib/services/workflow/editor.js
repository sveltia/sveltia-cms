import { goBack } from '$lib/services/app/navigation';
import {
  contentUpdatesToast,
  UPDATE_TOAST_DEFAULT_STATE,
} from '$lib/services/contents/collection/data';
import { isEntryAlreadyPublished } from '$lib/services/workflow/open-authoring';

/**
 * @import { EntryDraftState } from '$lib/services/contents/draft/state.svelte';
 * @import { UnpublishedEntry } from '$lib/types/private';
 */

/**
 * Close the editor on an unpublished entry that has just left the board, because it has been
 * published, and go back to its collection. The editor can have moved on by then: a merge can take
 * minutes when the Git service waits for a pipeline, and the draft state is shared by the whole
 * page, so the draft open now may be another entry’s, with unsaved changes. Only the given entry’s
 * draft is closed.
 * @param {object} args Arguments.
 * @param {EntryDraftState} args.entryDraft Draft state of the editor.
 * @param {string} args.branch Workflow branch of the entry, read before it left the board.
 * @param {string} args.collectionName Collection of the entry.
 */
export const closeWorkflowEntryEditor = ({ entryDraft, branch, collectionName }) => {
  const originalEntry = /** @type {UnpublishedEntry | undefined} */ (
    entryDraft.current?.originalEntry
  );

  if (originalEntry?.workflow?.pullRequest.branch === branch) {
    entryDraft.current = null;
    goBack(`/collections/${collectionName}`);
  }
};

/**
 * Handle an error from changing the status of the entry open in the editor, if it says that the
 * entry has been published since: a maintainer merged an Open Authoring contributor’s request, and
 * nothing has been committed to its branch since. The entry has left the board, so the editor is
 * closed, and the global toast says why: the editor’s own controls go away with the entry. Unlike
 * publishing, a status change can be made with unsaved changes in the editor, which would be lost,
 * so the editor then stays open: saving them starts a new draft of the published entry.
 * @param {any} ex Error thrown by the status change.
 * @param {object} args Arguments.
 * @param {EntryDraftState} args.entryDraft Draft state of the editor.
 * @param {string} args.branch Workflow branch of the entry, read before the status change.
 * @param {string} args.collectionName Collection of the entry.
 * @returns {boolean} Whether the error was handled. Any other error is left to the caller.
 */
export const handleEntryAlreadyPublished = (ex, { entryDraft, branch, collectionName }) => {
  if (!isEntryAlreadyPublished(ex)) {
    return false;
  }

  if (!entryDraft.modified) {
    closeWorkflowEntryEditor({ entryDraft, branch, collectionName });
  }

  contentUpdatesToast.current = { ...UPDATE_TOAST_DEFAULT_STATE, alreadyPublished: true };

  return true;
};
