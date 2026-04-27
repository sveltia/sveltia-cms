import { get } from 'svelte/store';

import { isLastCommitPublished } from '$lib/services/backends';
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
import { callEventHooks } from '$lib/services/contents/draft/events';
import { createSavingEntryData } from '$lib/services/contents/draft/save/changes';
import { getSlugs } from '$lib/services/contents/draft/slugs';
import { validateEntry } from '$lib/services/contents/draft/validate';
import { expandInvalidFields } from '$lib/services/contents/editor/expanders';
import { clearEntryHistoryCache } from '$lib/services/contents/entry/history';

/**
 * @import { ChangeResults, Entry, EntryDraft } from '$lib/types/private';
 */

/**
 * Update the application stores with deployment settings.
 * @param {object} args Arguments.
 * @param {boolean | undefined} args.skipCI Whether to disable automatic deployments for the change.
 */
const updateStores = ({ skipCI }) => {
  const published = get(skipCIConfigured) && !(skipCI ?? get(skipCIEnabled));

  contentUpdatesToast.set({
    ...UPDATE_TOAST_DEFAULT_STATE,
    saved: true,
    published,
    count: 1,
  });

  isLastCommitPublished.set(published);
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
  /** @type {ChangeResults} */
  let results;

  try {
    results = await saveChanges({
      changes,
      savingEntries: [savingEntry],
      savingAssets,
      options: {
        commitType: isNew ? 'create' : 'update',
        collection,
        skipCI,
      },
    });
  } catch (/** @type {any} */ ex) {
    // eslint-disable-next-line no-console
    console.error(ex.cause ?? ex);

    throw new Error('saving_failed', { cause: ex.cause ?? ex });
  }

  await callEventHooks({ type: 'postSave', draft, savingEntry });

  updateStores({ skipCI });
  deleteBackup(collectionName, isNew ? '' : defaultLocaleSlug);

  if (originalEntry) {
    clearEntryHistoryCache(originalEntry.id);
  }

  return results.savedEntries[0];
};
