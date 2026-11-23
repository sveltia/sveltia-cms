import { fetchWithSession } from '$lib/services/additions/session-api';
import { onSocketMessage } from '$lib/services/additions/socket.svelte';
import { user } from '$lib/services/user/account.svelte';
import { createGeneration } from '$lib/services/utils/generation';

/**
 * @import { ConversationItem } from '$lib/types/private';
 */

/**
 * A comment as Sveltia CMS Additions returns it.
 * @typedef {object} AdditionsComment
 * @property {string} id ID.
 * @property {string} key Entry key.
 * @property {string} body Markdown.
 * @property {{ id: string, name: string, username: string, image: string | null } | null} author
 * Author, or `null` once deleted.
 * @property {string} created_at Creation date.
 * @property {string} updated_at Last edit date.
 * @property {boolean} can_edit Whether the signed-in user can edit it.
 * @property {boolean} can_delete Whether the signed-in user can delete it.
 */

/**
 * Comment counts and change notices, kept up to date over the socket.
 */
export const additionsComments = $state({
  /**
   * Number of comments by entry key, for the badge of the conversation panel.
   * @type {Record<string, number>}
   */
  counts: {},
  /**
   * Number of changes announced by entry key, so an open panel can load the comments again.
   * @type {Record<string, number>}
   */
  versions: {},
});

/**
 * Generation of the counts, which is bumped once they’ve been forgotten, so a request still in
 * flight when the user signs out doesn’t bring them back.
 */
const generation = createGeneration();
/**
 * Whether the counts of every entry have been loaded, so an entry missing from them has none.
 */
let countsLoaded = false;

/**
 * Turn a comment into a conversation item.
 * @param {AdditionsComment} comment Comment.
 * @returns {ConversationItem} Item.
 */
const toItem = (comment) => ({
  id: comment.id,
  body: comment.body,
  author: comment.author
    ? {
        name: comment.author.name,
        login: comment.author.username,
        isSelf: comment.author.username === user.account?.login,
      }
    : null,
  createdDate: new Date(comment.created_at),
  updatedDate: new Date(comment.updated_at),
  canEdit: comment.can_edit,
  canDelete: comment.can_delete,
});

/**
 * Fetch the comments on an entry, the latest first: the service returns them a page at a time.
 * @param {string} key Entry key.
 * @param {object} [options] Options.
 * @param {string} [options.before] ID of the oldest comment loaded so far, to fetch the page of
 * comments older than it.
 * @returns {Promise<{ items: ConversationItem[], hasMore: boolean }>} Comments, oldest first, and
 * whether there are older ones than those returned.
 */
export const fetchComments = async (key, { before } = {}) => {
  const isCurrent = generation.capture();

  const { comments, has_more: hasMore } = await fetchWithSession(
    `/v1/comments?key=${encodeURIComponent(key)}${
      before ? `&before=${encodeURIComponent(before)}` : ''
    }`,
  );

  // With older comments left out, the count isn’t known here. Nor is it for a user who has signed
  // out in the meantime
  if (!before && !hasMore && isCurrent()) {
    additionsComments.counts[key] = comments.length;
  }

  return { items: comments.map(toItem), hasMore };
};

/**
 * Load how many comments each entry has, for the badges.
 * @returns {Promise<void>}
 */
export const loadCommentCounts = async () => {
  const isCurrent = generation.capture();

  try {
    const { counts } = await fetchWithSession('/v1/comments/counts');

    if (isCurrent()) {
      additionsComments.counts = counts;
      countsLoaded = true;
    }
  } catch {
    // The badges just stay empty
  }
};

/**
 * Add a comment to an entry.
 * @param {string} key Entry key.
 * @param {string} body Markdown.
 * @returns {Promise<ConversationItem>} Comment.
 * @throws {Error} When the service refuses it.
 */
export const addComment = async (key, body) =>
  toItem((await fetchWithSession('/v1/comments', { method: 'POST', body: { key, body } })).comment);

/**
 * Edit a comment.
 * @param {string} id Comment ID.
 * @param {string} body Markdown.
 * @returns {Promise<ConversationItem>} Comment.
 * @throws {Error} When the service refuses it, e.g. as the user isn’t the author.
 */
export const editComment = async (id, body) =>
  toItem(
    (
      await fetchWithSession(`/v1/comments/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: { body },
      })
    ).comment,
  );

/**
 * Delete a comment.
 * @param {string} id Comment ID.
 * @returns {Promise<void>}
 * @throws {Error} When the service refuses it.
 */
export const deleteComment = async (id) => {
  await fetchWithSession(`/v1/comments/${encodeURIComponent(id)}`, { method: 'DELETE' });
};

/**
 * Tidy up an entry’s comments once the entry has been renamed or deleted, unless it’s known to have
 * none: the counts may not have been loaded, e.g. while the service can’t be reached. A failure is
 * ignored, as it leaves the comments where they were, and the save has been done.
 * @param {string} key Entry key.
 * @param {string} path Request path.
 * @param {{ method: string, body?: Record<string, any> }} options Request options.
 * @returns {Promise<void>}
 */
const tidyEntryComments = async (key, path, options) => {
  if (countsLoaded && !additionsComments.counts[key]) {
    return;
  }

  try {
    await fetchWithSession(path, options);
  } catch {
    //
  }
};

/**
 * Move an entry’s comments to its new key once a rename has been saved. Failures are ignored: the
 * comments stay under the previous key, where nothing is lost.
 * @param {string} from Previous key.
 * @param {string} to New key.
 * @returns {Promise<void>}
 */
export const moveEntryComments = async (from, to) => {
  if (from !== to) {
    await tidyEntryComments(from, '/v1/comments/rename', { method: 'POST', body: { from, to } });
  }
};

/**
 * Delete an entry’s comments once the entry has been deleted. Failures are ignored.
 * @param {string} key Entry key.
 * @returns {Promise<void>}
 */
export const deleteEntryComments = async (key) => {
  await tidyEntryComments(key, `/v1/comments?key=${encodeURIComponent(key)}`, {
    method: 'DELETE',
  });
};

/**
 * Keep the comment counts and change notices up to date for as long as the user is signed in. The
 * socket itself is opened with the locks.
 * @returns {() => void} Function to forget them once the user signs out, so the next user doesn’t
 * see them.
 */
export const startComments = () => {
  // Another tab, or another user, has changed an entry’s comments
  onSocketMessage('comments', ({ key, count }) => {
    additionsComments.counts[key] = count;
    additionsComments.versions[key] = (additionsComments.versions[key] ?? 0) + 1;
  });

  // Catch up with what happened while the socket was down
  onSocketMessage('connected', () => {
    loadCommentCounts();
  });

  return () => {
    generation.bump();
    countsLoaded = false;
    Object.assign(additionsComments, { counts: {}, versions: {} });
  };
};
