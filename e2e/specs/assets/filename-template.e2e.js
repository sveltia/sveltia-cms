import { MEDIA_CONFIG, MEDIA_FILES } from '../../fixtures/configs/media.js';
import { createPNG } from '../../fixtures/files.js';
import { expect, test } from '../../fixtures/test.js';

/**
 * @import { Locator, Page } from '@playwright/test';
 */

/**
 * {@link MEDIA_CONFIG} with the `filename_template` option set for the whole site, and for the
 * Cover field of the notes, which takes precedence there.
 */
const CONFIG = {
  ...MEDIA_CONFIG,
  media_libraries: { default: { config: { filename_template: 'library-{{filename}}' } } },
  collections: MEDIA_CONFIG.collections.map((collection) =>
    collection.name === 'notes'
      ? {
          ...collection,
          fields: collection.fields.map((field) =>
            field.name === 'cover'
              ? {
                  ...field,
                  media_libraries: {
                    default: { config: { filename_template: '{{slug}}-{{filename}}' } },
                  },
                }
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
 * Start a new note and fill in its title.
 * @param {Page} page Page.
 * @param {string} title Title.
 * @returns {Promise<Locator>} Content editor.
 */
const createNote = async (page, title) => {
  await page.getByRole('button', { name: 'Create New Entry' }).first().click();

  const editor = page.getByRole('group', { name: 'Content Editor' });

  await editor.getByRole('textbox', { name: 'Title' }).fill(title);

  return editor;
};

/**
 * Get the Cover field group in the editor, and upload an image to it.
 * @param {Locator} editor Content editor.
 * @param {Buffer} buffer Image data.
 * @returns {Promise<Locator>} Field group.
 */
const uploadCover = async (editor, buffer) => {
  const cover = editor.getByRole('group', { name: '“\u2068Cover\u2069” Field' });

  await cover
    .locator('input[type="file"]')
    .first()
    .setInputFiles({ name: 'IMG 0001.png', mimeType: 'image/png', buffer });

  return cover;
};

test('names an upload with the entry slug when the entry is saved', async ({ cms, page }) => {
  const kite = createPNG({ color: [255, 255, 0] });
  const editor = await createNote(page, 'Kite');
  const cover = await uploadCover(editor, kite);

  await expect(cover.getByRole('textbox', { name: 'Cover' })).toHaveText(
    '/uploads/kite-img-0001.png',
  );
  // The name follows the slug until the entry is saved
  await editor.getByRole('textbox', { name: 'Title' }).fill('Red Kite');
  await expect(cover.getByRole('textbox', { name: 'Cover' })).toHaveText(
    '/uploads/red-kite-img-0001.png',
  );
  await editor.getByRole('button', { name: 'Save' }).click();

  await expect
    .poll(async () => (await cms.readRepo())['content/notes/red-kite.md'])
    .toBe(
      "---\ntitle: Red Kite\ncover: /uploads/red-kite-img-0001.png\nattachment: ''\ngallery: []\n---\n",
    );
  expect(await cms.readRepoFile('static/uploads/red-kite-img-0001.png')).toEqual(kite);
  expect(await cms.readRepoFile('static/uploads/IMG 0001.png')).toBeUndefined();
});

test('keeps the name of an upload renamed by hand', async ({ cms, page }) => {
  const kite = createPNG({ color: [255, 255, 0] });
  const editor = await createNote(page, 'Kite');
  const cover = await uploadCover(editor, kite);

  await cover.getByRole('button', { name: 'Rename' }).click();
  await expect(cover.getByRole('textbox', { name: 'Cover' })).toHaveValue('kite-img-0001.png');
  await cover.getByRole('textbox', { name: 'Cover' }).fill('sky.png');
  await cover.getByRole('button', { name: 'Done' }).click();
  await expect(cover.getByRole('textbox', { name: 'Cover' })).toHaveText('/uploads/sky.png');
  // The slug no longer matters
  await editor.getByRole('textbox', { name: 'Title' }).fill('Red Kite');
  await editor.getByRole('button', { name: 'Save' }).click();

  await expect
    .poll(async () => (await cms.readRepo())['content/notes/red-kite.md'])
    .toBe("---\ntitle: Red Kite\ncover: /uploads/sky.png\nattachment: ''\ngallery: []\n---\n");
  expect(await cms.readRepoFile('static/uploads/sky.png')).toEqual(kite);
});

test('names an upload in the asset library with the site-wide template', async ({ cms, page }) => {
  const kite = createPNG({ color: [255, 255, 0] });

  await page.getByRole('radio', { name: 'Assets' }).click();
  await page.getByRole('option', { name: /Global Assets/ }).click();
  await cms.dropFiles(page.getByRole('grid', { name: 'Assets' }), [
    { name: 'kite.png', buffer: kite },
  ]);

  const dialog = page.getByRole('alertdialog', { name: 'Upload New Assets' });

  await expect(dialog.getByRole('listitem')).toHaveText([/library-kite\.png/]);
  await dialog.getByRole('button', { name: 'Upload' }).click();

  await expect.poll(() => cms.readRepoFile('static/uploads/library-kite.png')).toEqual(kite);
  expect(await cms.readRepoFile('static/uploads/kite.png')).toBeUndefined();
});
