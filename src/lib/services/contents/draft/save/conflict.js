import { _ } from '@sveltia/i18n';
import equal from 'fast-deep-equal';

import { checkForRemoteChanges } from '$lib/services/backends/refresh';
import { allEntries } from '$lib/services/contents';
import { formatDate } from '$lib/services/utils/date';

/**
 * @import { Entry, EntryDraft } from '$lib/types/private';
 */

/**
 * What stands in the way of saving a draft: the entry it was made from is no longer what’s on the
 * branch.
 * @typedef {object} EntryConflict
 * @property {'modified' | 'deleted'} type Whether the entry has been changed or removed by someone
 * else since the draft was opened.
 * @property {Entry} [entry] The entry as it is on the branch now, with the commit author and date
 * when known. Only for a modified entry.
 */

/**
 * Compare the draft’s original entry with the one in the store to tell whether the entry has been
 * changed since the draft was opened.
 * @param {Entry} originalEntry Entry the draft was made from.
 * @returns {EntryConflict | undefined} The conflict, if any.
 */
export const compareWithStore = (originalEntry) => {
  const current = allEntries.current.find(({ id }) => id === originalEntry.id);

  if (!current) {
    return { type: 'deleted' };
  }

  // The parsed content is compared rather than the file, so a commit that rewrote the file without
  // changing what it says doesn’t count. A locale file added or removed does
  if (!equal(current.locales, originalEntry.locales)) {
    return { type: 'modified', entry: current };
  }

  return undefined;
};

/**
 * Find out whether saving the draft would overwrite someone else’s change: the repository is
 * checked for commits made since the site data was loaded, and the entry the draft was made from is
 * then compared with the entry as it is now. The check is only about an existing entry on the
 * configured branch; a new entry has nothing to overwrite, and an Editorial Workflow draft is saved
 * to its own branch.
 *
 * If the repository can’t be reached, the comparison is still made against what’s known, and the
 * commit that follows is left to fail on its own if the backend is really down.
 * @param {EntryDraft} draft Draft about to be saved.
 * @returns {Promise<EntryConflict | undefined>} The conflict, if any.
 */
export const detectEntryConflict = async (draft) => {
  const { isNew, originalEntry } = draft;

  if (isNew || !originalEntry) {
    return undefined;
  }

  try {
    await checkForRemoteChanges();
  } catch (ex) {
    // eslint-disable-next-line no-console
    console.error('Failed to check the repository for changes.', ex);
  }

  return compareWithStore(originalEntry);
};

/**
 * Put the conflict into words for the user.
 * @param {EntryConflict} conflict Conflict.
 * @param {string} [locale] Locale to format the date in.
 * @returns {{ description: string, warning: string }} What happened, and what saving would do.
 */
export const describeConflict = ({ type, entry }, locale) => {
  if (type === 'deleted') {
    return {
      description: _('save_conflict.deleted'),
      warning: _('save_conflict.recreate_warning'),
    };
  }

  // A modified entry always comes with its current version
  const { commitAuthor, commitDate } = /** @type {Entry} */ (entry);
  const name = commitAuthor?.name || commitAuthor?.login || commitAuthor?.email;

  return {
    // Not every backend reports who made a commit along with the file
    description:
      name && commitDate
        ? _('save_conflict.modified_by', {
            values: { name, date: formatDate(commitDate, locale) },
          })
        : _('save_conflict.modified'),
    warning: _('save_conflict.overwrite_warning'),
  };
};
