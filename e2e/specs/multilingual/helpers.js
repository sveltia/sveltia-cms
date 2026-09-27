import { expect } from '../../fixtures/test.js';

/**
 * @import { Locator, Page } from '@playwright/test';
 */

/**
 * Get the content editor.
 * @param {Page} page Page.
 * @returns {Locator} Editor.
 */
export const getEditor = (page) => page.getByRole('group', { name: 'Content Editor' });

/**
 * Get the editor pane showing a locale. Its name wraps the locale name in bidi isolates.
 * @param {Page} page Page.
 * @param {string} localeName Locale name, e.g. `French`.
 * @returns {Locator} Pane.
 */
export const getEditPane = (page, localeName) =>
  getEditor(page).getByRole('group', { name: new RegExp(`^Edit.*${localeName}.*Content$`) });

/**
 * Get the preview pane.
 * @param {Page} page Page.
 * @returns {Locator} Pane.
 */
export const getPreviewPane = (page) =>
  getEditor(page).getByRole('group', { name: /^Preview.*Content$/ });

/**
 * Show a locale in one of the two panes, with the “Switch Locale” radio group in its header.
 * @param {Page} page Page.
 * @param {0 | 1} paneIndex `0` for the first pane, `1` for the second one, which shows the preview
 * until a locale is picked.
 * @param {string} localeName Locale name, e.g. `French`.
 * @returns {Promise<Locator>} The pane now showing the locale.
 */
export const showLocale = async (page, paneIndex, localeName) => {
  await getEditor(page)
    .getByRole('radiogroup', { name: 'Switch Locale' })
    .nth(paneIndex)
    .getByRole('radio', { name: new RegExp(`^${localeName}\\b`) })
    .click();

  const pane = getEditPane(page, localeName);

  await expect(pane).toBeVisible();

  return pane;
};

/**
 * Open an entry of a collection by clicking its row.
 * @param {Page} page Page.
 * @param {string} collectionName Collection name in the sidebar.
 * @param {RegExp | string} rowName Row name.
 */
export const openEntry = async (page, collectionName, rowName) => {
  await page.getByRole('treeitem', { name: collectionName }).click();
  await page.getByRole('row', { name: rowName }).click();
  await expect(getEditor(page).getByRole('button', { name: 'Save' })).toBeVisible();
};

/**
 * Click the Save button and wait for the notification.
 * @param {Page} page Page.
 */
export const save = async (page) => {
  await getEditor(page).getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Entry saved.' })).toBeVisible();
};
