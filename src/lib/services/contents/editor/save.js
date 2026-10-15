import { isCommitCancelled } from '$lib/services/backends/commit-prompt';
import { duplicateDraft } from '$lib/services/contents/draft/create/duplicate';
import { saveEntry } from '$lib/services/contents/draft/save';
import { validateDraft } from '$lib/services/contents/draft/validate';
import { countInvalidFields } from '$lib/services/contents/draft/validate/reveal';
import { awaitPendingFieldUpdates } from '$lib/services/contents/editor/pending';
import { getSaveFailure } from '$lib/services/contents/editor/toolbar';
import { encodePathSegments } from '$lib/services/utils/url';
import { publishWorkflowEntry, updateWorkflowStatus } from '$lib/services/workflow/save';
import { getEntryStage, getNextStage } from '$lib/services/workflow/stages';
import { getWorkflowErrorMessage } from '$lib/services/workflow/verify';

/**
 * @import { Entry, EntryDraft, UnpublishedEntry, WorkflowStatus } from '$lib/types/private';
 * @import { EntryConflict } from '$lib/services/contents/draft/save/conflict';
 * @import { EntryDraftState } from '$lib/services/contents/draft/state.svelte';
 */

/**
 * What came of saving the entry draft open in the editor, for the toolbar to act on.
 * @typedef {{ type: 'conflict', conflict: EntryConflict } | { type: 'skipped' } |
 * { type: 'saved', savedEntry: Entry, statusError?: string, path?: string,
 * next?: 'close' | 'reset' } | { type: 'invalid', errorCount: number } |
 * { type: 'error', message: string }} SaveOutcome
 * - `skipped`: nothing was saved, because the draft was closed or turned out to be unchanged, or
 * the user cancelled the commit when asked for a commit message.
 * - `saved`: the entry was saved. `statusError` is the message to show when it couldn’t be moved
 * to the next stage, or published after being saved to its pull request. `path` is the URL to
 * replace the `new` route with, for a new entry. `next` says whether to close the editor or reset
 * the draft; neither is done when another draft is now open.
 * - `invalid`: the draft has invalid fields, `errorCount` of them.
 * - `conflict`: someone else has changed the entry since it was opened; the user decides.
 * - `error`: the save failed, with the backend’s message if there is one.
 */

/**
 * Save the entry draft open in the editor, offering to move it to the next review stage afterwards,
 * or publishing it right away if asked, and work out
 * what the editor should do next. The Back button stays available during a save, so the user may
 * have closed the entry, or opened another one, by the time the commit has landed; the editor and
 * the URL then belong to that one and are left alone.
 * @param {object} args Arguments.
 * @param {EntryDraftState} args.entryDraft Entry draft state. Its `current` draft is saved.
 * @param {() => boolean} args.useWorkflow Function that tells whether the entry is saved to a pull
 * request. It’s called once the entry is saved.
 * @param {boolean} [args.skipCI] Whether to disable automatic deployments for the change.
 * @param {boolean} [args.overwrite] Whether to save over someone else’s change to the entry, once
 * the user has been asked.
 * @param {boolean} [args.publish] Whether to publish the entry along with the save, bypassing the
 * review: see the `direct_publish` publish mode option. An entry without a pull request is
 * committed straight to the configured branch, while one with a pull request is saved to it, which
 * is then merged.
 * @param {(stage: WorkflowStatus) => Promise<boolean>} args.askForReview Function that asks whether
 * the entry just saved should be moved to the given stage, e.g. handed over for review, resolving
 * to `true` if the user wants to move it.
 * @param {() => boolean} args.closeOnSave Function that tells whether the editor is to be closed
 * once the entry is saved.
 * @returns {Promise<SaveOutcome>} Outcome.
 */
