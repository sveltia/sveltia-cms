import { tick } from 'svelte';

import { assetCommitToast } from '$lib/services/assets/data';
import { runCommit } from '$lib/services/backends/commit-prompt';

/**
 * Progress messages of the commits under way, in the order they started. The toast shows the
 * latest one still running, so a commit finishing doesn’t leave its message up for another.
 * @type {string[]}
 */
const runningMessages = [];

/**
 * Run an action that commits changes to assets, or otherwise saves them, and report how it goes
 * through {@link assetCommitToast}: a progress toast while it’s under way, if a message is given,
 * as committing to a remote repository takes a few seconds and the dialog that started it is
 * usually gone by then, and a failure toast if it fails. A cancellation at the commit message
 * prompt isn’t a failure. A success is reported by the action itself, through `assetUpdatesToast`.
 * @template T
 * @param {() => Promise<T>} action Action to run.
 * @param {object} messages Message keys.
 * @param {string} [messages.progress] Progress message, if any.
 * @param {string} messages.failure Failure message.
 * @returns {ReturnType<typeof runCommit<T>>} Outcome, as returned by `runCommit()`.
 */
export const runAssetCommit = async (action, { progress, failure }) => {
  if (progress) {
    runningMessages.push(progress);
    Object.assign(assetCommitToast.current, { progress, pending: runningMessages.length });
  }

  const outcome = await runCommit(action);

  if (progress) {
    runningMessages.splice(runningMessages.indexOf(progress), 1);
    assetCommitToast.current.pending = runningMessages.length;

    if (runningMessages.length) {
      assetCommitToast.current.progress = /** @type {string} */ (runningMessages.at(-1));
    }
  }

  if (!outcome.ok && !outcome.cancelled) {
    // Hide a failure toast that’s still up first, so the new one gets its full display time
    if (assetCommitToast.current.failed) {
      assetCommitToast.current.failed = false;
      await tick();
    }

    Object.assign(assetCommitToast.current, { failure, failed: true });
  }

  return outcome;
};
