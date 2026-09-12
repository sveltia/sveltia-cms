import { getBlobRegex } from '@sveltia/utils/file';
import { toRaw } from '@sveltia/utils/object';
import { IndexedDB } from '@sveltia/utils/storage';

import { backend } from '$lib/services/backends';
import { cmsConfigVersion } from '$lib/services/config';
import { getOrderFieldKey } from '$lib/services/contents/collection/entries/reorder/config';
import { isDraftModified, suspendAutoDuplication } from '$lib/services/contents/draft';
import { createProxy } from '$lib/services/contents/draft/create/proxy.svelte';
import { prefs } from '$lib/services/user/prefs.svelte';
import { createDeepState, createRootEffect } from '$lib/services/utils/state.svelte';

/**
 * @import {
 * AssetFolderInfo,
 * EntryDraft,
 * EntryDraftBackup,
 * LocaleContentMap,
 * LocaleSlugMap,
 * LocaleStateMap,
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
 * @type {{ current: { show: boolean, timestamp?: Date, resolve?: (value?: boolean) => void } }}
 */
export const restoreDialogState = createDeepState({ show: false });

/**
 * @type {{ current: { saved: boolean, restored: boolean, deleted: boolean } }}
 */
export const backupToastState = createDeepState({ ...BACKUP_TOAST_DEFAULT_STATE });

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

  if (backup.cmsConfigVersion === cmsConfigVersion.current) {
    return backup;
  }

  // Discard the backup if the CMS configuration has been changed since the backup was created,
  // because there is a risk of data corruption
  await deleteBackup(collectionName, slug);

  return null;
};

/**
 * Get the slug part of the key a draft’s backup is stored under.
 * @param {EntryDraft} draft Draft.
 * @returns {string} Entry slug. An empty string for a new entry.
 */
const getBackupSlug = ({ fileName, originalEntry }) => fileName ?? originalEntry?.slug ?? '';

/**
 * Backup the entry draft to IndexedDB.
 * @param {EntryDraft} draft Draft.
 */
