import { MEDIA_CONFIG, MEDIA_FILES, MEDIA_IMAGES } from '../../fixtures/configs/media.js';
import { createPNG } from '../../fixtures/files.js';
import { expect, test } from '../../fixtures/test.js';

/**
 * @import { Locator, Page } from '@playwright/test';
 */

test.use({ config: MEDIA_CONFIG });

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
 * Get a field group in the editor.
 * @param {Locator} editor Content editor.
 * @param {string} label Field label.
 * @returns {Locator} Field group.
 */
const getField = (editor, label) =>
  editor.getByRole('group', { name: `“\u2068${label}\u2069” Field` });

/**
 * Select an option in a list box of the Select File dialog.
 * @param {Locator} option Option.
 */
const selectOption = async (option) => {
  await option.click();
  await expect(option).toHaveAttribute('aria-selected', 'true');
};

/**
 * Upload files to a media field with its hidden file input.
 * @param {Locator} field Field group.
 * @param {{ name: string, buffer: Buffer }[]} files Files.
 */
const uploadFiles = async (field, files) => {
  await field
    .locator('input[type="file"]')
    .first()
    .setInputFiles(files.map(({ name, buffer }) => ({ name, mimeType: 'image/png', buffer })));
};

test('picks an existing image with the Browse button', async ({ cms, page }) => {
  const editor = await createNote(page, 'Walk');
  const cover = getField(editor, 'Cover');

  await cover.getByRole('button', { name: 'Browse' }).click();

  const dialog = page.getByRole('dialog', { name: 'Select Image' });
  const list = dialog.getByRole('listbox', { name: 'Available Images' });

  // Only images are offered for an image field
  await expect(list.getByRole('option')).toHaveText(['forest.png', 'ocean.png', 'sunset.png']);
  await dialog.getByRole('searchbox', { name: 'Search for Images' }).fill('oce');
  await expect(list.getByRole('option')).toHaveText(['ocean.png']);
  await selectOption(list.getByRole('option', { name: 'ocean.png' }));
  await dialog.getByRole('button', { name: 'Insert' }).click();

  await expect(cover.getByRole('textbox', { name: 'Cover' })).toHaveText('/uploads/ocean.png');
  await editor.getByRole('button', { name: 'Save' }).click();

  await expect
    .poll(async () => (await cms.readRepo())['content/notes/walk.md'])
    .toBe("---\ntitle: Walk\ncover: /uploads/ocean.png\nattachment: ''\ngallery: []\n---\n");
  // Nothing else is written
  expect(Object.keys(await cms.readRepo()).sort()).toEqual(
    [...Object.keys(MEDIA_FILES), 'content/notes/walk.md'].sort(),
  );
});

test('picks a text file for a file field', async ({ cms, page }) => {
  const editor = await createNote(page, 'Manual');
  const attachment = getField(editor, 'Attachment');

  await attachment.getByRole('button', { name: 'Browse' }).click();

  const dialog = page.getByRole('dialog', { name: 'Select File' });

  // Files of any kind are listed
  await expect(
    dialog.getByRole('listbox', { name: 'Available Files' }).getByRole('option'),
  ).toHaveText([/forest\.png/, /guide\.txt/, /ocean\.png/, /sunset\.png/]);
  await selectOption(dialog.getByRole('option', { name: 'guide.txt' }));
  await dialog.getByRole('button', { name: 'Insert' }).click();

  await expect(attachment.getByRole('textbox', { name: 'Attachment' })).toHaveText(
    '/uploads/guide.txt',
  );
  await editor.getByRole('button', { name: 'Save' }).click();

  await expect
    .poll(async () => (await cms.readRepo())['content/notes/manual.md'])
    .toBe("---\ntitle: Manual\ncover: ''\nattachment: /uploads/guide.txt\ngallery: []\n---\n");
});

test('enters an external URL', async ({ cms, page }) => {
  const editor = await createNote(page, 'Linked');
  const cover = getField(editor, 'Cover');

  await cover.getByRole('button', { name: 'Browse' }).click();

  const dialog = page.getByRole('dialog', { name: 'Select Image' });

  await selectOption(dialog.getByRole('option', { name: 'Enter URL' }));
  await expect(dialog).toContainText('Enter URL of the image:');
  await dialog.getByRole('textbox').fill('https://example.com/photo.jpg');
  await dialog.getByRole('button', { name: 'Insert' }).click();

  await expect(cover.getByRole('textbox', { name: 'Cover' })).toHaveText(
    'https://example.com/photo.jpg',
  );
  await editor.getByRole('button', { name: 'Save' }).click();

  await expect
    .poll(async () => (await cms.readRepo())['content/notes/linked.md'])
    .toBe(
      "---\ntitle: Linked\ncover: https://example.com/photo.jpg\nattachment: ''\ngallery: []\n---\n",
    );
});

