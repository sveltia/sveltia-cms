import { createPNG } from '../../fixtures/files.js';
import { expect, test } from '../../fixtures/test.js';
import { getEditor, getField } from '../../fixtures/ui.js';

/**
 * @import { Locator, Page } from '@playwright/test';
 */

/**
 * A collection of notes with a File field taking documents only, an Image field taking PNG images
 * only, and an Image field taking any supported image.
 */
const CONFIG = {
  backend: { name: 'test-repo' },
  media_folder: 'static/uploads',
  public_folder: '/uploads',
  collections: [
    {
      name: 'notes',
      label: 'Notes',
      label_singular: 'Note',
      folder: 'content/notes',
      create: true,
      fields: [
        { name: 'title', label: 'Title' },
        {
          name: 'document',
          label: 'Document',
          widget: 'file',
          accept: '.pdf, .txt',
          required: false,
        },
        { name: 'photo', label: 'Photo', widget: 'image', accept: 'image/png', required: false },
        { name: 'cover', label: 'Cover', widget: 'image', required: false },
      ],
    },
  ],
};

/** A minimal PDF file, which the CMS stores as is. */
const PDF = Buffer.from('%PDF-1.4\n%%EOF\n');

const FILES = {
  'static/uploads/guide.pdf': PDF,
  'static/uploads/readme.txt': 'Read me first.\n',
  'static/uploads/sunset.png': createPNG({ color: [255, 128, 0] }),
  'static/uploads/logo.svg':
    '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8"/></svg>\n',
};

/** The image types an Image field accepts by default, with the HEIC ones left out. */
const IMAGE_TYPES = 'image/avif,image/gif,image/jpeg,image/png,image/webp,image/svg+xml';

test.use({ config: CONFIG });

test.beforeEach(async ({ cms, page }) => {
  await cms.open();
  await cms.seed(FILES);
  await cms.signIn();
  await page.getByRole('button', { name: 'Create New Entry' }).first().click();
  await getEditor(page).getByRole('textbox', { name: 'Title' }).fill('Memo');
});

/**
 * Check that a file added to a field is refused with the given message, and nothing is added.
 * @param {Page} page Page.
 * @param {Locator} field Field group.
 * @param {string} message Message of the alert dialog.
 */
const expectRefused = async (page, field, message) => {
  const alert = page.getByRole('alertdialog', { name: 'Unsupported File Type' });

  await expect(alert).toContainText(message);
  await alert.getByRole('button', { name: 'OK' }).click();
  await expect(alert).toBeHidden();
  await expect(field.getByRole('button', { name: 'Browse' })).toBeVisible();
};

test('narrows the file picker to the accepted types', async ({ page }) => {
  // The value is passed on as is, and an Image field defaults to the supported image types
  await expect(
    getField(page, 'Document', { exact: true }).locator('input[type="file"]').first(),
  ).toHaveAttribute('accept', '.pdf, .txt');
  await expect(
    getField(page, 'Photo', { exact: true }).locator('input[type="file"]').first(),
  ).toHaveAttribute('accept', 'image/png');
  await expect(
    getField(page, 'Cover', { exact: true }).locator('input[type="file"]').first(),
  ).toHaveAttribute('accept', IMAGE_TYPES);

  // The Upload button in the Select File dialog opens a picker narrowed the same way
  await getField(page, 'Document', { exact: true }).getByRole('button', { name: 'Browse' }).click();

  const dialog = page.getByRole('dialog', { name: 'Select File' });

  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    dialog.getByRole('button', { name: 'Upload' }).click(),
  ]);

  expect(await chooser.element().getAttribute('accept')).toBe('.pdf, .txt');
});

