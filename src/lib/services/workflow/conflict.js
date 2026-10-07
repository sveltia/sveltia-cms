import equal from 'fast-deep-equal';

import { backend } from '$lib/services/backends';
import { getUnpublishedEntryByDraft } from '$lib/services/workflow';
import { loadUnpublishedEntries } from '$lib/services/workflow/load';

/**
 * @import { EntryDraft, UnpublishedEntry } from '$lib/types/private';
 * @import { EntryConflict } from '$lib/services/contents/draft/save/conflict';
 */

/**
 * Find out whether saving the given workflow draft would overwrite someone else’s change. An
 * entry’s branch is named after the entry, not the editor, so two people working on the same entry
 * share it, and a save goes on top of whatever the branch holds — including a commit made from
 * another tab, from the Git service, or by a colleague who opened the same entry.
 *
 * The branch head is a small request, and only a branch that has moved since this draft’s own last
 * commit costs the reload that reads the entry back. A draft with no pull request yet has nothing
 * to overwrite, as the branch doesn’t exist. If the branch can’t be read, the comparison is
 * skipped and the commit that follows is left to fail on its own if the backend is really down.
 * @param {EntryDraft} draft Draft about to be saved.
 * @returns {Promise<EntryConflict | undefined>} The conflict, if any.
 */
export const detectWorkflowConflict = async (draft) => {
  const { isNew, originalEntry, collectionName, fileName } = draft;

  const { branch, headSHA } =
    /** @type {UnpublishedEntry | undefined} */ (originalEntry)?.workflow?.pullRequest ?? {};

  const workflow = backend.current?.workflow;

  // Without a head on record there’s nothing to compare, so the save goes ahead rather than
  // reporting a conflict it can’t describe
  if (isNew || !originalEntry || !branch || !headSHA || !workflow) {
    return undefined;
  }

  /** @type {string | undefined} */
  let head;

  try {
    head = await workflow.fetchBranchHead(branch);
  } catch (ex) {
    // eslint-disable-next-line no-console
    console.error('Failed to check the workflow branch for changes.', ex);

    return undefined;
  }

  if (head === headSHA) {
    return undefined;
  }

  // The branch is gone, which is what a pull request merged or closed outside the CMS leaves
  // behind. That’s a separate known issue — such a pull request stays on the board until the next
  // reload, and saving it fails on the missing branch — so it’s left as it is rather than reported
  // here as a change to save over
  if (!head) {
    return undefined;
  }

  const canOverwrite = originalEntry.arrayIndex === undefined;

  // The branch has moved, so read the entry back from it. The reload swallows its own failures,
  // which leaves the stores as they were and the comparison below with nothing to report
  await loadUnpublishedEntries();

  const current = getUnpublishedEntryByDraft({ collectionName, fileName, originalEntry });

  if (!current) {
    return { type: 'deleted', canOverwrite };
  }

  // The parsed content is compared rather than the file, so a commit that rewrote the file without
  // changing what it says doesn’t count — nor does one that only touched the entry’s assets
  if (!equal(current.locales, originalEntry.locales)) {
    return { type: 'modified', entry: current, canOverwrite };
  }

  return undefined;
};
