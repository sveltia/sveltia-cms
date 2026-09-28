import { readFile } from 'fs/promises';

import { MEDIA_CONFIG, MEDIA_FILES, MEDIA_IMAGES } from '../../fixtures/configs/media.js';
import { createPNG } from '../../fixtures/files.js';
import { expect, test } from '../../fixtures/test.js';

/**
 * @import { Locator, Page } from '@playwright/test';
 */

test.use({ config: MEDIA_CONFIG, permissions: ['clipboard-read', 'clipboard-write'] });

test.beforeEach(async ({ cms, page }) => {
  await cms.open();
  await cms.seed(MEDIA_FILES);
  await cms.signIn();
  await page.getByRole('radio', { name: 'Assets' }).click();
});

/**
 * Get the names of the assets listed, in order.
 * @param {Page} page Page.
 * @returns {Promise<string[]>} File names.
 */
const listedAssets = (page) =>
  page
    .getByRole('grid', { name: 'Assets' })
    .getByRole('row')
    .evaluateAll((rows) => rows.map((row) => row.getAttribute('aria-label') ?? ''));

/**
 * Open an asset folder from the folder list.
 * @param {Page} page Page.
 * @param {RegExp} name Folder name, followed by the number of assets.
 */
const openFolder = async (page, name) => {
  await page.getByRole('option', { name }).click();
  await expect(page.getByRole('option', { name })).toHaveAttribute('aria-selected', 'true');
};

test('lists the assets of each folder', async ({ page }) => {
  await expect(page.getByRole('listbox', { name: 'Asset Folder List' })).toMatchAriaSnapshot(`
    - option "All Assets (6 assets)"
    - option "Global Assets (4 assets)"
    - separator
    - option "Projects (1 asset)"
    - option "Posts (1 asset)"
  `);
  await expect
    .poll(() => listedAssets(page))
    .toEqual(['bridge.png', 'forest.png', 'guide.txt', 'hero.png', 'ocean.png', 'sunset.png']);

  await openFolder(page, /Global Assets/);
  await expect
    .poll(() => listedAssets(page))
    .toEqual(['forest.png', 'guide.txt', 'ocean.png', 'sunset.png']);
  await expect(page.getByRole('group', { name: 'Asset Info' })).toContainText('/static/uploads');

  await openFolder(page, /Projects/);
  await expect.poll(() => listedAssets(page)).toEqual(['bridge.png']);
  await expect(page.getByRole('group', { name: 'Asset Info' })).toContainText('/static/projects');

  // The folder of an entry-relative collection lists the assets next to every entry
  await openFolder(page, /Posts/);
  await expect.poll(() => listedAssets(page)).toEqual(['hero.png']);
  await page.getByRole('row', { name: 'hero.png' }).click();
  await expect(page.getByRole('group', { name: 'Asset Info' })).toContainText(
    '/content/posts/hello/hero.png',
  );
});

test('switches between the list and grid views, and sorts the assets', async ({ cms, page }) => {
  // The view type is only told apart by the class of the grid’s wrapper
  const listView = page.locator('.list-view').getByRole('grid', { name: 'Assets' });
  const gridView = page.locator('.grid-view').getByRole('grid', { name: 'Assets' });

  await openFolder(page, /Global Assets/);
  await expect(page.getByRole('radio', { name: 'Grid View' })).toBeChecked();
  await expect(gridView).toBeVisible();

  await page.getByRole('radio', { name: 'List View' }).click();
  await expect(page.getByRole('radio', { name: 'List View' })).toBeChecked();
  await expect(listView).toBeVisible();

  // Each folder has its own view
  await openFolder(page, /Projects/);
  await expect(gridView).toBeVisible();
  await openFolder(page, /Global Assets/);
  await expect(listView).toBeVisible();

  await cms.chooseMenuItem(
    page.getByRole('button', { name: 'Sort' }),
    page.getByRole('menuitemradio', { name: /Name.*Z to A/ }),
  );
  await expect
    .poll(() => listedAssets(page))
    .toEqual(['sunset.png', 'ocean.png', 'guide.txt', 'forest.png']);

  await cms.chooseMenuItem(
    page.getByRole('button', { name: 'Type' }),
    page.getByRole('menuitemradio', { name: 'Image' }),
  );
  await expect.poll(() => listedAssets(page)).toEqual(['sunset.png', 'ocean.png', 'forest.png']);
});