export const saveEntryDraftFlow = async ({
  entryDraft,
  useWorkflow,
  skipCI = undefined,
  overwrite = false,
  publish = false,
  askForReview,
  closeOnSave,
}) => {
  const draft = /** @type {EntryDraft} */ (entryDraft.current);
  const { isNew, collection, collectionFile } = draft;
  /**
   * Check whether the draft being saved is still the one in the editor.
   * @returns {boolean} Result.
   */
  const isDraftOpen = () => entryDraft.current === draft;

  try {
    // A change still on its way to the draft enabled the button, but may turn out to change
    // nothing, e.g. a trailing space typed in a rich text editor
    await awaitPendingFieldUpdates();

    if (!isDraftOpen() || (!isNew && !entryDraft.modified)) {
      return { type: 'skipped' };
    }

    let savedEntry = await saveEntry({ draft, skipCI, overwrite, publish });
    const savedDraft = /** @type {UnpublishedEntry} */ (savedEntry);
    /** @type {string | undefined} */
    let statusError = undefined;

    // The entry already had a pull request, so the change went there; merging it is what publishes
    // the change, along with anything saved to the pull request earlier. This is done even when the
    // editor has been closed meanwhile, as the user has asked for it. A failed merge leaves the
    // entry saved as a draft, which is reported like a failed status change
    if (publish && savedDraft.workflow) {
      try {
        await publishWorkflowEntry(savedDraft);

        // The entry is now the published one, which the editor is reset to if it stays open
        const { workflow: _workflow, ...publishedEntry } = savedDraft;

        savedEntry = publishedEntry;
      } catch (/** @type {any} */ ex) {
        statusError = getWorkflowErrorMessage(ex, 'workflow.publishing_entry_failed');
        // eslint-disable-next-line no-console
        console.error(ex);
      }
    }

    if (!isDraftOpen()) {
      return { type: 'saved', savedEntry, statusError };
    }

    // Saving with a workflow leaves the entry as a draft, which nothing on screen says: it hasn’t
    // been handed to anyone yet, and the status menu that would do it is easy to miss. Offer it as
    // the next step instead, once, while the entry is still in the drafting stage. With Preview
    // Workflow, there’s no next stage: the entry can be published from the drafting stage
    const nextStage =
      !publish && useWorkflow() && savedDraft.workflow
        ? getNextStage(savedDraft, collection)
        : undefined;

    if (
      nextStage &&
      getEntryStage(savedDraft, collection) === 'draft' &&
      // An incomplete entry isn’t ready to be handed over; the status menu is still there once the
      // remaining fields have been filled in. Required fields aren’t enforced while an entry is a
      // draft, so it may have been saved with some of them empty. The check leaves the editor state
      // alone: nothing is wrong with the draft as saved, so no errors are shown for it
      validateDraft({ draft }).valid &&
      (await askForReview(nextStage))
    ) {
      try {
        await updateWorkflowStatus(savedDraft, nextStage);
      } catch (/** @type {any} */ ex) {
        statusError = getWorkflowErrorMessage(ex, 'workflow.status_change_failed');
        // eslint-disable-next-line no-console
        console.error(ex);
      }
    }

    if (!isDraftOpen()) {
      return { type: 'saved', savedEntry, statusError };
    }

    // Update the URL of a new entry. A collection file is addressed by its name, while its
    // `subPath` is the whole file path. This is done even when the editor is about to be closed, so
    // the `new` route doesn’t stay in the session history: moving forward from the entry list then
    // reopens the entry that was just created instead of a blank editor
    const path = isNew
      ? encodePathSegments(
          `/collections/${collection.name}/entries/${collectionFile?.name ?? savedEntry.subPath}`,
        )
      : undefined;

    // The entry itself is saved, so a failed status change leaves the editor open rather than
    // navigating away from something the user may want to retry from the status menu. Otherwise
    // the draft is reset: the next save compares the draft’s original entry with the branch, so
    // leaving the pre-save one in place would report the save that just landed as someone else’s
    // change to the entry
    const next = closeOnSave() && statusError === undefined ? 'close' : 'reset';

    return { type: 'saved', savedEntry, statusError, path, next };
  } catch (/** @type {any} */ ex) {
    // The user has dismissed the commit message prompt; the draft is left as it is to save again
    if (isCommitCancelled(ex)) {
      return { type: 'skipped' };
    }

    const failure = getSaveFailure(ex);

    if (failure.type === 'validation') {
      return { type: 'invalid', errorCount: countInvalidFields(draft.validities) };
    }

    if (failure.type === 'conflict') {
      // Saving over the change saves the draft in the editor, which may now be another one, so the
      // save is then only reported as failed
      return isDraftOpen()
        ? { type: 'conflict', conflict: failure.conflict }
        : { type: 'error', message: '' };
    }

    if (failure.unexpected) {
      // eslint-disable-next-line no-console
      console.error(ex);
    }

    return { type: 'error', message: failure.message };
  }
};

/**
 * Duplicate the entry draft open in the editor, replacing it with the duplicate. The original’s own
 * assets are copied along with the entry, so this can take a moment.
 * @param {EntryDraftState} entryDraft Entry draft state.
 * @returns {Promise<string | undefined>} Path of the editor for the duplicate, to replace the URL
 * with, or `undefined` if the editor was closed or given another draft meanwhile.
 */
export const duplicateEntryDraft = async (entryDraft) => {
  const { collectionName } = /** @type {EntryDraft} */ (entryDraft.current);

  return (await duplicateDraft(entryDraft)) ? `/collections/${collectionName}/new` : undefined;
};
