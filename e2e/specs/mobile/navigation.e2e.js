import { MONOLINGUAL_CONFIG, MONOLINGUAL_FILES } from '../../fixtures/configs/monolingual.js';
import { expect, test } from '../../fixtures/test.js';

import { getBottomNavigation, PHONE, signIn } from './helpers.js';

test.use({ config: MONOLINGUAL_CONFIG, ...PHONE });

test.beforeEach(async ({ cms, page }) => {
  await cms.open();
  await cms.seed(MONOLINGUAL_FILES);
  await signIn(page);
});

test('shows the bottom navigation instead of the global toolbar', async ({ page }) => {
  // The phone has a touch screen and no mouse, which the CMS tells from the pointer
  expect(await page.evaluate(() => matchMedia('(pointer: fine)').matches)).toBe(false);

  await expect(getBottomNavigation(page)).toMatchAriaSnapshot(`
    - radio "Contents" [checked]
    - radio "Assets"
    - radio "Menu"
  `);
  await expect(page.getByRole('button', { name: 'Show Account Menu' })).toHaveCount(0);

  // The collection list fills the page, with a search bar of its own
  const sidebar = page.getByRole('navigation', { name: 'Contents' });

  await expect(sidebar.getByRole('heading', { name: 'Contents' })).toBeVisible();
  await expect(sidebar.getByRole('searchbox', { name: 'Search for contents…' })).toBeVisible();
  await expect(sidebar.getByRole('tree', { name: 'Collection List' })).toMatchAriaSnapshot(`
    - group "Collections":
      - treeitem "Posts"
      - treeitem "Authors"
      - treeitem "Pages"
    - group "Files":
      - treeitem "Site Settings"
  `);
});

test('moves between the collection list and a collection', async ({ page }) => {
  const collectionList = page.getByRole('tree', { name: 'Collection List' });

  await collectionList.getByRole('treeitem', { name: 'Posts' }).click();

  // The collection replaces the list, rather than being shown next to it
  const collection = page.getByRole('main', { name: /Posts.*Collection/ });

  await expect(collection.getByRole('grid', { name: 'Entries' })).toMatchAriaSnapshot(`
    - row "A Quiet Review"
    - row "First Light"
    - row "Talking to Jane"
  `);
  await expect(collectionList).toBeHidden();
  await expect(page).toHaveURL(/#\/collections\/posts$/);

  await collection.getByRole('button', { name: 'Back to Collection List' }).click();
  await expect(collectionList).toBeVisible();
  await expect(collection).toBeHidden();
  await expect(page).toHaveURL(/#\/collections$/);

  // A collection chosen again isn’t left selected in the list, so it can be opened again
  await collectionList.getByRole('treeitem', { name: 'Authors' }).click();
  await expect(page.getByRole('main', { name: /Authors.*Collection/ })).toMatchAriaSnapshot(`
    - row "Jane Doe"
    - row "John Smith"
  `);
  await page.getByRole('button', { name: 'Back to Collection List' }).click();
  await collectionList.getByRole('treeitem', { name: 'Posts' }).click();
  await expect(collection).toBeVisible();
});

test('moves between the pages with the bottom navigation', async ({ page }) => {
  const navigation = getBottomNavigation(page);

  await page.getByRole('treeitem', { name: 'Posts' }).click();
  await expect(page.getByRole('main', { name: /Posts.*Collection/ })).toBeVisible();

  // The Asset Library opens on its folder list
  await navigation.getByRole('radio', { name: 'Assets' }).click();
  await expect(navigation.getByRole('radio', { name: 'Assets' })).toBeChecked();
  await expect(page).toHaveURL(/#\/assets$/);
  await expect(page.getByRole('listbox', { name: 'Asset Folder List' })).toBeVisible();

  await navigation.getByRole('radio', { name: 'Menu' }).click();
  await expect(navigation.getByRole('radio', { name: 'Menu' })).toBeChecked();
  await expect(page).toHaveURL(/#\/menu$/);

  const account = page.getByRole('group', { name: 'Menu' }).getByRole('menu', { name: 'Account' });

  await expect(account).toMatchAriaSnapshot(`
    - menuitem "Working with Test Repository" [disabled]
    - separator
    - menuitem "Live Site"
    - separator
    - menuitem "Settings"
    - separator
    - menuitem "Sign Out"
  `);

  await navigation.getByRole('radio', { name: 'Contents' }).click();
  await expect(navigation.getByRole('radio', { name: 'Contents' })).toBeChecked();
  await expect(page).toHaveURL(/#\/collections$/);
  await expect(page.getByRole('tree', { name: 'Collection List' })).toBeVisible();
});

test('opens the settings from the menu, and goes back', async ({ page }) => {
  await getBottomNavigation(page).getByRole('radio', { name: 'Menu' }).click();
  await page.getByRole('menuitem', { name: 'Settings' }).click();

  // The settings are a page of their own rather than a dialog
  const settings = page.getByRole('group', { name: 'Settings' });

  await expect(page).toHaveURL(/#\/settings$/);
  await expect(settings.getByRole('toolbar')).toContainText('Settings');
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await settings.getByRole('button', { name: 'Back' }).click();
  await expect(page).toHaveURL(/#\/menu$/);
  await expect(page.getByRole('menu', { name: 'Account' })).toBeVisible();
});

test('signs out from the menu', async ({ page }) => {
  await getBottomNavigation(page).getByRole('radio', { name: 'Menu' }).click();
  await page.getByRole('menuitem', { name: 'Sign Out' }).click();
  await expect(page.getByRole('button', { name: 'Work with Test Repository' })).toBeVisible();
  await expect(getBottomNavigation(page)).toBeHidden();
});
