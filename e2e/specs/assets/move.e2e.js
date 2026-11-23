import { MEDIA_CONFIG, MEDIA_FILES, MEDIA_IMAGES } from '../../fixtures/configs/media.js';
import { createPNG } from '../../fixtures/files.js';
import { expect, test } from '../../fixtures/test.js';
import { listedAssets, openFolder } from '../../fixtures/ui.js';

/**
 * @import { Page } from '@playwright/test';
 */

test.use({ config: MEDIA_CONFIG });

const LOGO = createPNG({ color: [64, 0, 128] });

test.beforeEach(async ({ cms, page }) => {
  await cms.open();
  await cms.seed({
    ...MEDIA_FILES,
    'static/uploads/2024/logo.png': LOGO,
    // Same name as a file in the global folder, which can’t be moved here
    'static/projects/guide.txt': 'Project guide.\n',
  });
  await cms.signIn();
  await page.getByRole('radio', { name: 'Assets' }).click();
});

/**
 * Get the open Move dialog.
 * @param {Page} page Page.
 * @returns {import('@playwright/test').Locator} Dialog.
 */
const getMoveDialog = (page) => page.getByRole('dialog', { name: /^Move/ });

test('moves an asset to another folder and updates the entry using it', async ({ cms, page }) => {
  await openFolder(page, /Global Assets/);
  await page.getByRole('row', { name: 'sunset.png' }).click();
  await cms.chooseMenuItem(
    page.getByRole('button', { name: 'Show Edit Options' }),
    page.getByRole('menuitem', { name: 'Move Asset' }),
  );

  const dialog = getMoveDialog(page);

  await expect(dialog).toHaveAccessibleName(/Move.*sunset\.png/);
  await expect(dialog).toContainText('An entry using the assets will also be updated.');
  await expect(dialog.getByRole('button', { name: 'Move' })).toBeDisabled();

  const tree = dialog.getByRole('tree', { name: 'Destination Folder' });

  // The entry-relative folder of the posts can’t hold the file
  await expect(tree.getByRole('treeitem', { name: 'Posts' })).toHaveCount(0);

  // The asset’s own folder has nothing to move to
  await tree.getByRole('treeitem', { name: 'Global Assets' }).click();
  await expect(dialog).toContainText('The asset is already in this folder.');
  await expect(dialog.getByRole('button', { name: 'Move' })).toBeDisabled();

  await tree.getByRole('treeitem', { name: 'Projects' }).click();
  await dialog.getByRole('button', { name: 'Move' }).click();

  await expect
    .poll(() => listedAssets(page))
    .toEqual(['2024', 'forest.png', 'guide.txt', 'ocean.png']);
  expect(await cms.readRepoFile('static/projects/sunset.png')).toEqual(MEDIA_IMAGES.sunset);
  expect(await cms.readRepoFile('static/uploads/sunset.png')).toBeUndefined();
  expect((await cms.readRepo())['content/notes/evening.md']).toBe(
    '---\ntitle: Evening\ncover: /projects/sunset.png\n---\n',
  );

  await openFolder(page, /Projects/);
  await expect.poll(() => listedAssets(page)).toEqual(['bridge.png', 'guide.txt', 'sunset.png']);
});

test('moves an asset out of an entry’s folder, turning the relative path absolute', async ({
  cms,
  page,
}) => {
  await openFolder(page, /Posts/);
  await page.getByRole('row', { name: 'hero.png' }).click();
  await cms.chooseMenuItem(
    page.getByRole('button', { name: 'Show Edit Options' }),
    page.getByRole('menuitem', { name: 'Move Asset' }),
  );

  const dialog = getMoveDialog(page);

  await dialog.getByRole('treeitem', { name: 'Global Assets' }).click();
  await dialog.getByRole('button', { name: 'Move' }).click();

  await expect.poll(() => cms.readRepoFile('static/uploads/hero.png')).toEqual(MEDIA_IMAGES.hero);
  expect(await cms.readRepoFile('content/posts/hello/hero.png')).toBeUndefined();
  expect((await cms.readRepo())['content/posts/hello/index.md']).toBe(
    '---\ntitle: Hello\ncover: /uploads/hero.png\n---\n',
  );
});

test('moves the selected assets dropped on a folder in the sidebar', async ({ cms, page }) => {
  await openFolder(page, /Global Assets/);

  const grid = page.getByRole('grid', { name: 'Assets' });

  await grid.getByRole('row', { name: 'forest.png' }).getByRole('checkbox').check();
  await grid.getByRole('row', { name: 'ocean.png' }).getByRole('checkbox').check();
  await grid.getByRole('row', { name: 'ocean.png' }).dragTo(
    page.getByRole('listbox', { name: 'Asset Folder List' }).getByRole('option', {
      name: /Projects/,
    }),
  );

  const dialog = getMoveDialog(page);

  await expect(dialog).toHaveAccessibleName('Move 2 Assets');
  await expect(dialog.getByRole('treeitem', { name: 'Projects' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await dialog.getByRole('button', { name: 'Move' }).click();

  await expect.poll(() => listedAssets(page)).toEqual(['2024', 'guide.txt', 'sunset.png']);
  expect(await cms.readRepoFile('static/projects/forest.png')).toEqual(MEDIA_IMAGES.forest);
  expect(await cms.readRepoFile('static/projects/ocean.png')).toEqual(MEDIA_IMAGES.ocean);
});

test('moves an asset dropped on a subfolder in the list', async ({ cms, page }) => {
  await openFolder(page, /Global Assets/);

  const grid = page.getByRole('grid', { name: 'Assets' });

  await grid
    .getByRole('row', { name: 'forest.png' })
    .dragTo(grid.getByRole('row', { name: '2024' }));

  const dialog = getMoveDialog(page);

  await expect(dialog.getByRole('treeitem', { name: '2024' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await dialog.getByRole('button', { name: 'Move' }).click();

  await expect
    .poll(() => cms.readRepoFile('static/uploads/2024/forest.png'))
    .toEqual(MEDIA_IMAGES.forest);
  expect(await cms.readRepoFile('static/uploads/forest.png')).toBeUndefined();
});

test('refuses to move an asset onto a file with the same name', async ({ cms, page }) => {
  await openFolder(page, /Global Assets/);
  // Wait for the list to settle, as the file of the same name in All Assets can still be listed
  await expect
    .poll(() => listedAssets(page))
    .toEqual(['2024', 'forest.png', 'guide.txt', 'ocean.png', 'sunset.png']);
  await page.getByRole('row', { name: 'guide.txt' }).click();
  await cms.chooseMenuItem(
    page.getByRole('button', { name: 'Show Edit Options' }),
    page.getByRole('menuitem', { name: 'Move Asset' }),
  );

  const dialog = getMoveDialog(page);

  await dialog.getByRole('treeitem', { name: 'Projects' }).click();
  await expect(dialog.getByRole('alert')).toHaveText(
    /^The following files already exist in this folder: .?guide\.txt.?\.$/,
  );
  await expect(dialog.getByRole('button', { name: 'Move' })).toBeDisabled();
});
