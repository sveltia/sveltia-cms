import { expect } from '../../fixtures/test.js';

/**
 * @import { Locator, Page } from '@playwright/test';
 */

/**
 * Open a collection from the sidebar.
 * @param {Page} page Page.
 * @param {string} name Collection label.
 * @returns {Promise<Locator>} Collection.
 */
export const openCollection = async (page, name) => {
  const collection = page.getByRole('main', { name: new RegExp(`${name}.*Collection`) });

  await page
    .getByRole('tree', { name: 'Collection List' })
    .getByRole('treeitem', { name: new RegExp(`^${name}\\b`) })
    .click();
  await expect(collection).toBeVisible();

  return collection;
};

/**
 * Get the grid in a collection’s entry list.
 * @param {Page} page Page.
 * @returns {Locator} Grid.
 */
export const getEntryList = (page) =>
  page.getByRole('group', { name: 'Entry List' }).getByRole('grid');
