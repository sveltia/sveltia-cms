import { createPNG } from '../../fixtures/files.js';
import { expect, test } from '../../fixtures/test.js';
import { getEditor, getField, openCollection } from '../../fixtures/ui.js';

/**
 * @import { Locator, Page } from '@playwright/test';
 */

/**
 * A site with File fields taking a folder: one in a collection using the global media folder and a
 * folder of its own, one with several folders, and one in collections whose own media folder is
 * next to each entry, or has template tags, neither of which can be browsed.
 */
const CONFIG = {
  backend: { name: 'test-repo' },
  media_folder: 'static/uploads',
  public_folder: '/uploads',
  collections: [
    {
      name: 'albums',
      label: 'Albums',
      label_singular: 'Album',
      folder: 'content/albums',
      create: true,
      media_folder: '/static/albums',
      public_folder: '/albums',
      fields: [
        { name: 'title', label: 'Title' },
        { name: 'photos', label: 'Photos', widget: 'file', select_folder: true, required: false },
        {
          name: 'extras',
          label: 'Extras',
          widget: 'file',
          select_folder: true,
          multiple: true,
          required: false,
        },
      ],
    },
    {
      name: 'posts',
      label: 'Posts',
      label_singular: 'Post',
      folder: 'content/posts',
      path: '{{slug}}/index',
      create: true,
      media_folder: '',
      public_folder: '',
      fields: [
        { name: 'title', label: 'Title' },
        { name: 'photos', label: 'Photos', widget: 'file', select_folder: true, required: false },
      ],
    },
    {
      name: 'events',
      label: 'Events',
      label_singular: 'Event',
      folder: 'content/events',
      create: true,
      media_folder: '/static/events/{{slug}}',
      public_folder: '/events/{{slug}}',
      fields: [
        { name: 'title', label: 'Title' },
        { name: 'photos', label: 'Photos', widget: 'file', select_folder: true, required: false },
      ],
    },
  ],
};

const FILES = {
  'static/uploads/cover.png': createPNG({ color: [255, 128, 0] }),
  'static/uploads/gallery/sea.png': createPNG({ color: [0, 64, 255] }),
  'static/uploads/gallery/2024/hill.png': createPNG({ color: [0, 128, 0] }),
  'static/uploads/gallery/2025/lake.png': createPNG({ color: [0, 128, 128] }),
  'static/uploads/press/kit.png': createPNG({ color: [128, 0, 128] }),
  'static/albums/summer/beach.png': createPNG({ color: [255, 255, 0] }),
  'content/posts/hello/index.md': '---\ntitle: Hello\n---\n',
  'content/posts/hello/photos/a.png': createPNG({ color: [200, 100, 50] }),
};

test.use({ config: CONFIG });

test.beforeEach(async ({ cms }) => {
  await cms.open();
  await cms.seed(FILES);
  await cms.signIn();
});

/**
 * Open a collection and start a new entry with a title.
 * @param {Page} page Page.
 * @param {string} collection Collection label.
 * @param {string} title Title.
 * @returns {Promise<Locator>} Content editor.
 */
const createEntry = async (page, collection, title) => {
  await (
    await openCollection(page, collection)
  )
    .getByRole('button', { name: 'Create New Entry' })
    .first()
    .click();

  const editor = getEditor(page);

  await editor.getByRole('textbox', { name: 'Title' }).fill(title);

  return editor;
};

/**
 * Open the Select Folder dialog of a field.
 * @param {Page} page Page.
 * @param {Locator} field Field group.
 * @returns {Promise<Locator>} Dialog.
 */
const browse = async (page, field) => {
  await field.getByRole('button', { name: 'Browse' }).click();

  const dialog = page.getByRole('dialog', { name: 'Select Folder' });

  await expect(dialog).toBeVisible();

  return dialog;
};

/**
 * Get the subfolders listed in the dialog.
 * @param {Locator} dialog Select Folder dialog.
 * @returns {Locator} Options.
 */
const getSubfolders = (dialog) =>
  dialog.getByRole('listbox', { name: 'Folders' }).getByRole('option');

