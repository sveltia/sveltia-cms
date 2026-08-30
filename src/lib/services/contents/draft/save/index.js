import { get } from 'svelte/store';

import { callEventHooks } from '$lib/services/api/events';
import { skipCIConfigured, skipCIEnabled } from '$lib/services/backends/git/shared/integration';
import { saveChanges } from '$lib/services/backends/save';
import {
  contentUpdatesToast,
  UPDATE_TOAST_DEFAULT_STATE,
} from '$lib/services/contents/collection/data';
import { getEntriesByCollection } from '$lib/services/contents/collection/entries';
import { getOrderFieldKey } from '$lib/services/contents/collection/entries/reorder';
import { entryDraft } from '$lib/services/contents/draft';
import { deleteBackup } from '$lib/services/contents/draft/backup';
import { createSavingEntryData } from '$lib/services/contents/draft/save/changes';
import { getSlugs } from '$lib/services/contents/draft/slugs';
import { validateEntry } from '$lib/services/contents/draft/validate';
import { awaitCustomFieldValidations } from '$lib/services/contents/draft/validate/custom-fields';
import { expandInvalidFields } from '$lib/services/contents/editor/fields';
import { clearEntryHistoryCache } from '$lib/services/contents/entry/history';
import { buildCascadeChanges } from '$lib/services/contents/entry/relations/cascade';
import { setLastCommitPublishHint } from '$lib/services/deployments/publish';
import { workflowEnabled } from '$lib/services/workflow';
import { saveWorkflowChanges } from '$lib/services/workflow/save';

/**
 * @import { ChangeResults, CommitOptions, Entry, EntryDraft } from '$lib/types/private';
 */

/**
 * Update the application stores with deployment settings.
 * @param {object} args Arguments.
 * @param {boolean | undefined} args.skipCI Whether to disable automatic deployments for the change.
 * @param {number} args.count Number of entries saved, including any entry rewritten to keep its
 * references to the saved entry up to date.
 */
const updateStores = ({ skipCI, count }) => {
  // With Editorial Workflow, changes go to a pull request, so nothing is published yet
  const published =
    !get(workflowEnabled) && get(skipCIConfigured) && !(skipCI ?? get(skipCIEnabled));

  contentUpdatesToast.set({
    ...UPDATE_TOAST_DEFAULT_STATE,
    saved: true,
    published,
    count,
  });

  setLastCommitPublishHint(published);
};

/**
 * For new entries in reorder-enabled entry collections, assign a fresh manual sort order to the
 * draft’s current values: highest existing order + 1, or 1 if no entries have one yet. Doing this
 * at save time (rather than draft creation) makes the assignment race-safe even when a draft has
 * been backed up and restored after another entry took the previously computed value. Callers must
 * gate on `draft.isNew` and `draft.collection._type === 'entry'` themselves.
 * @param {EntryDraft} draft Draft to mutate in place.
 */
const assignManualSortOrder = (draft) => {
  const { collection, collectionFile, currentValues } = draft;
  const orderKey = getOrderFieldKey(collection);

  if (!orderKey) {
    return;
  }

  const { defaultLocale } = (collectionFile ?? collection)._i18n;

  const maxOrder = getEntriesByCollection(collection.name).reduce((max, entry) => {
    const value = Number(entry.locales[defaultLocale]?.content?.[orderKey]);

    return Number.isFinite(value) && value > max ? value : max;
  }, 0);

  const nextOrder = maxOrder + 1;

  Object.values(currentValues).forEach((valueMap) => {
    valueMap[orderKey] = nextOrder;
  });
};

/**
 * Save the entry draft.
 * @param {object} [options] Options.
 * @param {boolean} [options.skipCI] Whether to disable automatic deployments for the change.
 * @returns {Promise<Entry>} Saved entry.
 * @throws {Error} When the entry could not be validated or saved.
 */
export const saveEntry = async ({ skipCI = undefined } = {}) => {
  const draft = /** @type {EntryDraft} */ (get(entryDraft));
  const { isNew, collection, collectionName, fileName, currentValues, originalEntry } = draft;

  // Custom field validators can be async, so wait for any in-flight results before validating.
  // Otherwise a field made invalid moments ago would be validated against a stale verdict.
  await awaitCustomFieldValidations();

  if (!validateEntry()) {
    expandInvalidFields({ collectionName, fileName, currentValues });

    throw new Error('validation_failed');
  }

  if (isNew && collection._type === 'entry') {
    assignManualSortOrder(draft);
  }

  const slugs = getSlugs({ draft });
  const { defaultLocaleSlug } = slugs;
  const { savingEntry, changes, savingAssets } = await createSavingEntryData({ draft, slugs });

  // When the slug has been edited, the entries referencing this one through a Relation field have
  // to be rewritten in the same commit, or they would be left pointing at an entry that no longer
  // exists under that name
  const { changes: cascadeChanges, savingEntries: cascadeEntries } = await buildCascadeChanges({
    collection,
    collectionFile: draft.collectionFile,
    originalEntry,
    savingEntry,
  });

  changes.push(...cascadeChanges);

  /** @type {ChangeResults} */
  let results;
  /** @type {CommitOptions} */
  const options = { commitType: isNew ? 'create' : 'update', collection, skipCI };

  try {
    results = get(workflowEnabled)
      ? await saveWorkflowChanges({
          changes,
          savingEntry,
          savingAssets,
          options,
          collectionName,
          fileName,
          slug: defaultLocaleSlug,
          originalEntry,
        })
      : await saveChanges({
          changes,
          savingEntries: [savingEntry, ...cascadeEntries],
          savingAssets,
          options,
        });
  } catch (/** @type {any} */ ex) {
    // eslint-disable-next-line no-console
    console.error(ex.cause ?? ex);

    throw new Error('saving_failed', { cause: ex.cause ?? ex });
  }

  await callEventHooks({
    type: 'postSave',
    entry: savingEntry,
    collection,
    collectionFile: draft.collectionFile,
    isNew,
  });

  updateStores({ skipCI, count: 1 + cascadeEntries.length });
  deleteBackup(collectionName, isNew ? '' : defaultLocaleSlug);

  if (originalEntry) {
    clearEntryHistoryCache(originalEntry.id);
  }

  return results.savedEntries[0];
};