test('uploads files with the Upload button', async ({ cms, page }) => {
  const kite = createPNG({ color: [255, 255, 0] });
  const map = createPNG({ color: [0, 255, 255] });

  await openFolder(page, /Projects/);

  await page.getByRole('button', { name: 'Upload New Assets' }).click();

  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page
      .getByRole('dialog', { name: 'Upload New Assets' })
      .getByRole('button', { name: 'Choose Files' })
      .click(),
  ]);

  expect(chooser.isMultiple()).toBe(true);
  await chooser.setFiles([
    { name: 'kite.png', mimeType: 'image/png', buffer: kite },
    { name: 'map.png', mimeType: 'image/png', buffer: map },
  ]);

  const dialog = page.getByRole('alertdialog', { name: 'Upload New Assets' });

  await expect(dialog).toContainText('/static/projects');
  await expect(dialog.getByRole('listitem')).toHaveText([/kite\.png/, /map\.png/]);
  await dialog.getByRole('button', { name: 'Upload' }).click();

  await expect.poll(() => listedAssets(page)).toEqual(['bridge.png', 'kite.png', 'map.png']);
  expect(await cms.readRepoFile('static/projects/kite.png')).toEqual(kite);
  expect(await cms.readRepoFile('static/projects/map.png')).toEqual(map);
  await expect(page.getByRole('option', { name: 'Projects (3 assets)' })).toBeVisible();
});

test('uploads a file dropped on the asset list', async ({ cms, page }) => {
  const kite = createPNG({ color: [255, 255, 0] });

  await openFolder(page, /Global Assets/);
  await cms.dropFiles(page.getByRole('grid', { name: 'Assets' }), [
    { name: 'kite.png', buffer: kite },
  ]);

  const dialog = page.getByRole('alertdialog', { name: 'Upload New Assets' });

  await expect(dialog).toContainText('/static/uploads');
  await dialog.getByRole('button', { name: 'Upload' }).click();

  await expect.poll(() => listedAssets(page)).toContain('kite.png');
  expect(await cms.readRepoFile('static/uploads/kite.png')).toEqual(kite);
});

test('cancels an upload', async ({ cms, page }) => {
  await openFolder(page, /Global Assets/);
  await cms.dropFiles(page.getByRole('grid', { name: 'Assets' }), [
    { name: 'kite.png', buffer: createPNG({ color: [255, 255, 0] }) },
  ]);

  const dialog = page.getByRole('alertdialog', { name: 'Upload New Assets' });

  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(dialog).toBeHidden();
  expect(await listedAssets(page)).not.toContain('kite.png');
  expect(await cms.readRepoFile('static/uploads/kite.png')).toBeUndefined();
});

test('previews an asset and moves to the next one', async ({ page }) => {
  await openFolder(page, /Global Assets/);
  await page.getByRole('row', { name: 'ocean.png' }).click();
  await page.getByRole('button', { name: 'Show Preview' }).click();

  const editor = page.getByRole('group', { name: 'Asset Editor' });

  await expect(editor.getByRole('img', { name: 'ocean.png' })).toBeVisible();
  // The image is decoded, not a broken one
  await expect
    .poll(() => editor.getByRole('img', { name: 'ocean.png' }).evaluate((img) => img.naturalWidth))
    .toBe(32);
  await expect(editor).toContainText('32×32');

  await editor.getByRole('button', { name: 'Next Asset' }).click();
  await expect(editor.getByRole('img', { name: 'sunset.png' })).toBeVisible();
  await expect(editor).toContainText('Notes › Evening');
  await expect(editor.getByRole('button', { name: 'Next Asset' })).toBeDisabled();

  await editor.getByRole('button', { name: 'Cancel Editing' }).click();
  await expect(editor).toBeHidden();
  await expect(page.getByRole('grid', { name: 'Assets' })).toBeVisible();
});

