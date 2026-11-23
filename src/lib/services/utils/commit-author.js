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

/**
 * A `Co-authored-by` trailer line, with the name and the email.
 * @see https://docs.github.com/en/pull-requests/committing-changes-to-your-project/creating-and-editing-commits/creating-a-commit-with-multiple-authors
 */
const CO_AUTHOR_TRAILER_REGEX = /^Co-authored-by:[^\S\r\n]*([^<\r\n]+?)[^\S\r\n]*<([^<>\r\n]*)>/im;

/**
 * Get the person an app made a commit for, e.g. a Sveltia CMS Additions user whose changes are
 * committed by its GitHub App, which credits them in a `Co-authored-by` trailer. A commit an app
 * authors carries the app’s bot account name, e.g. `my-app[bot]`, which says nothing about who made
 * the change.
 * @param {{ name?: string | null } | null | undefined} author Commit author.
 * @param {string | null | undefined} message Commit message, or its body.
 * @returns {{ name: string, email: string } | undefined} The first co-author, if the commit was
 * authored by a bot and credits one.
 */
export const getBotCoAuthor = (author, message) => {
  if (!author?.name?.endsWith('[bot]')) {
    return undefined;
  }

  const [, name, email] = CO_AUTHOR_TRAILER_REGEX.exec(message ?? '') ?? [];

  return name ? { name, email } : undefined;
};
