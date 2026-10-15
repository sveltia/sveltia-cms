/**
 * @import { CommitAuthor } from '$lib/types/private';
 */

/**
 * Get the name to show for the author of a commit: the displayed name, falling back to the account
 * name and then the email address.
 * @param {Partial<CommitAuthor> | undefined} author Commit author.
 * @returns {string | undefined} Name, which is empty or `undefined` if the author has none.
 */
export const getCommitAuthorName = (author) => author?.name || author?.login || author?.email;