test('refuses a dropped file of another type', async ({ cms, page }) => {
  const document = getField(page, 'Document', { exact: true });

  // A file extension is matched in any case
  await cms.dropFiles(document, [{ name: 'photo.PNG', buffer: createPNG({ color: [0, 0, 255] }) }]);
  await expectRefused(
    page,
    document,
    'This file cannot be uploaded because it’s not one of the following types: \u2068.pdf or .txt\u2069.',
  );

  // A MIME type is matched against the type the browser gives the file
  const photo = getField(page, 'Photo', { exact: true });

  await cms.dropFiles(photo, [
    { name: 'logo.svg', buffer: Buffer.from(FILES['static/uploads/logo.svg']) },
  ]);
  await expectRefused(
    page,
    photo,
    'This file cannot be uploaded because it’s not one of the following types: \u2068image/png\u2069.',
  );

  // The default types of an Image field are named as formats
  const cover = getField(page, 'Cover', { exact: true });

  await cms.dropFiles(cover, [{ name: 'notes.txt', buffer: Buffer.from('Hello\n') }]);
  await expectRefused(
    page,
    cover,
    'This file cannot be uploaded because only an image of the following types is accepted: ' +
      '\u2068AVIF, GIF, JPEG, PNG, WebP, or SVG\u2069.',
  );

  await getEditor(page).getByRole('button', { name: 'Save' }).click();
  await expect
    .poll(async () => (await cms.readRepo())['content/notes/memo.md'])
    .toBe("---\ntitle: Memo\ndocument: ''\nphoto: ''\ncover: ''\n---\n");
  expect(await cms.readRepoFile('static/uploads/photo.PNG')).toBeUndefined();
  expect(await cms.readRepoFile('static/uploads/notes.txt')).toBeUndefined();
});

test('takes a dropped file of an accepted type', async ({ cms, page }) => {
  const minutes = Buffer.from('%PDF-1.4\n% minutes\n%%EOF\n');
  const kite = createPNG({ color: [255, 255, 0] });

  await cms.dropFiles(getField(page, 'Document', { exact: true }), [
    { name: 'minutes.pdf', buffer: minutes },
  ]);
  await expect(
    getField(page, 'Document', { exact: true }).getByRole('textbox', { name: 'Document' }),
  ).toHaveText('/uploads/minutes.pdf');
  await cms.dropFiles(getField(page, 'Photo', { exact: true }), [
    { name: 'kite.png', buffer: kite },
  ]);
  await expect(
    getField(page, 'Photo', { exact: true }).getByRole('button', { name: 'Replace Image' }),
  ).toBeVisible();

  await getEditor(page).getByRole('button', { name: 'Save' }).click();
  await expect
    .poll(async () => (await cms.readRepo())['content/notes/memo.md'])
    .toBe(
      "---\ntitle: Memo\ndocument: /uploads/minutes.pdf\nphoto: /uploads/kite.png\ncover: ''\n---\n",
    );
  expect(await cms.readRepoFile('static/uploads/minutes.pdf')).toEqual(minutes);
  expect(await cms.readRepoFile('static/uploads/kite.png')).toEqual(kite);
});

test('refuses a file of another type dropped in the Select File dialog', async ({ cms, page }) => {
  await getField(page, 'Document', { exact: true }).getByRole('button', { name: 'Browse' }).click();

  const dialog = page.getByRole('dialog', { name: 'Select File' });
  const list = dialog.getByRole('listbox', { name: 'Available Files' });

  await expect(list.getByRole('option').first()).toBeVisible();
  await cms.dropFiles(list, [{ name: 'kite.png', buffer: createPNG({ color: [255, 255, 0] }) }]);

  // The file is only checked once inserted, as a transformation could change its format
  await expect(list.getByRole('option', { name: /kite\.png/ })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await dialog.getByRole('button', { name: 'Insert' }).click();
  await expect(dialog).toBeHidden();
  await expectRefused(
    page,
    getField(page, 'Document', { exact: true }),
    'This file cannot be uploaded because it’s not one of the following types: \u2068.pdf or .txt\u2069.',
  );

  await getEditor(page).getByRole('button', { name: 'Save' }).click();
  await expect
    .poll(async () => (await cms.readRepo())['content/notes/memo.md'])
    .toBe("---\ntitle: Memo\ndocument: ''\nphoto: ''\ncover: ''\n---\n");
  expect(await cms.readRepoFile('static/uploads/kite.png')).toBeUndefined();
});

test('lists only existing files of the accepted types in the Select File dialog', async ({
  page,
}) => {
  // An existing file is never transformed, so one of another type can’t be used
  await getField(page, 'Document', { exact: true }).getByRole('button', { name: 'Browse' }).click();

  const fileDialog = page.getByRole('dialog', { name: 'Select File' });

  await expect(
    fileDialog.getByRole('listbox', { name: 'Available Files' }).getByRole('option'),
  ).toHaveText([/guide\.pdf/, /readme\.txt/]);
  await page.keyboard.press('Escape');
  await expect(fileDialog).toBeHidden();

  await getField(page, 'Photo', { exact: true }).getByRole('button', { name: 'Browse' }).click();

  const imageDialog = page.getByRole('dialog', { name: 'Select Image' });

  await expect(
    imageDialog.getByRole('listbox', { name: 'Available Images' }).getByRole('option'),
  ).toHaveText(['sunset.png']);
});

test('refuses a file of another type chosen in the file picker', async ({ cms, page }) => {
  // The `accept` attribute narrows the picker, while a picker can still offer every file, like the
  // “All Files” filter on Windows
  const document = getField(page, 'Document', { exact: true });
  const kite = { name: 'kite.png', mimeType: 'image/png', buffer: createPNG({ color: [0, 0, 0] }) };

  const message =
    'This file cannot be uploaded because it’s not one of the following types: \u2068.pdf or .txt\u2069.';

  await document.locator('input[type="file"]').first().setInputFiles(kite);
  await expectRefused(page, document, message);

  // The same goes for the Upload button in the Select File dialog, once the file is inserted
  await document.getByRole('button', { name: 'Browse' }).click();

  const dialog = page.getByRole('dialog', { name: 'Select File' });

  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    dialog.getByRole('button', { name: 'Upload' }).click(),
  ]);

  await chooser.setFiles(kite);
  await expect(
    dialog.getByRole('listbox', { name: 'Available Files' }).getByRole('option', {
      name: /kite\.png/,
    }),
  ).toHaveAttribute('aria-selected', 'true');
  await dialog.getByRole('button', { name: 'Insert' }).click();
  await expectRefused(page, document, message);

  await getEditor(page).getByRole('button', { name: 'Save' }).click();
  await expect
    .poll(async () => (await cms.readRepo())['content/notes/memo.md'])
    .toBe("---\ntitle: Memo\ndocument: ''\nphoto: ''\ncover: ''\n---\n");
  expect(await cms.readRepoFile('static/uploads/kite.png')).toBeUndefined();
});

