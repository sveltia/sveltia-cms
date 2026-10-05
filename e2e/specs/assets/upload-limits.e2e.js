import { MEDIA_CONFIG, MEDIA_FILES } from '../../fixtures/configs/media.js';
import { createPNG } from '../../fixtures/files.js';
import { expect, test } from '../../fixtures/test.js';

/**
 * @import { Locator, Page } from '@playwright/test';
 */

/**
 * An image under the 1 KB limit set below, of 851 bytes.
 */
const SMALL = { name: 'small.png', mimeType: 'image/png', buffer: createPNG({ size: 256 }) };

/**
 * An image over the limit, of 2,003 bytes.
 */
const LARGE = {
  name: 'large.png',
  mimeType: 'image/png',
  buffer: createPNG({ size: 512, color: [0, 0, 255] }),
};

/**
 * A file named like an image that can’t be decoded as one.
 */
const BROKEN = { name: 'broken.png', mimeType: 'image/png', buffer: Buffer.from('Not an image') };

/**
 * The media site with a maximum upload size of 1 KB, which the projects’ image field raises to
 * 5 KB.
 */
const CONFIG = {
  ...MEDIA_CONFIG,
  media_libraries: { default: { config: { max_file_size: 1000 } } },
  collections: MEDIA_CONFIG.collections.map((collection) =>
    collection.name === 'projects'
      ? {
          ...collection,
          fields: collection.fields.map((field) =>
            field.name === 'image'
              ? { ...field, media_libraries: { default: { config: { max_file_size: 5000 } } } }
              : field,
          ),
        }
      : collection,
  ),
};

test.use({ config: CONFIG });

test.beforeEach(async ({ cms }) => {
  await cms.open();
  await cms.seed(MEDIA_FILES);
  await cms.signIn();
});

/**
 * Start a new entry in a collection and get a field group in the editor.
 * @param {Page} page Page.
 * @param {RegExp} collection Collection name, followed by the number of entries.
 * @param {string} label Field label.
 * @returns {Promise<Locator>} Field group.
 */
const createEntry = async (page, collection, label) => {
  await page.getByRole('treeitem', { name: collection }).click();
  await page.getByRole('button', { name: 'Create New Entry' }).first().click();

  const editor = page.getByRole('group', { name: 'Content Editor' });

  await editor.getByRole('textbox', { name: 'Title' }).fill('Trip');

  return editor.getByRole('group', { name: `“\u2068${label}\u2069” Field` });
};

/**
 * Upload files to a media field with its hidden file input.
 * @param {Locator} field Field group.
 * @param {{ name: string, mimeType: string, buffer: Buffer }[]} files Files.
 */
const uploadFiles = async (field, files) => {
  await field.locator('input[type="file"]').first().setInputFiles(files);
};

test('refuses to upload a file over the maximum size to the asset library', async ({
  cms,
  page,
}) => {
  await page.getByRole('radio', { name: 'Assets' }).click();
  await page.getByRole('button', { name: 'Upload New Assets' }).click();

  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page
      .getByRole('dialog', { name: 'Upload New Assets' })
      .getByRole('button', { name: 'Choose Files' })
      .click(),
  ]);

  await chooser.setFiles([SMALL, LARGE]);

  // The Upload dialog warns about the file it leaves out, and uploads the other one
  const dialog = page.getByRole('alertdialog', { name: 'Upload New Assets' });
  const warning = dialog.getByRole('alert');

  await expect(warning).toContainText(
    'This file cannot be uploaded because it exceeds the maximum size of \u2068\u20681\u2069 KB\u2069.',
  );
  await expect(dialog.getByRole('listitem')).toHaveText([/small\.png/, /large\.png/]);
  await dialog.getByRole('button', { name: 'Upload' }).click();

  await expect.poll(() => cms.readRepoFile('static/uploads/small.png')).toEqual(SMALL.buffer);
  expect(await cms.readRepoFile('static/uploads/large.png')).toBeUndefined();
});

test('refuses an oversized and a broken image in a field, saying why', async ({ cms, page }) => {
  const field = await createEntry(page, /Notes/, 'Cover');

  await uploadFiles(field, [LARGE]);

  const alert = page.getByRole('alertdialog', { name: 'Large File' });

  await expect(alert.getByRole('listitem')).toHaveText(['large.png']);
  await alert.getByRole('button', { name: 'OK' }).click();
  await expect(field).toContainText('Drop an image file here');

  await uploadFiles(field, [BROKEN]);

  const invalidAlert = page.getByRole('alertdialog', { name: 'Invalid File' });

  await expect(invalidAlert.getByRole('listitem')).toHaveText(['broken.png']);
  await invalidAlert.getByRole('button', { name: 'OK' }).click();
  await expect(field).toContainText('Drop an image file here');

  // A multiple image field takes several files at once, and tells both reasons in one dialog
  const gallery = page
    .getByRole('group', { name: 'Content Editor' })
    .getByRole('group', { name: '“\u2068Gallery\u2069” Field' });

  await uploadFiles(gallery, [SMALL, LARGE, BROKEN]);

  const rejectedAlert = page.getByRole('alertdialog', { name: 'Files Cannot Be Uploaded' });

  await expect(rejectedAlert.getByRole('listitem')).toHaveText(['large.png', 'broken.png']);
  await rejectedAlert.getByRole('button', { name: 'OK' }).click();
  await page.getByRole('button', { name: 'Save' }).click();

  await expect
    .poll(async () => (await cms.readRepo())['content/notes/trip.md'])
    .toBe("---\ntitle: Trip\ncover: ''\nattachment: ''\ngallery:\n  - /uploads/small.png\n---\n");
  expect(await cms.readRepoFile('static/uploads/large.png')).toBeUndefined();
  expect(await cms.readRepoFile('static/uploads/broken.png')).toBeUndefined();
});

test('keeps the image of a field when the file replacing it is refused', async ({ page }) => {
  await page.getByRole('row', { name: 'Evening' }).click();

  const editor = page.getByRole('group', { name: 'Content Editor' });
  const cover = editor.getByRole('group', { name: '“\u2068Cover\u2069” Field' });

  await expect(cover.getByRole('textbox', { name: 'Cover' })).toHaveText('/uploads/sunset.png');
  await uploadFiles(cover, [LARGE]);

  const alert = page.getByRole('alertdialog', { name: 'Large File' });

  await expect(alert.getByRole('listitem')).toHaveText(['large.png']);
  await alert.getByRole('button', { name: 'OK' }).click();

  // The refused file doesn’t clear the field, so there is nothing to save
  await expect(cover.getByRole('textbox', { name: 'Cover' })).toHaveText('/uploads/sunset.png');
  await expect(editor.getByRole('button', { name: 'Save' })).toBeDisabled();
});

test('takes a larger file in a field with its own maximum size', async ({ cms, page }) => {
  const field = await createEntry(page, /Projects/, 'Image');

  await uploadFiles(field, [LARGE]);

  await expect(field.getByRole('textbox', { name: 'Image' })).toHaveText('/projects/large.png');
  await page.getByRole('button', { name: 'Save' }).click();

  await expect.poll(() => cms.readRepoFile('static/projects/large.png')).toEqual(LARGE.buffer);
});