test('copies the public URL, the file path and the data of an asset', async ({ cms, page }) => {
  const copy = page.getByRole('button', { name: 'Copy' });

  await openFolder(page, /Global Assets/);
  await page.getByRole('row', { name: 'forest.png' }).click();

  await cms.chooseMenuItem(copy, page.getByRole('menuitem', { name: 'Public URL' }));
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toMatch(/^http:\/\/127\.0\.0\.1:\d+\/uploads\/forest\.png$/);

  await cms.chooseMenuItem(copy, page.getByRole('menuitem', { name: 'File Path' }));
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toBe('/static/uploads/forest.png');

  await cms.chooseMenuItem(copy, page.getByRole('menuitem', { name: 'File Data' }));
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const [item] = await navigator.clipboard.read();

        // The URL copied before may still be there
        if (!item?.types.includes('image/png')) {
          return [];
        }

        return [
          ...new Uint8Array(await (await item.getType('image/png')).arrayBuffer()).slice(1, 4),
        ];
      }),
    )
    .toEqual([...Buffer.from('PNG')]);
});

test('downloads an asset', async ({ page }) => {
  await openFolder(page, /Global Assets/);
  await page.getByRole('row', { name: 'forest.png' }).click();

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download' }).click(),
  ]);

  expect(download.suggestedFilename()).toBe('forest.png');
  expect(await readFile(/** @type {string} */ (await download.path()))).toEqual(
    MEDIA_IMAGES.forest,
  );
});

test('renames an asset and updates the entry using it', async ({ cms, page }) => {
  await openFolder(page, /Global Assets/);
  await page.getByRole('row', { name: 'sunset.png' }).click();
  await cms.chooseMenuItem(
    page.getByRole('button', { name: 'Show Edit Options' }),
    page.getByRole('menuitem', { name: 'Rename Asset' }),
  );

  const dialog = page.getByRole('dialog', { name: /Rename.*sunset\.png/ });

  await expect(dialog).toContainText('An entry using the asset will also be updated.');
  await expect(dialog.getByRole('textbox')).toHaveValue('sunset.png');
  await expect(dialog.getByRole('button', { name: 'Rename' })).toBeDisabled();
  await dialog.getByRole('textbox').fill('dusk.png');
  await dialog.getByRole('button', { name: 'Rename' }).click();

  await expect
    .poll(() => listedAssets(page))
    .toEqual(['dusk.png', 'forest.png', 'guide.txt', 'ocean.png']);
  expect(await cms.readRepoFile('static/uploads/dusk.png')).toEqual(MEDIA_IMAGES.sunset);
  expect(await cms.readRepoFile('static/uploads/sunset.png')).toBeUndefined();
  expect((await cms.readRepo())['content/notes/evening.md']).toBe(
    '---\ntitle: Evening\ncover: /uploads/dusk.png\n---\n',
  );
});

test('replaces an asset with another file', async ({ cms, page }) => {
  const newForest = createPNG({ color: [0, 200, 0] });

  await openFolder(page, /Global Assets/);
  await page.getByRole('row', { name: 'forest.png' }).click();
  await cms.chooseMenuItem(
    page.getByRole('button', { name: 'Show Edit Options' }),
    page.getByRole('menuitem', { name: 'Replace Asset' }),
  );

  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page
      .getByRole('dialog', { name: /Replace.*forest\.png/ })
      .getByRole('button', { name: /Choose File/ })
      .click(),
  ]);

  expect(chooser.isMultiple()).toBe(false);
  await chooser.setFiles({ name: 'new-forest.png', mimeType: 'image/png', buffer: newForest });

  const dialog = page.getByRole('alertdialog', { name: 'Replace Asset' });

  await expect(dialog.getByRole('listitem')).toHaveText(/new-forest\.png/);
  await dialog.getByRole('button', { name: 'Replace' }).click();

  await expect.poll(() => cms.readRepoFile('static/uploads/forest.png')).toEqual(newForest);
  expect(await cms.readRepoFile('static/uploads/new-forest.png')).toBeUndefined();
  expect(await listedAssets(page)).toEqual(['forest.png', 'guide.txt', 'ocean.png', 'sunset.png']);
});

test('deletes an asset', async ({ cms, page }) => {
  await openFolder(page, /Global Assets/);
  await page.getByRole('row', { name: 'forest.png' }).click();
  await page.getByRole('button', { name: 'Delete Selected Asset' }).click();

  const dialog = page.getByRole('alertdialog');

  await expect(dialog).toContainText('Are you sure you want to delete the selected asset?');
  await dialog.getByRole('button', { name: 'Delete' }).click();

  await expect.poll(() => listedAssets(page)).toEqual(['guide.txt', 'ocean.png', 'sunset.png']);
  expect(await cms.readRepoFile('static/uploads/forest.png')).toBeUndefined();
  await expect(page.getByRole('option', { name: 'Global Assets (3 assets)' })).toBeVisible();
});