test('saves the public path of a picked folder', async ({ cms, page }) => {
  const editor = await createEntry(page, 'Albums', 'Trip');
  const photos = getField(editor, 'Photos', { exact: true });

  // A folder can’t be dropped or pasted
  await expect(photos).toContainText('Click to browse');
  await expect(photos.getByRole('button', { name: 'Paste' })).toHaveCount(0);

  const dialog = await browse(page, photos);
  const locations = dialog.getByRole('listbox', { name: 'Locations' });

  // Only the repository folders are offered: no URL, no stock photos, and no search
  await expect(locations.getByRole('option')).toHaveText([
    /\bCollection Assets\b/,
    /\bGlobal Assets\b/,
  ]);
  await expect(locations.getByRole('option', { name: 'Collection Assets' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(dialog.getByRole('searchbox')).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: 'Upload' })).toHaveCount(0);
  // The folder being browsed is picked unless a subfolder is selected
  await expect(dialog.getByRole('status')).toHaveText('Selected folder: \u2068/albums\u2069');

  await locations.getByRole('option', { name: 'Global Assets' }).click();
  // Only folders are listed, not the files in them
  await expect(getSubfolders(dialog)).toHaveText([/\bgallery\b/, /\bpress\b/]);
  await expect(dialog.getByRole('option', { name: 'cover.png' })).toHaveCount(0);
  await expect(dialog.getByRole('status')).toHaveText('Selected folder: \u2068/uploads\u2069');

  // A click selects a subfolder, and a double click opens it
  await getSubfolders(dialog).filter({ hasText: 'press' }).click();
  await expect(dialog.getByRole('status')).toHaveText(
    'Selected folder: \u2068/uploads/press\u2069',
  );
  await getSubfolders(dialog).filter({ hasText: 'gallery' }).dblclick();
  await expect(getSubfolders(dialog)).toHaveText([/\b2024\b/, /\b2025\b/]);
  await expect(dialog.getByRole('status')).toHaveText(
    'Selected folder: \u2068/uploads/gallery\u2069',
  );
  await getSubfolders(dialog).filter({ hasText: '2024' }).click();
  await expect(dialog.getByRole('status')).toHaveText(
    'Selected folder: \u2068/uploads/gallery/2024\u2069',
  );
  await dialog.getByRole('button', { name: 'Select' }).click();
  await expect(dialog).toBeHidden();

  await expect(photos.getByRole('textbox', { name: 'Photos' })).toHaveText('/uploads/gallery/2024');
  await editor.getByRole('button', { name: 'Save' }).click();

  await expect
    .poll(async () => (await cms.readRepo())['content/albums/trip.md'])
    .toBe('---\ntitle: Trip\nphotos: /uploads/gallery/2024\nextras: []\n---\n');
});

test('saves the root of a folder', async ({ cms, page }) => {
  const editor = await createEntry(page, 'Albums', 'All');
  const photos = getField(editor, 'Photos', { exact: true });
  const dialog = await browse(page, photos);

  await expect(getSubfolders(dialog)).toHaveText([/\bsummer\b/]);
  await dialog.getByRole('button', { name: 'Select' }).click();

  await expect(photos.getByRole('textbox', { name: 'Photos' })).toHaveText('/albums');
  await editor.getByRole('button', { name: 'Save' }).click();

  await expect
    .poll(async () => (await cms.readRepo())['content/albums/all.md'])
    .toBe('---\ntitle: All\nphotos: /albums\nextras: []\n---\n');
});

test('saves several folders in a multiple field', async ({ cms, page }) => {
  const editor = await createEntry(page, 'Albums', 'Mix');
  const extras = getField(editor, 'Extras', { exact: true });
  const dialog = await browse(page, extras);

  await dialog
    .getByRole('listbox', { name: 'Locations' })
    .getByRole('option', { name: 'Global Assets' })
    .click();
  await getSubfolders(dialog).filter({ hasText: 'press' }).click();
  // A multiple selection is kept while another folder is browsed
  await getSubfolders(dialog).filter({ hasText: 'gallery' }).dblclick();
  await getSubfolders(dialog).filter({ hasText: '2025' }).click();
  await expect(dialog.getByRole('status')).toHaveText('2 folders selected');
  await dialog.getByRole('button', { name: 'Select' }).click();
  await expect(dialog).toBeHidden();
  await editor.getByRole('button', { name: 'Save' }).click();

  await expect
    .poll(async () => (await cms.readRepo())['content/albums/mix.md'])
    .toBe(
      "---\ntitle: Mix\nphotos: ''\nextras:\n  - /uploads/press\n  - /uploads/gallery/2025\n---\n",
    );
});

test('offers no entry-relative folder', async ({ page }) => {
  const editor = await createEntry(page, 'Posts', 'Walk');
  const dialog = await browse(page, getField(editor, 'Photos', { exact: true }));

  // The folder next to the entry isn’t offered, only the global one
  await expect(dialog.getByRole('listbox', { name: 'Locations' }).getByRole('option')).toHaveText([
    /\bGlobal Assets\b/,
  ]);
  await expect(getSubfolders(dialog)).toHaveText([/\bgallery\b/, /\bpress\b/]);
});

test('offers no folder with template tags', async ({ page }) => {
  const editor = await createEntry(page, 'Events', 'Fair');
  const dialog = await browse(page, getField(editor, 'Photos', { exact: true }));

  await expect(dialog.getByRole('listbox', { name: 'Locations' }).getByRole('option')).toHaveText([
    /\bGlobal Assets\b/,
  ]);
});