test.describe('with a transformation', () => {
  // The Photo field takes WebP images only, and PNG images are converted to WebP on upload
  test.use({
    config: {
      ...CONFIG,
      collections: CONFIG.collections.map((collection) => ({
        ...collection,
        fields: collection.fields.map((field) =>
          field.name === 'photo'
            ? {
                ...field,
                accept: 'image/webp',
                media_libraries: {
                  default: { config: { transformations: { raster_image: { format: 'webp' } } } },
                },
              }
            : field,
        ),
      })),
    },
  });

  test('takes a file of another type that is converted to an accepted one', async ({
    cms,
    page,
  }) => {
    const photo = getField(page, 'Photo', { exact: true });

    // Checked once converted, whether dropped or picked
    await cms.dropFiles(photo, [{ name: 'kite.png', buffer: createPNG({ color: [255, 255, 0] }) }]);
    await expect(photo.getByRole('button', { name: 'Replace Image' })).toBeVisible();
    await expect(page.getByRole('alertdialog')).toBeHidden();

    await getEditor(page).getByRole('button', { name: 'Save' }).click();
    await expect
      .poll(async () => (await cms.readRepo())['content/notes/memo.md'])
      .toBe("---\ntitle: Memo\ndocument: ''\nphoto: /uploads/kite.webp\ncover: ''\n---\n");

    const webp = await cms.readRepoFile('static/uploads/kite.webp');

    expect(webp?.subarray(8, 12).toString('ascii')).toBe('WEBP');
    expect(await cms.readRepoFile('static/uploads/kite.png')).toBeUndefined();
  });

  test('takes a picked file of another type that is converted to an accepted one', async ({
    cms,
    page,
  }) => {
    const photo = getField(page, 'Photo', { exact: true });

    await photo
      .locator('input[type="file"]')
      .first()
      .setInputFiles({
        name: 'moth.png',
        mimeType: 'image/png',
        buffer: createPNG({ color: [0, 128, 255] }),
      });
    await expect(photo.getByRole('button', { name: 'Replace Image' })).toBeVisible();
    await expect(page.getByRole('alertdialog')).toBeHidden();

    await getEditor(page).getByRole('button', { name: 'Save' }).click();
    await expect
      .poll(async () => (await cms.readRepo())['content/notes/memo.md'])
      .toBe("---\ntitle: Memo\ndocument: ''\nphoto: /uploads/moth.webp\ncover: ''\n---\n");
    expect((await cms.readRepoFile('static/uploads/moth.webp'))?.subarray(8, 12).toString()).toBe(
      'WEBP',
    );
  });
});
