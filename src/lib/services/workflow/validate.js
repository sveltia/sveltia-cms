import { getCollection } from '$lib/services/contents/collection';
import { getCollectionFile } from '$lib/services/contents/collection/files';
import { buildDraft } from '$lib/services/contents/draft/create';
import { validateDraft, validateEntry } from '$lib/services/contents/draft/validate';
import { expandInvalidFields } from '$lib/services/contents/editor/fields';

/**
 * @import { EntryDraft, UnpublishedEntry } from '$lib/types/private';
 */

/**
 * Check that the given unpublished entry is complete before it moves out of the drafting stage.
 * Required fields aren’t enforced while an entry is a draft, so an incomplete entry has to be
 * caught here instead: handing it over for review, marking it ready and publishing it are all steps
 * towards putting it on the site.
 *
 * The entry may be open in the editor, in which case the values being edited are what’s checked,
 * and the invalid fields are expanded to show the errors just as a failed save does. Otherwise —
 * the Editorial Workflow board — a throwaway draft is built from the entry’s saved content, leaving
 * the editor state alone.
 * @param {object} args Arguments.
 * @param {UnpublishedEntry} args.entry Entry to check.
 * @param {EntryDraft | null} [args.draft] Draft open in the editor, if any.
 * @returns {boolean} Whether the entry can move on. An entry whose collection is no longer
 * configured can’t be checked against anything, so it’s left alone.
 * @see https://github.com/decaporg/decap-cms/issues/464
 */
export const validateWorkflowEntry = ({ entry, draft }) => {
  if (draft?.originalEntry?.id === entry.id) {
    if (validateEntry({ draft })) {
      return true;
    }

    expandInvalidFields({ draft });

    return false;
  }

  const { collectionName, fileName } = entry.workflow;
  const collection = getCollection(collectionName);

  const collectionFile =
    collection && fileName ? getCollectionFile(collection, fileName) : undefined;

  if (!collection || (fileName && !collectionFile)) {
    return true;
  }

  return validateDraft({ draft: buildDraft({ collection, collectionFile, originalEntry: entry }) })
    .valid;
};