test('deletes several assets', async ({ cms, page }) => {
  await openFolder(page, /Global Assets/);
  await page.getByRole('checkbox', { name: /Select.*forest\.png/ }).check();
  await page.getByRole('checkbox', { name: /Select.*guide\.txt/ }).check();
  await page.getByRole('button', { name: 'Delete Selected Assets' }).click();

  const dialog = page.getByRole('alertdialog');

  await expect(dialog).toContainText('Are you sure you want to delete the selected 2 assets?');
  await dialog.getByRole('button', { name: 'Delete' }).click();

  await expect.poll(() => listedAssets(page)).toEqual(['ocean.png', 'sunset.png']);
  expect(await cms.readRepoFile('static/uploads/forest.png')).toBeUndefined();
  expect((await cms.readRepo())['static/uploads/guide.txt']).toBeUndefined();
});

test('deletes an asset used by an entry and removes the reference', async ({ cms, page }) => {
  await openFolder(page, /Global Assets/);
  await page.getByRole('row', { name: 'sunset.png' }).click();
  await page.getByRole('button', { name: 'Delete Selected Asset' }).click();

  const dialog = page.getByRole('alertdialog');

  await expect(dialog).toContainText('The reference to it in an entry will be removed as well.');
  await dialog.getByRole('button', { name: 'Delete' }).click();

  await expect.poll(() => listedAssets(page)).toEqual(['forest.png', 'guide.txt', 'ocean.png']);
  expect(await cms.readRepoFile('static/uploads/sunset.png')).toBeUndefined();
  // The optional field is left empty, like any optional field missing from a saved entry
  expect((await cms.readRepo())['content/notes/evening.md']).toBe(
    "---\ntitle: Evening\ncover: ''\n---\n",
  );
});

test('refuses to delete an asset a required field uses', async ({ cms, page }) => {
  await openFolder(page, /Posts/);
  await page.getByRole('row', { name: 'hero.png' }).click();
  await page.getByRole('button', { name: 'Delete Selected Asset' }).click();

  const dialog = page.getByRole('alertdialog');

  await expect(dialog.getByRole('alert')).toContainText('This asset can’t be deleted');
  await expect(dialog.getByRole('listitem')).toHaveText(
    /Posts › Hello.*Cover: This field is required\./,
  );
  await expect(dialog.getByRole('button', { name: 'Delete' })).toBeDisabled();
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(dialog).toBeHidden();
  expect(await cms.readRepoFile('content/posts/hello/hero.png')).toEqual(MEDIA_IMAGES.hero);
});

test('renames an asset next to an entry and updates its relative path', async ({ cms, page }) => {
  await openFolder(page, /Posts/);
  await page.getByRole('row', { name: 'hero.png' }).click();
  await cms.chooseMenuItem(
    page.getByRole('button', { name: 'Show Edit Options' }),
    page.getByRole('menuitem', { name: 'Rename Asset' }),
  );

  const dialog = page.getByRole('dialog', { name: /Rename.*hero\.png/ });

  await dialog.getByRole('textbox').fill('banner.png');
  await dialog.getByRole('button', { name: 'Rename' }).click();

  await expect.poll(() => listedAssets(page)).toEqual(['banner.png']);
  expect(await cms.readRepoFile('content/posts/hello/banner.png')).toEqual(MEDIA_IMAGES.hero);
  expect((await cms.readRepo())['content/posts/hello/index.md']).toBe(
    '---\ntitle: Hello\ncover: banner.png\n---\n',
  );
});

test('uploads to the global folder from All Assets, but not to an entry’s folder', async ({
  cms,
  page,
}) => {
  const kite = createPNG({ color: [255, 255, 0] });

  await cms.dropFiles(page.getByRole('grid', { name: 'Assets' }), [
    { name: 'kite.png', buffer: kite },
  ]);

  const dialog = page.getByRole('alertdialog', { name: 'Upload New Assets' });

  await expect(dialog).toContainText('/static/uploads');
  await dialog.getByRole('button', { name: 'Upload' }).click();
  await expect.poll(() => cms.readRepoFile('static/uploads/kite.png')).toEqual(kite);

  // An entry-relative folder gets its files with the entry
  await openFolder(page, /Posts/);
  await expect(page.getByRole('button', { name: 'Upload New Assets' })).toBeDisabled();
});
