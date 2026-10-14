import { backend } from '$lib/services/backends';
import { createBaseCommitMessage } from '$lib/services/backends/git/shared/commits';
import { toRepoChanges } from '$lib/services/backends/root-dir';
import { cmsConfig } from '$lib/services/config';
import { prefs } from '$lib/services/user/prefs.svelte';
import { createRawState } from '$lib/services/utils/state.svelte';

/**
 * @import {
 * CommitMessagePromptMode,
 * CommitMessageRequest,
 * CommitOptions,
 * FileChange,
 * } from '$lib/types/private';
 * @import { GitBackend } from '$lib/types/public';
 */

/**
 * Message of the error thrown when the user cancels a commit by dismissing the prompt.
 */
const COMMIT_CANCELLED = 'commit_cancelled';

/**
 * The pending request for a commit message, which the UI turns into a prompt dialog. It’s
 * `undefined` while no request is outstanding.
 * @type {{ current: CommitMessageRequest | undefined }}
 */
export const commitMessageRequest = createRawState();

/**
 * Text last entered in the prompt with the `prefix` or `suffix` mode. It’s typically an issue
 * number that the next few commits share, so the prompt starts with it. Kept for the session only.
 */
let lastAddition = '';

/**
 * Check if the given error has been thrown because the user cancelled a commit.
 * @param {any} ex Error.
 * @returns {boolean} Result.
 */
export const isCommitCancelled = (ex) => ex?.message === COMMIT_CANCELLED;

/**
 * Get how the user is asked for a commit message. The user is only asked when the changes are
 * actually committed: by a Git backend, or by the local backend with local Git commits turned on.
 * @returns {CommitMessagePromptMode | undefined} Mode, or `undefined` if the user isn’t asked.
 */
export const getCommitMessagePromptMode = () => {
  const { current: _cmsConfig } = cmsConfig;
  const { current: _backend } = backend;

  if (
    !_cmsConfig ||
    !_backend ||
    !(_backend.isGit || (_backend.name === 'local' && prefs.localGitCommits))
  ) {
    return undefined;
  }

  const { prompt_commit_messages: mode } = /** @type {GitBackend} */ (_cmsConfig.backend);

  return mode === true || mode === 'prefix' || mode === 'suffix' ? mode : undefined;
};

/**
 * Ask the user for a commit message, and wait for the answer.
 * @param {object} args Arguments.
 * @param {CommitMessagePromptMode} args.mode How the text the user enters is used.
 * @param {string} args.defaultMessage Message made from the template.
 * @returns {Promise<string | null>} Text entered, or `null` if the user has cancelled.
 */
const requestCommitMessage = async ({ mode, defaultMessage }) => {
  // Saves are made one at a time, so a second request can’t normally be outstanding, but be
  // defensive: leaving an earlier request unresolved would hang that save forever
  commitMessageRequest.current?.respond(null);

  return new Promise((resolve) => {
    /** @type {CommitMessageRequest} */
    const request = {
      mode,
      defaultMessage,
      initialValue: mode === true ? defaultMessage : lastAddition,
      /**
       * Answer the request.
       * @param {string | null} message Text entered, or `null` if the user has cancelled.
       */
      respond: (message) => {
        // Only take down the dialog that belongs to this request, so answering a stale one can’t
        // dismiss a newer one. Resolving an already settled promise does nothing
        if (commitMessageRequest.current === request) {
          commitMessageRequest.current = undefined;
        }

        resolve(message);
      },
    };

    commitMessageRequest.current = request;
  });
};

/**
 * Ask the user for a commit message if the `prompt_commit_messages` backend option is set, and add
 * the answer to the commit options. Nothing is asked if the options already have one, e.g. when the
 * same answer is used for several commits.
 * @param {FileChange[]} changes Changes to be committed, with paths relative to the root directory.
 * @param {CommitOptions} options Commit options.
 * @returns {Promise<CommitOptions>} Commit options, with the user’s message if asked.
 * @throws {Error} When the user has cancelled the commit. Use {@link isCommitCancelled} to tell it
 * from a failure.
 */
export const promptCommitMessage = async (changes, options) => {
  const mode = getCommitMessagePromptMode();

  if (!mode || options.userMessage !== undefined) {
    return options;
  }

  // The commit message names the paths relative to the repository root
  const defaultMessage = createBaseCommitMessage(toRepoChanges(changes), options);
  const message = await requestCommitMessage({ mode, defaultMessage });

  if (message === null) {
    throw new Error(COMMIT_CANCELLED);
  }

  let userMessage = message.trim();

  if (mode === true) {
    // An unchanged message is made from the template again when committing, which can then tell
    // the files apart more accurately, e.g. when several entries are stored in the same file
    if (userMessage === defaultMessage) {
      userMessage = '';
    }
  } else {
    lastAddition = userMessage;
  }

  return { ...options, userMessage };
};
