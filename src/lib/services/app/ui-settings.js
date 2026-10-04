import { backend } from '$lib/services/backends';
import { getRepositoryDatabase } from '$lib/services/utils/database';

/**
 * @import { IndexedDB } from '@sveltia/utils/storage';
 */

/**
 * Width of a page’s primary sidebar, in pixels, until the user resizes it.
 */
export const DEFAULT_SIDEBAR_WIDTH = 240;

/**
 * UI settings store of the current repository’s database, along with the name of that database.
 * The sidebar width is read every time an overlay is closed, and each handle opens a connection of
 * its own that’s never closed, so the handle is reused for as long as the repository stays the
 * same.
 * @type {{ databaseName: string, db: IndexedDB } | undefined}
 */
let uiSettingsDB;

/**
 * Forget the UI settings store. Used in tests.
 */
export const _resetUISettingsDB = () => {
  uiSettingsDB = undefined;
};

/**
 * Get the UI settings store of the current repository’s database.
 * @returns {IndexedDB | undefined} Store, or `undefined` if the backend has no database yet.
 */
export const getUISettingsDB = () => {
  const repository = backend.current?.repository;
  const databaseName = repository?.databaseName;

  if (!databaseName) {
    uiSettingsDB = undefined;

    return undefined;
  }

  if (uiSettingsDB?.databaseName !== databaseName) {
    uiSettingsDB = {
      databaseName,
      db: /** @type {IndexedDB} */ (getRepositoryDatabase(repository, 'ui-settings')),
    };
  }

  return uiSettingsDB.db;
};

/**
 * Get the saved width of a page’s primary sidebar.
 * @param {string} key UI settings key of the page, e.g. `contents-page`.
 * @returns {Promise<number>} Width in pixels, or {@link DEFAULT_SIDEBAR_WIDTH} if none is saved.
 */
export const getSidebarWidth = async (key) =>
  (await getUISettingsDB()?.get(key))?.sidebarWidth ?? DEFAULT_SIDEBAR_WIDTH;

/**
 * Save the width of a page’s primary sidebar, along with the other UI settings of the page.
 * @param {string} key UI settings key of the page, e.g. `contents-page`.
 * @param {number} width Width in pixels.
 */
export const saveSidebarWidth = async (key, width) => {
  const db = getUISettingsDB();

  if (!db) {
    return;
  }

  await db.set(key, { ...(await db.get(key)), sidebarWidth: width });
};
