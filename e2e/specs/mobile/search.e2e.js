import { MEDIA_CONFIG, MEDIA_FILES } from '../../fixtures/configs/media.js';
import { MONOLINGUAL_CONFIG, MONOLINGUAL_FILES } from '../../fixtures/configs/monolingual.js';
import { expect, test } from '../../fixtures/test.js';

import { getBottomNavigation, getEditor, PHONE, signIn } from './helpers.js';

/**
 * @import { Locator, Page } from '@playwright/test';
 */

test.use({ ...PHONE });

/**
 * Tap the search bar above the collection list or the asset folder list, which leads to the search
 * page, and type the terms once its own search bar has taken the focus.
 * @param {Page} page Page.
 * @param {'contents' | 'assets'} mode What to search for.
 * @param {string} terms Search terms.
 * @returns {Promise<Locator>} Search page.
 */
const search = async (page, mode, terms) => {
  const name = `Search for ${mode}…`;

  await page
    .getByRole('navigation', { name: mode === 'contents' ? 'Contents' : 'Assets' })
    .getByRole('searchbox', { name })
    .click();
  await expect(page).toHaveURL(/#\/search$/);

  const searchPage = page.getByRole('group', { name: /^Search Results for/ });

  await expect(searchPage.getByRole('search').getByRole('searchbox', { name })).toBeFocused();
  await page.keyboard.type(terms);
  await expect(page).toHaveURL(new RegExp(`#/search/${terms}$`));

  return searchPage;
};

test.describe('contents', () => {
  test.use({ config: MONOLINGUAL_CONFIG });

  test.beforeEach(async ({ cms, page }) => {
    await cms.open();
    await cms.seed(MONOLINGUAL_FILES);
    await signIn(page);
  });

  test('searches the entries on a page of its own, and goes back', async ({ page }) => {
    const searchPage = await search(page, 'contents', 'light');

    // The results replace the collection list, and name the collection of each entry
    await expect(page.getByRole('tree', { name: 'Collection List' })).toBeHidden();
    await expect(searchPage.getByRole('grid', { name: 'Entries' })).toMatchAriaSnapshot(`
      - row "Posts First Light (News)"
    `);
    await expect(getBottomNavigation(page).getByRole('radio', { name: 'Contents' })).toBeChecked();

    // The back button clears the search
    await searchPage.getByRole('button', { name: 'Back to Collection List' }).click();
    await expect(page).toHaveURL(/#\/collections$/);
    await expect(page.getByRole('tree', { name: 'Collection List' })).toBeVisible();
    await expect(page.getByRole('searchbox', { name: 'Search for contents…' })).toHaveValue('');
  });

  test('goes back to the results from an entry opened from them', async ({ cms, page }) => {
    const searchPage = await search(page, 'contents', 'light');

    await searchPage.getByRole('row', { name: /First Light/ }).tap();

    const editor = getEditor(page);

    await expect(editor.getByRole('textbox', { name: 'Title' })).toHaveValue('First Light');
    await editor.getByRole('button', { name: 'Cancel Editing' }).click();
    await expect(editor).toBeHidden();
    await expect(page).toHaveURL(/#\/search\/light$/);
    await expect(searchPage.getByRole('row', { name: /First Light/ })).toBeVisible();

    // Saving goes back to the results too, and says so there
    await searchPage.getByRole('row', { name: /First Light/ }).tap();
    await editor.getByRole('textbox', { name: 'Title' }).fill('First Light, Again');
    await editor.getByRole('button', { name: 'Save' }).click();
    await expect(page).toHaveURL(/#\/search\/light$/);
    await expect(page.getByRole('status').filter({ hasText: 'Entry saved.' })).toBeVisible();
    await expect(searchPage.getByRole('row', { name: /First Light, Again/ })).toBeVisible();
    await expect
      .poll(async () => (await cms.readRepo())['content/posts/2026-01-first-light.md'])
      .toMatch(/^title: First Light, Again$/m);
  });

  test('says when nothing matches', async ({ page }) => {
    const searchPage = await search(page, 'contents', 'nebula');

    await expect(searchPage).toContainText('No entries found.');
    await expect(searchPage.getByRole('grid', { name: 'Entries' })).toHaveCount(0);
  });
});

test.describe('assets', () => {
  test.use({ config: MEDIA_CONFIG });

  test.beforeEach(async ({ cms, page }) => {
    await cms.open();
    await cms.seed(MEDIA_FILES);
    await signIn(page);
    await getBottomNavigation(page).getByRole('radio', { name: 'Assets' }).click();
  });

  test('searches the assets, and goes back', async ({ page }) => {
    const searchPage = await search(page, 'assets', 'forest');

    // Each result names its folder
    await expect(searchPage.getByRole('grid', { name: 'Assets' })).toMatchAriaSnapshot(`
      - row "Global Assets forest.png"
    `);
    // The Asset Library stays selected in the bottom navigation
    await expect(getBottomNavigation(page).getByRole('radio', { name: 'Assets' })).toBeChecked();

    await searchPage.getByRole('button', { name: 'Back to Asset Folder List' }).click();
    await expect(page).toHaveURL(/#\/assets$/);
    await expect(page.getByRole('listbox', { name: 'Asset Folder List' })).toBeVisible();
  });

  test('goes back to the results from an asset opened from them', async ({ page }) => {
    const searchPage = await search(page, 'assets', 'forest');

    await searchPage.getByRole('row', { name: 'forest.png' }).tap();

    const assetEditor = page.getByRole('group', { name: 'Asset Editor' });

    await expect(assetEditor.getByRole('img', { name: 'forest.png' })).toBeVisible();
    await assetEditor.getByRole('button', { name: 'Cancel Editing' }).click();
    await expect(assetEditor).toBeHidden();
    await expect(page).toHaveURL(/#\/search\/forest$/);
    await expect(searchPage.getByRole('row', { name: 'forest.png' })).toBeVisible();
  });
});
