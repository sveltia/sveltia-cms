import { get } from 'svelte/store';
import { backend, isLastCommitPublished } from '$lib/services/backends';
import { saveChanges } from '$lib/services/common/save';
import { siteConfig } from '$lib/services/config';
import {
  contentUpdatesToast,
  UPDATE_TOAST_DEFAULT_STATE,
} from '$lib/services/contents/collection/data';
import { entryDraft } from '$lib/services/contents/draft';
import { deleteBackup } from '$lib/services/contents/draft/backup';
import { createSavingEntryData } from '$lib/services/contents/draft/save/changes';
import { getSlugs } from '$lib/services/contents/draft/slugs';
import { validateEntry } from '$lib/services/contents/draft/validate';
import { expandInvalidFields } from '$lib/services/contents/editor/expanders';

/**
 * @import { ChangeResults, Entry, EntryDraft } from '$lib/types/private';
 */

/**
 * Update the application stores with deployment settings.
 * @param {object} args Arguments.
 * @param {boolean | undefined} args.skipCI Whether to disable automatic deployments for the change.
 */
const updateStores = ({ skipCI }) => {
  const autoDeployEnabled = get(siteConfig)?.backend.automatic_deployments;

  const published =
    !!get(backend)?.isGit && (skipCI === undefined ? autoDeployEnabled === true : skipCI === false);

  contentUpdatesToast.set({
    ...UPDATE_TOAST_DEFAULT_STATE,
    saved: true,
    published,
    count: 1,
  });

  isLastCommitPublished.set(published);
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
  const { collection, isNew, collectionName, fileName, currentValues } = draft;

  if (!validateEntry()) {
    expandInvalidFields({ collectionName, fileName, currentValues });

    throw new Error('validation_failed');
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

  updateStores({ skipCI });
  deleteBackup(collectionName, isNew ? '' : defaultLocaleSlug);

  return results.savedEntries[0];
};