test('writes an uploaded image only when the entry is saved', async ({ cms, page }) => {
  const kite = createPNG({ color: [255, 255, 0] });
  const editor = await createNote(page, 'Kite');
  const cover = getField(editor, 'Cover');

  await uploadFiles(cover, [{ name: 'kite.png', buffer: kite }]);
  await expect(cover.getByRole('button', { name: 'Replace Image' })).toBeVisible();
  expect(await cms.readRepoFile('static/uploads/kite.png')).toBeUndefined();

  await editor.getByRole('button', { name: 'Save' }).click();

  // The entry file is written last, after its assets
  await expect
    .poll(async () => (await cms.readRepo())['content/notes/kite.md'])
    .toBe("---\ntitle: Kite\ncover: /uploads/kite.png\nattachment: ''\ngallery: []\n---\n");
  expect(await cms.readRepoFile('static/uploads/kite.png')).toEqual(kite);
});

test('leaves nothing behind when an upload is cancelled with the entry', async ({ cms, page }) => {
  const editor = await createNote(page, 'Kite');

  await uploadFiles(getField(editor, 'Cover'), [
    { name: 'kite.png', buffer: createPNG({ color: [255, 255, 0] }) },
  ]);
  await expect(
    getField(editor, 'Cover').getByRole('button', { name: 'Replace Image' }),
  ).toBeVisible();
  await editor.getByRole('button', { name: 'Cancel Editing' }).click();
  await expect(editor).toBeHidden();

  expect(await cms.readRepo()).toEqual(
    Object.fromEntries(
      Object.entries(MEDIA_FILES).map(([path, content]) => [path, content.toString()]),
    ),
  );

  await page.getByRole('radio', { name: 'Assets' }).click();
  await expect(page.getByRole('option', { name: 'Global Assets (4 assets)' })).toBeVisible();
});

test('uploads several images to a multiple image field', async ({ cms, page }) => {
  const kite = createPNG({ color: [255, 255, 0] });
  const map = createPNG({ color: [0, 255, 255] });
  const moon = createPNG({ color: [200, 200, 200] });
  const editor = await createNote(page, 'Trip');
  const gallery = getField(editor, 'Gallery');

  await uploadFiles(gallery, [
    { name: 'kite.png', buffer: kite },
    { name: 'map.png', buffer: map },
  ]);
  await expect(gallery.getByRole('button', { name: 'Remove Image' })).toHaveCount(2);
  // More can be added to the list
  await uploadFiles(gallery, [{ name: 'moon.png', buffer: moon }]);
  await expect(gallery.getByRole('button', { name: 'Remove Image' })).toHaveCount(3);
  // An unsaved upload can be taken out again
  await gallery.getByRole('button', { name: 'Remove Image' }).nth(1).click();
  await expect(gallery.getByRole('button', { name: 'Remove Image' })).toHaveCount(2);
  await editor.getByRole('button', { name: 'Save' }).click();

  await expect
    .poll(async () => (await cms.readRepo())['content/notes/trip.md'])
    .toBe(
      [
        '---',
        'title: Trip',
        "cover: ''",
        "attachment: ''",
        'gallery:',
        '  - /uploads/kite.png',
        '  - /uploads/moon.png',
        '---',
        '',
      ].join('\n'),
    );
  expect(await cms.readRepoFile('static/uploads/kite.png')).toEqual(kite);
  expect(await cms.readRepoFile('static/uploads/moon.png')).toEqual(moon);
  expect(await cms.readRepoFile('static/uploads/map.png')).toBeUndefined();
});

test('renames an unsaved upload before saving', async ({ cms, page }) => {
  const kite = createPNG({ color: [255, 255, 0] });
  const editor = await createNote(page, 'Kite');
  const cover = getField(editor, 'Cover');

  await uploadFiles(cover, [{ name: 'kite.png', buffer: kite }]);
  await cover.getByRole('button', { name: 'Rename' }).click();
  await expect(cover.getByRole('textbox', { name: 'Cover' })).toHaveValue('kite.png');
  await cover.getByRole('textbox', { name: 'Cover' }).fill('sky.png');
  await cover.getByRole('button', { name: 'Done' }).click();
  await expect(cover.getByRole('textbox', { name: 'Cover' })).toHaveText(/sky\.png/);
  await editor.getByRole('button', { name: 'Save' }).click();

  await expect
    .poll(async () => (await cms.readRepo())['content/notes/kite.md'])
    .toBe("---\ntitle: Kite\ncover: /uploads/sky.png\nattachment: ''\ngallery: []\n---\n");
  expect(await cms.readRepoFile('static/uploads/sky.png')).toEqual(kite);
  expect(await cms.readRepoFile('static/uploads/kite.png')).toBeUndefined();
});

