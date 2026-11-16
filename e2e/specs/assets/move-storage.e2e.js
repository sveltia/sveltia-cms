import { MockS3 } from '../../fixtures/cloud/s3.js';
import { createPNG } from '../../fixtures/files.js';
import { expect, test } from '../../fixtures/test.js';
import { listedAssets, openFolder } from '../../fixtures/ui.js';

/**
 * @import { Locator, Page } from '@playwright/test';
 */

const SUNSET = createPNG({ color: [255, 128, 0] });
const FOREST = createPNG({ color: [0, 128, 0] });
const MAP = createPNG({ color: [255, 255, 0] });
/**
 * URL the Amazon S3 bucket is served at.
 */
const S3_URL = 'https://e2e-bucket.s3.eu-west-3.amazonaws.com';

test.use({
  config: {
    backend: { name: 'test-repo' },
    media_folder: 'static/images',
    public_folder: '/images',
    media_libraries: {
      aws_s3: {
        access_key_id: 'AKIAE2ETESTKEY000000',
        bucket: 'e2e-bucket',
        region: 'eu-west-3',
        prefix: 'uploads/',
      },
    },
    collections: [
      {
        name: 'posts',
        label: 'Posts',
        label_singular: 'Post',
        folder: 'content/posts',
        create: true,
        fields: [
          { name: 'title', label: 'Title' },
          { name: 'cover', label: 'Cover', widget: 'image', required: false },
        ],
      },
    ],
  },
});

/** @type {MockS3} */
let s3;
/**
 * Get the open Move dialog.
 * @param {Page} page Page.
 * @returns {Locator} Dialog.
 */
const getMoveDialog = (page) => page.getByRole('dialog', { name: /^Move/ });

/**
 * Open the Move dialog for the focused asset from the Edit Options menu.
 * @param {Page} page Page.
 * @param {any} cms CMS fixture.
 * @returns {Promise<Locator>} Dialog.
 */
const openMoveDialog = async (page, cms) => {
  await cms.chooseMenuItem(
    page.getByRole('button', { name: 'Show Edit Options' }),
    page.getByRole('menuitem', { name: 'Move Asset' }),
  );

  return getMoveDialog(page);
};

/**
 * Expand a folder in the destination tree with the keyboard, as its subfolders are hidden.
 * @param {Page} page Page.
 * @param {Locator} item Tree item.
 */
const expandTreeItem = async (page, item) => {
  await item.click();
  await page.keyboard.press('ArrowRight');
  await expect(item).toHaveAttribute('aria-expanded', 'true');
};

test.beforeEach(async ({ cms, page }) => {
  s3 = new MockS3({ bucket: 'e2e-bucket', region: 'eu-west-3', baseURL: S3_URL });
  s3.put({ 'uploads/forest.png': FOREST, 'uploads/trips/': '', 'uploads/trips/map.png': MAP });
  await s3.install(page);
  await cms.open();
  await cms.seed({
    'static/images/sunset.png': SUNSET,
    'content/posts/evening.md': '---\ntitle: Evening\ncover: /images/sunset.png\n---\n',
    'content/posts/hike.md': `---\ntitle: Hike\ncover: ${S3_URL}/uploads/trips/map.png\n---\n`,
  });
  await cms.signIn();
  await page.getByRole('radio', { name: 'Assets' }).click();
  // Enter the credential, which a move to or from the bucket needs
  await page.getByRole('option', { name: /^Amazon S3/ }).click();
  await page
    .getByRole('main')
    .getByRole('textbox', { name: /Amazon S3.* API Key/ })
    .fill(s3.secretAccessKey);
  await expect(page.getByRole('option', { name: 'Amazon S3 (2 assets)' })).toBeVisible();
});

test.afterEach(() => {
  // Every request is signed with the secret access key
  expect(s3.refused).toEqual([]);
});

