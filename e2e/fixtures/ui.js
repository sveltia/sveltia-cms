import { expect } from '@playwright/test';

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
 * Get the group of a field in the editor.
 * @param {Page | Locator} scope Page, to look in the content editor, or an element to look in, such
 * as the editor or one of its panes.
 * @param {string} label Field label.
 * @param {object} [options] Options.
 * @param {boolean} [options.exact] Whether to match the whole group name, `“label” Field` with the
 * label wrapped in bidi isolates, rather than any name with the label followed by `Field`.
 * @returns {Locator} Field group.
 */
export const getField = (scope, label, { exact = false } = {}) =>
  ('goto' in scope ? getEditor(scope) : scope).getByRole(
    'group',
    exact
      ? { name: `“\u2068${label}\u2069” Field`, exact: true }
      : { name: new RegExp(`${label}.*Field`) },
  );

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

/**
 * Get the rows of a collection’s entry list, leaving out the header row of the table view. The
 * captions of the row groups, such as “Unpublished Entries”, are rows too, and included.
 * @param {Page | Locator} scope Page, to look in the entry list, or an element to look in, such as
 * the collection or a row group.
 * @returns {Locator} Rows.
 */
export const getEntryRows = (scope) => {
  const page = 'goto' in scope ? scope : scope.page();

  return ('goto' in scope ? getEntryList(scope) : scope)
    .getByRole('row')
    .and(page.locator(':not(.grid-head) > [role="row"]'));
};

/**
 * Get the row groups of a collection’s entry list, leaving out the header of the table view.
 * @param {Page} page Page.
 * @returns {Locator} Row groups.
 */
export const getEntryGroups = (page) =>
  getEntryList(page).getByRole('rowgroup').and(page.locator(':not(.grid-head)'));

/**
 * Open an entry in the editor by clicking its row, and wait until its title is shown.
 * @param {Page} page Page.
 * @param {string} title Entry title.
 * @param {object} [options] Options.
 * @param {string} [options.collection] Label of the collection to open from the sidebar first.
 * @param {boolean} [options.exact] Whether the row name is the title alone, rather than starting
 * with it.
 * @param {boolean} [options.checkTitle] Whether to wait until the Title field shows the title.
 * Turn it off for an entry whose title is in another field.
 * @returns {Promise<Locator>} Editor.
 */
export const openEntry = async (
  page,
  title,
  { collection, exact = false, checkTitle = true } = {},
) => {
  if (collection) {
    await openCollection(page, collection);
  }

  await page
    .getByRole('row', exact ? { name: title, exact: true } : { name: new RegExp(`^${title}`) })
    .click();

  const editor = getEditor(page);

  if (checkTitle) {
    await expect(editor.getByRole('textbox', { name: 'Title', exact: true })).toHaveValue(title);
  }

  return editor;
};

/**
 * Open the “First Post” entry the Git backend mocks start with, and wait until its body is shown.
 * @param {Page} page Page.
 * @returns {Promise<Locator>} Editor.
 */
export const openFirstPost = async (page) => {
  const editor = getEditor(page);

  await page.getByRole('row', { name: /First Post/ }).click();
  await expect(editor.getByRole('textbox', { name: 'Body' })).toHaveValue('Hello, world!');

  return editor;
};

/**
 * Click a control and get the URL of the tab it opens, once loaded. Answer the request for the URL
 * with `page.route()`, so no real site is loaded.
 * @param {Page} page Page.
 * @param {Locator | (() => Promise<void>)} control Control to click, or a function clicking it.
 * @returns {Promise<string>} URL.
 */
export const getOpenedURL = async (page, control) => {
  const [popup] = await Promise.all([
    page.waitForEvent('popup'),
    typeof control === 'function' ? control() : control.click(),
  ]);

  await popup.waitForLoadState();

  const url = popup.url();

  await popup.close();

  return url;
};

/**
 * Get the names of the assets listed in the Asset Library, in order.
 * @param {Page} page Page.
 * @returns {Promise<string[]>} File names.
 */
export const listedAssets = (page) =>
  page
    .getByRole('grid', { name: 'Assets' })
    .getByRole('row')
    .evaluateAll((rows) => rows.map((row) => row.getAttribute('aria-label') ?? ''));

/**
 * Open an asset folder from the folder list in the Asset Library.
 * @param {Page} page Page.
 * @param {RegExp} name Folder name, followed by the number of assets.
 */
export const openFolder = async (page, name) => {
  const option = page.getByRole('listbox', { name: 'Asset Folder List' }).getByRole('option', {
    name,
  });

  await option.click();
  await expect(option).toHaveAttribute('aria-selected', 'true');
};