test('replaces and removes the image of a saved entry', async ({ cms, page }) => {
  const dusk = createPNG({ color: [80, 0, 120] });

  await page.getByRole('row', { name: 'Evening' }).click();

  const editor = page.getByRole('group', { name: 'Content Editor' });
  const cover = getField(editor, 'Cover');

  await expect(cover.getByRole('textbox', { name: 'Cover' })).toHaveText('/uploads/sunset.png');

  await cover.getByRole('button', { name: 'Replace Image' }).click();

  const dialog = page.getByRole('dialog', { name: 'Select Image' });

  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    dialog.getByRole('button', { name: 'Upload' }).click(),
  ]);

  await chooser.setFiles({ name: 'dusk.png', mimeType: 'image/png', buffer: dusk });
  // The upload is listed as unsaved and selected
  await expect(dialog.getByRole('option', { name: 'dusk.png' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(dialog.getByRole('option', { name: 'dusk.png' })).toContainText('Unsaved');
  await dialog.getByRole('button', { name: 'Insert' }).click();
  await expect(cover.getByRole('textbox', { name: 'Cover' })).toHaveText(/dusk\.png/);
  await editor.getByRole('button', { name: 'Save' }).click();

  await expect
    .poll(async () => (await cms.readRepo())['content/notes/evening.md'])
    .toBe("---\ntitle: Evening\ncover: /uploads/dusk.png\nattachment: ''\ngallery: []\n---\n");
  expect(await cms.readRepoFile('static/uploads/dusk.png')).toEqual(dusk);
  // The image it replaced stays in the library
  expect(await cms.readRepoFile('static/uploads/sunset.png')).toEqual(MEDIA_IMAGES.sunset);

  // Saving closes the editor
  await expect(editor).toBeHidden();
  await page.getByRole('row', { name: 'Evening' }).click();
  await cover.getByRole('button', { name: 'Remove Image' }).click();
  await expect(cover.getByRole('button', { name: 'Browse' })).toBeVisible();
  await editor.getByRole('button', { name: 'Save' }).click();

  await expect
    .poll(async () => (await cms.readRepo())['content/notes/evening.md'])
    .toBe("---\ntitle: Evening\ncover: ''\nattachment: ''\ngallery: []\n---\n");
  expect(await cms.readRepoFile('static/uploads/dusk.png')).toEqual(dusk);
});

test('uploads to the media folder of the collection', async ({ cms, page }) => {
  const tower = createPNG({ color: [90, 60, 30] });

  await page.getByRole('treeitem', { name: 'Projects' }).click();

  const editor = await createNote(page, 'Tower');

  await uploadFiles(getField(editor, 'Image'), [{ name: 'tower.png', buffer: tower }]);
  await editor.getByRole('button', { name: 'Save' }).click();

  await expect
    .poll(async () => (await cms.readRepo())['content/projects/tower.md'])
    .toBe('---\ntitle: Tower\nimage: /projects/tower.png\n---\n');
  expect(await cms.readRepoFile('static/projects/tower.png')).toEqual(tower);
});

test('uploads next to the entry in an entry-relative media folder', async ({ cms, page }) => {
  const dawn = createPNG({ color: [250, 200, 150] });

  await page.getByRole('treeitem', { name: 'Posts' }).click();

  const editor = await createNote(page, 'Dawn');

  await uploadFiles(getField(editor, 'Cover'), [{ name: 'dawn.png', buffer: dawn }]);
  await editor.getByRole('button', { name: 'Save' }).click();

  await expect
    .poll(async () => (await cms.readRepo())['content/posts/dawn/index.md'])
    .toBe('---\ntitle: Dawn\ncover: dawn.png\n---\n');
  expect(await cms.readRepoFile('content/posts/dawn/dawn.png')).toEqual(dawn);

  // The Select Image dialog offers the images of this entry only
  await expect(editor).toBeHidden();
  await page.getByRole('row', { name: 'Hello' }).click();
  await getField(editor, 'Cover').getByRole('button', { name: 'Replace Image' }).click();

  const dialog = page.getByRole('dialog', { name: 'Select Image' });

  await expect(dialog.getByRole('option', { name: 'Entry Assets' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(
    dialog.getByRole('listbox', { name: 'Available Images' }).getByRole('option'),
  ).toHaveText(['hero.png']);
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(dialog).toBeHidden();
});

test('leaves nothing behind when the Select Image dialog is cancelled', async ({ cms, page }) => {
  const editor = await createNote(page, 'Nothing');
  const cover = getField(editor, 'Cover');

  await cover.getByRole('button', { name: 'Browse' }).click();

  const dialog = page.getByRole('dialog', { name: 'Select Image' });

  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    dialog.getByRole('button', { name: 'Upload' }).click(),
  ]);

  await chooser.setFiles({
    name: 'kite.png',
    mimeType: 'image/png',
    buffer: createPNG({ color: [255, 255, 0] }),
  });
  await expect(dialog.getByRole('option', { name: 'kite.png' })).toBeVisible();
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(dialog).toBeHidden();
  await expect(cover.getByRole('button', { name: 'Browse' })).toBeVisible();

  // The upload isn’t offered again
  await cover.getByRole('button', { name: 'Browse' }).click();
  await expect(
    dialog.getByRole('listbox', { name: 'Available Images' }).getByRole('option'),
  ).toHaveText(['forest.png', 'ocean.png', 'sunset.png']);
  await dialog.getByRole('button', { name: 'Cancel' }).click();

  await editor.getByRole('button', { name: 'Save' }).click();
  await expect
    .poll(async () => (await cms.readRepo())['content/notes/nothing.md'])
    .toBe("---\ntitle: Nothing\ncover: ''\nattachment: ''\ngallery: []\n---\n");
  expect(await cms.readRepoFile('static/uploads/kite.png')).toBeUndefined();
});
