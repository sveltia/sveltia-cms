import { getBlobRegex } from '@sveltia/utils/file';
import { toRaw } from '@sveltia/utils/object';
import { IndexedDB } from '@sveltia/utils/storage';
import { get, writable } from 'svelte/store';

import { backend } from '$lib/services/backends';
import { siteConfigVersion } from '$lib/services/config';
import { entryDraft, entryDraftModified, i18nAutoDupEnabled } from '$lib/services/contents/draft';
import { createProxy } from '$lib/services/contents/draft/create/proxy';
import { prefs } from '$lib/services/user/prefs';

/**
 * @import { Writable } from 'svelte/store';
 * @import {
 * EntryDraft,
 * EntryDraftBackup,
 * LocaleContentMap,
 * LocaleSlugMap,
 * } from '$lib/types/private';
 */

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
const BACKUP_TOAST_DEFAULT_STATE = {
  saved: false,
  restored: false,
  deleted: false,
};

/**
 * @type {Writable<{ show: boolean, timestamp?: Date, resolve?: (value?: boolean) => void }>}
 */
export const restoreDialogState = writable({ show: false });
/**
 * @type {Writable<{ saved: boolean, restored: boolean, deleted: boolean }>}
 */
export const backupToastState = writable({ ...BACKUP_TOAST_DEFAULT_STATE });

/**
 * Delete a draft stored in IndexedDB.
 * @param {string} collectionName Collection name.
 * @param {string} [slug] Entry slug. Existing entry only.
 * @returns {Promise<void>} Result.
 */
export const deleteBackup = async (collectionName, slug = '') => {
  await backupDB?.delete([collectionName, slug]);
};

/**
 * Get a draft backup stored in IndexedDB.
 * @param {string} collectionName Collection name.
 * @param {string} [slug] Entry slug. Existing entry only.
 * @returns {Promise<EntryDraftBackup | null>} Backup.
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
 * @param {EntryDraft} draft Draft.
 */
export const saveBackup = async (draft) => {
  if (!(get(prefs).useDraftBackup ?? true)) {
    return;
  }

  const {
    collectionName,
    fileName,
    originalEntry,
    currentLocales = {},
    currentSlugs = {},
    currentValues = {},
    files,
  } = draft;

  const slug = fileName ?? originalEntry?.slug ?? '';

  if (get(entryDraftModified)) {
    /** @type {EntryDraftBackup} */
    const backup = {
      timestamp: new Date(),
      siteConfigVersion: /** @type {string} */ (get(siteConfigVersion)),
      collectionName,
      slug,
      currentLocales,
      currentSlugs: /** @type {LocaleSlugMap} */ (toRaw(currentSlugs)),
      currentValues: /** @type {LocaleContentMap} */ (toRaw(currentValues)),
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
 * Restore a draft backup to the current entry draft.
 * @param {object} args Arguments.
 * @param {EntryDraftBackup} args.backup Backup to restore.
 * @param {string} args.collectionName Collection name.
 * @param {string} [args.fileName] Collection file name. File/singleton collection only.
 */
const restoreBackup = ({ backup, collectionName, fileName }) => {
  const { currentLocales, currentSlugs, currentValues, files } = backup;
  const fileURLs = new Map();

  i18nAutoDupEnabled.set(false);

  entryDraft.update((draft) => {
    if (draft) {
      draft.currentLocales = currentLocales;
      draft.currentSlugs = currentSlugs;

      Object.entries(currentValues).forEach(([locale, valueMap]) => {
        Object.entries(valueMap).forEach(([keyPath, value]) => {
          if (typeof value === 'string') {
            [...value.matchAll(getBlobRegex('g'))].forEach(([blobURL]) => {
              let cache = files[blobURL];

              // Support `LegacyEntryFileMap`
              // @todo Remove this before the 1.0 release
              if (cache instanceof File) {
                cache = { file: cache, folder: undefined };
              }

              if (!cache) {
                return;
              }

              const { file } = cache;
              let newURL = '';

              if (fileURLs.has(file)) {
                newURL = fileURLs.get(file);
              } else {
                // Regenerate a blob URL
                newURL = URL.createObjectURL(file);

                draft.files[newURL] = cache;
                fileURLs.set(file, newURL);
              }

              value = value.replaceAll(blobURL, newURL);
            });

            valueMap[keyPath] = value;
          }
        });

        if (draft.currentValues[locale]) {
          Object.assign(draft.currentValues[locale], valueMap);
        } else {
          draft.currentValues[locale] = createProxy({
            draft: { collectionName, fileName },
            locale,
            target: structuredClone(valueMap),
          });
        }

        if (!draft.originalValues[locale]) {
          draft.originalValues[locale] = {};
        }
      });
    }

    return draft;
  });

  i18nAutoDupEnabled.set(true);
};

/**
 * Check if a draft backup is available, and restore it if requested by the user.
 * @param {object} args Arguments.
 * @param {string} args.collectionName Collection name.
 * @param {string} [args.fileName] Collection file name. File/singleton collection only.
 * @param {string} [args.slug] Entry slug. Existing entry only.
 */
export const restoreBackupIfNeeded = async ({ collectionName, fileName, slug = '' }) => {
  if (!(get(prefs).useDraftBackup ?? true)) {
    return;
  }

  const backup = await getBackup(collectionName, slug);

  if (!backup) {
    return;
  }

  const { timestamp } = backup;

  /** @type {boolean | undefined} */
  const doRestore = await new Promise((resolve) => {
    // The promise will be resolved once the Restore or Discard button is clicked on the dialog
    restoreDialogState.set({ show: true, timestamp, resolve });
  });

  if (doRestore === undefined) {
    return;
  }

  if (doRestore) {
    restoreBackup({ backup, collectionName, fileName });
  } else {
    await deleteBackup(collectionName, slug);
  }

  backupToastState.set({ restored: doRestore, deleted: !doRestore, saved: false });
};

/**
 * Check if the current entry’s draft backup has been saved, and if so, show a toast notification.
 */
export const showBackupToastIfNeeded = async () => {
  if (!(get(prefs).useDraftBackup ?? true)) {
    return;
  }

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
  backupToastState.set({ ...BACKUP_TOAST_DEFAULT_STATE });
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