test('moves a repository asset to a folder of the bucket, linking the entry to it', async ({
  cms,
  page,
}) => {
  await openFolder(page, /Global Assets/);
  await page.getByRole('row', { name: 'sunset.png' }).click();

  const dialog = await openMoveDialog(page, cms);
  const bucket = dialog.getByRole('treeitem', { name: 'Amazon S3' });

  await expect(dialog).toContainText('An entry using the assets will also be updated.');
  // The folders of the bucket are listed once it has been browsed
  await expandTreeItem(page, bucket);
  await dialog.getByRole('treeitem', { name: 'trips' }).click();
  await dialog.getByRole('button', { name: 'Move' }).click();

  await expect.poll(() => s3.objects.get('uploads/trips/sunset.png')?.body).toEqual(SUNSET);
  await expect.poll(() => cms.readRepoFile('static/images/sunset.png')).toBeUndefined();
  expect((await cms.readRepo())['content/posts/evening.md']).toBe(
    `---\ntitle: Evening\ncover: ${S3_URL}/uploads/trips/sunset.png\n---\n`,
  );
  await expect.poll(() => listedAssets(page)).toEqual([]);
});

test('moves a file from the bucket to the repository, linking the entry to it', async ({
  cms,
  page,
}) => {
  await page.getByRole('row', { name: 'trips' }).dblclick();
  await page.getByRole('row', { name: 'map.png' }).click();

  const dialog = await openMoveDialog(page, cms);

  await expect(dialog).toContainText('An entry using the assets will also be updated.');
  await dialog.getByRole('treeitem', { name: 'Global Assets' }).click();
  await dialog.getByRole('button', { name: 'Move' }).click();

  await expect.poll(() => cms.readRepoFile('static/images/map.png')).toEqual(MAP);
  expect((await cms.readRepo())['content/posts/hike.md']).toBe(
    '---\ntitle: Hike\ncover: /images/map.png\n---\n',
  );
  await expect.poll(() => s3.objects.has('uploads/trips/map.png')).toBe(false);
});

test('moves a file to another folder of the bucket', async ({ cms, page }) => {
  await page.getByRole('row', { name: 'forest.png' }).click();

  const dialog = await openMoveDialog(page, cms);

  await expandTreeItem(page, dialog.getByRole('treeitem', { name: 'Amazon S3' }));
  await dialog.getByRole('treeitem', { name: 'trips' }).click();
  await dialog.getByRole('button', { name: 'Move' }).click();

  await expect.poll(() => s3.objects.get('uploads/trips/forest.png')?.body).toEqual(FOREST);
  expect(s3.objects.has('uploads/forest.png')).toBe(false);
  await expect.poll(() => listedAssets(page)).toEqual(['trips']);
});

test('moves a repository asset dropped on the bucket in the sidebar', async ({ cms, page }) => {
  await openFolder(page, /Global Assets/);
  await page
    .getByRole('grid', { name: 'Assets' })
    .getByRole('row', { name: 'sunset.png' })
    .dragTo(page.getByRole('option', { name: /^Amazon S3/ }));

  const dialog = getMoveDialog(page);

  await expect(dialog.getByRole('treeitem', { name: 'Amazon S3' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await dialog.getByRole('button', { name: 'Move' }).click();

  await expect.poll(() => s3.objects.get('uploads/sunset.png')?.body).toEqual(SUNSET);
  expect((await cms.readRepo())['content/posts/evening.md']).toBe(
    `---\ntitle: Evening\ncover: ${S3_URL}/uploads/sunset.png\n---\n`,
  );
});

test('moves a file from the bucket dropped on a folder in the sidebar', async ({ cms, page }) => {
  await page
    .getByRole('grid', { name: 'Assets' })
    .getByRole('row', { name: 'forest.png' })
    .dragTo(page.getByRole('option', { name: /^Global Assets/ }));

  const dialog = getMoveDialog(page);

  await expect(dialog.getByRole('treeitem', { name: 'Global Assets' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await dialog.getByRole('button', { name: 'Move' }).click();

  await expect.poll(() => cms.readRepoFile('static/images/forest.png')).toEqual(FOREST);
  await expect.poll(() => s3.objects.has('uploads/forest.png')).toBe(false);
});

test('moves a file dropped on a subfolder of the bucket', async ({ page }) => {
  const grid = page.getByRole('grid', { name: 'Assets' });

  await grid
    .getByRole('row', { name: 'forest.png' })
    .dragTo(grid.getByRole('row', { name: 'trips' }));

  const dialog = getMoveDialog(page);

  await expect(dialog.getByRole('treeitem', { name: 'trips' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await dialog.getByRole('button', { name: 'Move' }).click();

  await expect.poll(() => s3.objects.get('uploads/trips/forest.png')?.body).toEqual(FOREST);
  expect(s3.objects.has('uploads/forest.png')).toBe(false);
});
