import { goBack } from '$lib/services/app/navigation';
import {
  contentUpdatesToast,
  UPDATE_TOAST_DEFAULT_STATE,
} from '$lib/services/contents/collection/data';
import { isEntryAlreadyPublished } from '$lib/services/workflow/open-authoring';
import { getWorkflowErrorMessage } from '$lib/services/workflow/verify';

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

/**
 * Run an Editorial Workflow action on the entry open in the editor, such as a status change or
 * publishing, once the draft has passed the validation the action calls for: an entry can be saved
 * as a draft with its required fields left empty, so it has to be checked before it moves towards
 * being published. An error is logged and turned into a message for the caller to show.
 * @param {object} args Arguments.
 * @param {UnpublishedEntry} args.entry Unpublished entry being edited.
 * @param {EntryDraftState} args.entryDraft Draft state of the editor.
 * @param {boolean} args.valid Whether the draft has passed the validation. The action isn’t run
 * otherwise.
 * @param {() => Promise<unknown>} args.action Action to run. It’s called synchronously, so it can
 * flag the action as under way before anything else gets in.
 * @param {string} args.failure I18n key of the message for a failure that has no more specific
 * message. See {@link getWorkflowErrorMessage}.
 * @param {boolean} [args.closeOnSuccess] Whether to close the editor once the action has succeeded,
 * as the entry has left the board, e.g. when it has been published.
 * @param {boolean} [args.handleAlreadyPublished] Whether to close the editor if the action fails
 * because the entry has been published since it was opened. See
 * {@link handleEntryAlreadyPublished}.
 * @returns {Promise<{ blocked: boolean, errorMessage: string | undefined }>} Outcome: whether the
 * action has been refused for the validation, and the localized message if it has failed.
 */
export const runWorkflowEditorAction = async ({
  entry,
  entryDraft,
  valid,
  action,
  failure,
  closeOnSuccess = false,
  handleAlreadyPublished = false,
}) => {
  if (!valid) {
    return { blocked: true, errorMessage: undefined };
  }

  // Read these up front: an entry that has been published leaves `unpublishedEntries`, and the
  // caller’s `entry` is typically derived from that store
  const { collectionName, pullRequest } = entry.workflow;
  const args = { entryDraft, branch: pullRequest.branch, collectionName };

  try {
    await action();

    if (closeOnSuccess) {
      closeWorkflowEntryEditor(args);
    }
  } catch (/** @type {any} */ ex) {
    // An entry published since it was opened closes the editor instead
    if (!handleAlreadyPublished || !handleEntryAlreadyPublished(ex, args)) {
      // eslint-disable-next-line no-console
      console.error(ex);

      return { blocked: false, errorMessage: getWorkflowErrorMessage(ex, failure) };
    }
  }

  return { blocked: false, errorMessage: undefined };
};