export const saveBackup = async (draft) => {
  // Skip if the user hasn’t manually interacted with the editor, so that only programmatic changes,
  // e.g. Lexical markdown reformatting, don’t trigger a backup
  if (!(prefs.useDraftBackup ?? true) || !draft.interacted) {
    return;
  }

  const {
    collectionName,
    currentLocales = {},
    currentSlugs = {},
    currentValues = {},
    files,
  } = draft;

  const slug = getBackupSlug(draft);

  if (isDraftModified(draft)) {
    // The draft is a `$state` proxy, which IndexedDB can’t clone, so every part of the backup has
    // to be copied to a plain object. `File` objects are cloneable as they are
    /** @type {EntryDraftBackup} */
    const backup = {
      timestamp: new Date(),
      cmsConfigVersion: /** @type {string} */ (cmsConfigVersion.current),
      collectionName,
      slug,
      currentLocales: /** @type {LocaleStateMap} */ (toRaw(currentLocales)),
      currentSlugs: /** @type {LocaleSlugMap} */ (toRaw(currentSlugs)),
      currentValues: /** @type {LocaleContentMap} */ (toRaw(currentValues)),
      files: Object.fromEntries(
        Object.entries(files).map(([blobURL, { file, folder, replace }]) => [
          blobURL,
          {
            file,
            folder: folder ? /** @type {AssetFolderInfo} */ (toRaw(folder)) : folder,
            replace,
          },
        ]),
      ),
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
 * Restore a draft backup to the given entry draft.
 * @param {object} args Arguments.
 * @param {EntryDraftBackup} args.backup Backup to restore.
 * @param {EntryDraft} args.draft Entry draft to restore the backup to.
 */
export const restoreBackup = ({ backup, draft }) => {
  const { currentLocales, currentSlugs, currentValues, files } = backup;
  const fileURLs = new Map();

  suspendAutoDuplication(() => {
    draft.currentLocales = currentLocales;
    draft.currentSlugs = currentSlugs;

    // Reconcile a stale manual-sort order field. The backup may have been taken before another
    // reorder/renumber operation rewrote this entry’s `order`. For existing entries, prefer the
    // value persisted on the live entry; for new entries, drop the field entirely so
    // `assignManualSortOrder` can compute a fresh value at save time. Without this, restoring an
    // old backup would clobber the latest order with a stale one.
    const orderKey = getOrderFieldKey(draft.collection);

    Object.entries(currentValues).forEach(([locale, valueMap]) => {
      if (orderKey && orderKey in valueMap) {
        const liveOrder = draft.originalEntry?.locales[locale]?.content?.[orderKey];

        if (liveOrder !== undefined) {
          valueMap[orderKey] = liveOrder;
        } else {
          delete valueMap[orderKey];
        }
      }

      Object.entries(valueMap).forEach(([keyPath, value]) => {
        if (typeof value === 'string') {
          [...value.matchAll(getBlobRegex('g'))].forEach(([blobURL]) => {
            const cache = files[blobURL];
            const { file } = cache ?? {};

            if (!cache || !file) {
              return;
            }

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
          draft,
          locale,
          target: structuredClone(valueMap),
        });
      }

      const newValueMap = draft.currentValues[locale];
      const keys = Object.keys(newValueMap);

      keys.forEach((keyPath) => {
        const value = newValueMap[keyPath];

        // Remove an optional object field’s default `null` value when subfields are added
        // @see https://github.com/sveltia/sveltia-cms/issues/840
        if (value === null && keys.some((k) => k.startsWith(`${keyPath}.`))) {
          newValueMap[keyPath] = {};
        }
      });

      if (!draft.originalValues[locale]) {
        draft.originalValues[locale] = {};
      }
    });
  });
};

/**
 * Check if a draft backup is available, and restore it if requested by the user.
 * @param {object} args Arguments.
 * @param {EntryDraft} args.draft Entry draft to restore the backup to.
 */
export const restoreBackupIfNeeded = async ({ draft }) => {
  if (!(prefs.useDraftBackup ?? true)) {
    return;
  }

  const { collectionName } = draft;
  const slug = getBackupSlug(draft);
  const backup = await getBackup(collectionName, slug);

  if (!backup) {
    return;
  }

  const { timestamp } = backup;
  const { promise, resolve } = Promise.withResolvers();

  restoreDialogState.current = { show: true, timestamp, resolve };

  // The promise will be resolved once the Restore or Discard button is clicked on the dialog
  /** @type {boolean | undefined} */
  const doRestore = await promise;

  if (doRestore === undefined) {
    return;
  }

  if (doRestore) {
    restoreBackup({ backup, draft });
    draft.interacted = true;
  } else {
    await deleteBackup(collectionName, slug);
  }

  backupToastState.current = { restored: doRestore, deleted: !doRestore, saved: false };
};

/**
 * Check if the given entry draft’s backup has been saved, and if so, show a toast notification.
 * @param {EntryDraft | null | undefined} draft Entry draft.
 */
export const showBackupToastIfNeeded = async (draft) => {
  if (!(prefs.useDraftBackup ?? true)) {
    return;
  }

  if (!draft || backupToastState.current.saved) {
    return;
  }

  const { collectionName, originalEntry } = draft;
  const backup = await getBackup(collectionName, originalEntry?.slug);

  if (backup) {
    backupToastState.current = { restored: false, deleted: false, saved: true };
  }
};

/**
 * Reset {@link backupToastState}.
 */
export const resetBackupToastState = () => {
  backupToastState.current = { ...BACKUP_TOAST_DEFAULT_STATE };
};

createRootEffect(() => {
  const { current: _backend } = backend;

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

/**
 * Schedule a backup of the given entry draft, cancelling any backup scheduled before. The editor
 * calls this whenever the draft changes; the timer avoids typing lag. Call it with no draft when
 * the editor is closed, so that a pending backup of the draft that is gone is dropped as well.
 * @param {EntryDraft | null | undefined} draft Entry draft.
 */
export const scheduleBackup = (draft) => {
  globalThis.clearTimeout(backupTimeout);

  if (draft && backupDB) {
    backupTimeout = globalThis.setTimeout(() => {
      saveBackup(draft);
    }, 500);
  }
};
