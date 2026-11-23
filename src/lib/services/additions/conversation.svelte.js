import {
  addComment,
  additionsComments,
  deleteComment,
  editComment,
  fetchComments,
  moveEntryComments,
} from '$lib/services/additions/comments.svelte';
import { getConversationAliasKeys } from '$lib/services/additions/conversation-aliases';
import { getRequestErrorMessage } from '$lib/services/additions/task.svelte';
import { getDraftEntryKey } from '$lib/services/contents/entry/entry-key';
import { createGeneration } from '$lib/services/utils/generation';

/**
 * @import { ConversationItem, EntryDraft } from '$lib/types/private';
 */

/**
 * State of an entry’s conversation.
 * @typedef {object} ConversationState
 * @property {boolean} loading Whether it’s being loaded.
 * @property {boolean} loaded Whether it has been loaded at least once.
 * @property {string} error Why it couldn’t be loaded, if it couldn’t.
 * @property {ConversationItem[]} comments Comments, oldest first.
 * @property {boolean} hasMore Whether there are older comments than those loaded.
 * @property {string} [oldestId] ID of the oldest comment loaded under the entry’s own key, which
 * older ones are loaded from, rather than one kept under an earlier key, which may be older still.
 */

/**
 * Conversations by entry key, and the unsent text of each.
 */
export const conversations = $state({
  /** @type {Record<string, ConversationState>} */
  entries: {},
  /**
   * Comments being written, by entry key. They stay until sent, while the editor is open.
   * @type {Record<string, string>}
   */
  drafts: {},
});

/**
 * Generation of the conversations, which is bumped once they’ve been forgotten, so a request still
 * in flight when the user signs out doesn’t bring back what it was about.
 */
const generation = createGeneration();
/**
 * Number of loads started and of changes made, by entry key. A load only shows its comments if no
 * other load has started since, and no comment has been added, edited or deleted here meanwhile,
 * which it may have missed: the change is announced over the socket, which loads them again.
 * @type {Map<string, { loads: number, changes: number }>}
 */
// eslint-disable-next-line svelte/prefer-svelte-reactivity
const sequences = new Map();

/**
 * Get the load and change numbers of an entry’s conversation.
 * @param {string} key Entry key.
 * @returns {{ loads: number, changes: number }} Numbers.
 */
const getSequence = (key) => {
  if (!sequences.has(key)) {
    sequences.set(key, { loads: 0, changes: 0 });
  }

  return /** @type {{ loads: number, changes: number }} */ (sequences.get(key));
};

/**
 * Get the number of comments to show on the panel’s tab, including those still kept under the
 * entry’s earlier keys; see {@link getConversationAliasKeys}.
 * @param {EntryDraft | null | undefined} draft Entry draft.
 * @returns {number} Count.
 */
export const getConversationCount = (draft) => {
  const key = getDraftEntryKey(draft);

  return key
    ? [key, ...getConversationAliasKeys(draft)].reduce(
        (total, eachKey) => total + (additionsComments.counts[eachKey] ?? 0),
        0,
      )
    : 0;
};

/**
 * Get the state of an entry’s conversation, creating it if needed.
 * @param {string} key Entry key.
 * @returns {ConversationState} State.
 */
const getState = (key) => {
  conversations.entries[key] ??= {
    loading: false,
    loaded: false,
    error: '',
    comments: [],
    hasMore: false,
  };

  return conversations.entries[key];
};

/**
 * Load the comments on an entry. On failure, those loaded before stay.
 * @param {string} key Entry key.
 * @param {string[]} [aliasKeys] Keys the entry’s comments are still kept under from before it was
 * renamed, whose comments are shown along with its own; see {@link getConversationAliasKeys}. Only
 * the latest page of each is loaded, and older comments only under the entry’s own key.
 * @returns {Promise<void>}
 */
export const loadConversation = async (key, aliasKeys = []) => {
  const isCurrent = generation.capture();
  const sequence = getSequence(key);

  sequence.loads += 1;

  const load = sequence.loads;
  const { changes } = sequence;
  /** @type {Partial<ConversationState>} */
  let result;

  getState(key).loading = true;

  try {
    const [{ items, hasMore }, ...earlier] = await Promise.all(
      [key, ...aliasKeys].map((eachKey) => fetchComments(eachKey)),
    );

    result = {
      oldestId: items[0]?.id,
      comments: earlier.length
        ? [...items, ...earlier.flatMap((page) => page.items)].sort(
            (a, b) => a.createdDate.getTime() - b.createdDate.getTime(),
          )
        : items,
      hasMore,
      error: '',
    };
  } catch (/** @type {any} */ ex) {
    result = { error: getRequestErrorMessage(ex) };
  }

  // A newer load is on its way, or the user has signed out
  if (!isCurrent() || sequence.loads !== load) {
    return;
  }

  Object.assign(getState(key), {
    // Missing a change made here since the load started
    ...(sequence.changes === changes ? result : {}),
    loading: false,
    loaded: true,
  });
};

