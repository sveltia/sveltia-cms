import { getBlobRegex } from '@sveltia/utils/file';
import { toRaw } from '@sveltia/utils/object';
import { IndexedDB } from '@sveltia/utils/storage';
import equal from 'fast-deep-equal';
import { get, writable } from 'svelte/store';
import { entryDraft, i18nAutoDupEnabled } from '$lib/services/contents/draft';
import { siteConfigVersion } from '$lib/services/config';
import { backend } from '$lib/services/backends';

/**
 * @type {number | NodeJS.Timeout}
 */
let backupTimeout = 0;
/**
 * @type {IndexedDB | null | undefined}
 */
let backupDB = undefined;

/**
 * Default for {@link backupToastState}.
 */
const backupToastDefaultState = {
  saved: false,
  restored: false,
  deleted: false,
};

/**
 * @type {import('svelte/store').Writable<{ show: boolean, timestamp?: Date, resolve?: Function }>}
 */
export const restoreDialogState = writable({ show: false });
/**
 * @type {import('svelte/store').Writable<{ saved: boolean, restored: boolean, deleted: boolean }>}
 */
export const backupToastState = writable({ ...backupToastDefaultState });

/**
 * Delete a draft stored in IndexedDB.
 * @param {string} collectionName - Collection name.
 * @param {string} [slug] - Entry slug. Existing entry only.
 * @returns {Promise<void>} Result.
 */
export const deleteBackup = async (collectionName, slug = '') => {
  await backupDB?.delete([collectionName, slug]);
};

/**
 * Get a draft backup stored in IndexedDB.
 * @param {string} collectionName - Collection name.
 * @param {string} [slug] - Entry slug. Existing entry only.
 * @returns {Promise<?EntryDraftBackup>} Backup.
 */
export const getBackup = async (collectionName, slug = '') => {
  /** @type {EntryDraftBackup | undefined} */
  const backup = await backupDB?.get([collectionName, slug]);

  if (!backup) {
    return null;
  }

  if (backup.siteConfigVersion === get(siteConfigVersion)) {
    return backup;
  }

  // Discard the backup if the site configuration has been changed since the backup was created,
  // because there is a risk of data corruption
  await deleteBackup(collectionName, slug);

  return null;
};

/**
 * Backup the entry draft to IndexedDB.
 * @param {EntryDraft} draft - Draft.
 */
export const saveBackup = async (draft) => {
  const {
    collectionName,
    originalEntry,
    originalLocales = {},
    currentLocales = {},
    originalValues = {},
    currentValues = {},
    files,
  } = draft;

  const slug = originalEntry?.slug || '';
  const modified = !equal(originalLocales, currentLocales) || !equal(originalValues, currentValues);

  if (modified) {
    /** @type {EntryDraftBackup} */
    const backup = {
      timestamp: new Date(),
      siteConfigVersion: /** @type {string} */ (get(siteConfigVersion)),
      collectionName,
      slug,
      currentLocales,
      currentValues: /** @type {Record<LocaleCode, FlattenedEntryContent>} */ (
        toRaw(currentValues)
      ),
      files,
    };

    await backupDB?.put(backup);
  } else {
    const backup = await getBackup(collectionName, slug);

    if (backup) {
      await deleteBackup(collectionName, slug);
    }
  }
};

/**
 * Check if a draft backup is available, and restore it if requested by the user.
 * @param {string} collectionName - Collection name.
 * @param {string} [slug] - Entry slug. Existing entry only.
 */
export const restoreBackupIfNeeded = async (collectionName, slug = '') => {
  const backup = await getBackup(collectionName, slug);

  if (!backup) {
    return;
  }

  const { timestamp, currentLocales, currentValues, files } = backup;

  /** @type {boolean | undefined} */
  const doRestore = await new Promise((resolve) => {
    // The promise will be resolved once the Restore or Discard button is clicked on the dialog
    restoreDialogState.set({ show: true, timestamp, resolve });
  });

  if (doRestore === undefined) {
    return;
  }

  if (doRestore) {
    i18nAutoDupEnabled.set(false);

    entryDraft.update((draft) => {
      if (draft) {
        draft.currentLocales = currentLocales;
        Object.entries(draft.currentValues).forEach(([locale, _currentValues]) => {
          Object.assign(_currentValues, currentValues[locale]);

          Object.entries(_currentValues).forEach(([keyPath, value]) => {
            if (typeof value === 'string') {
              [...value.matchAll(getBlobRegex('g'))].forEach(([blobURL]) => {
                const file = files[blobURL];

                if (file instanceof File) {
                  // Regenerate a blob URL
                  const newURL = URL.createObjectURL(file);

                  _currentValues[keyPath] = value.replaceAll(blobURL, newURL);
                  draft.files[newURL] = file;
                }
              });
            }
          });
        });
      }

      return draft;
    });

    i18nAutoDupEnabled.set(true);
  } else {
    await deleteBackup(collectionName, slug);
  }

  backupToastState.set({ restored: doRestore, deleted: !doRestore, saved: false });
};

/**
 * Check if the current entry’s draft backup has been saved, and if so, show a toast notification.
 */
export const showBackupToastIfNeeded = async () => {
  const draft = get(entryDraft);

  if (!draft || get(backupToastState).saved) {
    return;
  }

  const { collectionName, originalEntry } = draft;
  const backup = await getBackup(collectionName, originalEntry?.slug);

  if (backup) {
    backupToastState.set({ restored: false, deleted: false, saved: true });
  }
};

/**
 * Reset {@link backupToastState}.
 */
export const resetBackupToastState = () => {
  backupToastState.set({ ...backupToastDefaultState });
};

backend.subscribe((_backend) => {
  if (_backend && !backupDB) {
    const { databaseName } = _backend.repository ?? {};

    if (databaseName) {
      backupDB = new IndexedDB(databaseName, 'draft-backups', {
        keyPath: ['collectionName', 'slug'], // Composite key
      });

      return;
    }
  }

  backupDB = null;
});

// Automatically backup the draft; use a timer to avoid typing lag
entryDraft.subscribe((draft) => {
  globalThis.clearTimeout(backupTimeout);

  if (draft && backupDB) {
    backupTimeout = globalThis.setTimeout(() => {
      saveBackup(draft);
    }, 500);
  }
});