/**
 * Load the comments older than those shown, which the service leaves out of a long conversation.
 * @param {string} key Entry key.
 * @returns {Promise<void>}
 * @throws {Error} When they can’t be loaded.
 */
export const loadOlderComments = async (key) => {
  const isCurrent = generation.capture();
  const { oldestId } = getState(key);

  if (!oldestId) {
    return;
  }

  const { items, hasMore } = await fetchComments(key, { before: oldestId });

  if (!isCurrent()) {
    return;
  }

  const state = getState(key);
  // eslint-disable-next-line svelte/prefer-svelte-reactivity
  const shownIds = new Set(state.comments.map(({ id }) => id));

  Object.assign(state, {
    comments: [...items.filter(({ id }) => !shownIds.has(id)), ...state.comments].sort(
      (a, b) => a.createdDate.getTime() - b.createdDate.getTime(),
    ),
    hasMore,
    oldestId: items[0]?.id ?? oldestId,
  });
};

/**
 * Note that a comment has been added, edited or deleted here, so a load that started before it
 * doesn’t undo it. Nothing is changed for a user who has signed out in the meantime.
 * @param {string} key Entry key.
 * @param {() => boolean} isCurrent Function that tells whether the generation the change was sent
 * in is still current.
 * @returns {ConversationState | undefined} State to change, if any.
 */
const getChangedState = (key, isCurrent) => {
  if (!isCurrent()) {
    return undefined;
  }

  getSequence(key).changes += 1;

  return getState(key);
};

/**
 * Send the comment being written on an entry.
 * @param {string} key Entry key.
 * @returns {Promise<void>}
 * @throws {Error} When the service refuses it.
 */
export const sendComment = async (key) => {
  const body = conversations.drafts[key] ?? '';

  if (!body.trim()) {
    return;
  }

  const isCurrent = generation.capture();
  const comment = await addComment(key, body);
  const state = getChangedState(key, isCurrent);

  if (state) {
    state.comments = [...state.comments, comment];

    // What has been typed since the comment was sent is kept
    if (conversations.drafts[key] === body) {
      conversations.drafts[key] = '';
    }
  }
};

/**
 * Edit a comment of the user’s.
 * @param {string} key Entry key.
 * @param {string} id Comment ID.
 * @param {string} body New Markdown.
 * @returns {Promise<void>}
 * @throws {Error} When the service refuses it.
 */
export const updateComment = async (key, id, body) => {
  const isCurrent = generation.capture();
  const comment = await editComment(id, body);
  const state = getChangedState(key, isCurrent);

  if (state) {
    state.comments = state.comments.map((item) => (item.id === id ? comment : item));
  }
};

/**
 * Delete a comment.
 * @param {string} key Entry key.
 * @param {string} id Comment ID.
 * @returns {Promise<void>}
 * @throws {Error} When the service refuses it.
 */
export const removeComment = async (key, id) => {
  const isCurrent = generation.capture();

  await deleteComment(id);

  const state = getChangedState(key, isCurrent);

  if (state) {
    state.comments = state.comments.filter((item) => item.id !== id);
  }
};

/**
 * Move an entry’s conversation to its new key once a rename has been saved: the comment being
 * written, which the editor, still open, now looks up by the new key, and the comments themselves.
 * @param {string} from Previous key.
 * @param {string} to New key.
 * @returns {Promise<void>}
 */
export const moveEntryConversation = async (from, to) => {
  if (from !== to && conversations.drafts[from]) {
    conversations.drafts[to] ||= conversations.drafts[from];
    delete conversations.drafts[from];
  }

  await moveEntryComments(from, to);
};

/**
 * Keep the conversations for as long as the user is signed in. Whoever signs in next, maybe on the
 * same tab, gets neither the comments loaded for the previous user, with what that user could edit,
 * nor the comments they were writing.
 * @returns {() => void} Function that forgets them.
 */
export const startConversations = () => () => {
  generation.bump();
  sequences.clear();
  Object.assign(conversations, { entries: {}, drafts: {} });
};
