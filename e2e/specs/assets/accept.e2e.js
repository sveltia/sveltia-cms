import { createPNG } from '../../fixtures/files.js';
import { expect, test } from '../../fixtures/test.js';

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
  await page
    .getByRole('group', { name: 'Content Editor' })
    .getByRole('textbox', { name: 'Title' })
    .fill('Memo');
});

/**
 * Get a field group in the editor.
 * @param {Page} page Page.
 * @param {string} label Field label.
 * @returns {Locator} Field group.
 */
const getField = (page, label) =>
  page
    .getByRole('group', { name: 'Content Editor' })
    .getByRole('group', { name: `“\u2068${label}\u2069” Field` });

/**
 * Check that a file dropped on a field is refused with the given message, and nothing is added.
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
  await expect(getField(page, 'Document').locator('input[type="file"]').first()).toHaveAttribute(
    'accept',
    '.pdf, .txt',
  );
  await expect(getField(page, 'Photo').locator('input[type="file"]').first()).toHaveAttribute(
    'accept',
    'image/png',
  );
  await expect(getField(page, 'Cover').locator('input[type="file"]').first()).toHaveAttribute(
    'accept',
    IMAGE_TYPES,
  );

  // The Upload button in the Select File dialog opens a picker narrowed the same way
  await getField(page, 'Document').getByRole('button', { name: 'Browse' }).click();

  const dialog = page.getByRole('dialog', { name: 'Select File' });

  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    dialog.getByRole('button', { name: 'Upload' }).click(),
  ]);

  expect(await chooser.element().getAttribute('accept')).toBe('.pdf, .txt');
});

test('refuses a dropped file of another type', async ({ cms, page }) => {
  const document = getField(page, 'Document');

  // A file extension is matched in any case
  await cms.dropFiles(document, [{ name: 'photo.PNG', buffer: createPNG({ color: [0, 0, 255] }) }]);
  await expectRefused(
    page,
    document,
    'The dropped file is not one of the following types: \u2068.pdf or .txt\u2069. Please try again.',
  );

  // A MIME type is matched against the type the browser gives the file
  const photo = getField(page, 'Photo');

  await cms.dropFiles(photo, [
    { name: 'logo.svg', buffer: Buffer.from(FILES['static/uploads/logo.svg']) },
  ]);
  await expectRefused(
    page,
    photo,
    'The dropped file is not one of the following types: \u2068image/png\u2069. Please try again.',
  );

  // The default types of an Image field are named as formats
  const cover = getField(page, 'Cover');

  await cms.dropFiles(cover, [{ name: 'notes.txt', buffer: Buffer.from('Hello\n') }]);
  await expectRefused(
    page,
    cover,
    'The dropped file is not supported. Only an image of the following types is accepted: ' +
      '\u2068AVIF, GIF, JPEG, PNG, WebP, or SVG\u2069. Please try again.',
  );

  await page
    .getByRole('group', { name: 'Content Editor' })
    .getByRole('button', { name: 'Save' })
    .click();
  await expect
    .poll(async () => (await cms.readRepo())['content/notes/memo.md'])
    .toBe("---\ntitle: Memo\ndocument: ''\nphoto: ''\ncover: ''\n---\n");
  expect(await cms.readRepoFile('static/uploads/photo.PNG')).toBeUndefined();
  expect(await cms.readRepoFile('static/uploads/notes.txt')).toBeUndefined();
});

test('takes a dropped file of an accepted type', async ({ cms, page }) => {
  const minutes = Buffer.from('%PDF-1.4\n% minutes\n%%EOF\n');
  const kite = createPNG({ color: [255, 255, 0] });

  await cms.dropFiles(getField(page, 'Document'), [{ name: 'minutes.pdf', buffer: minutes }]);
  await expect(getField(page, 'Document').getByRole('textbox', { name: 'Document' })).toHaveText(
    '/uploads/minutes.pdf',
  );
  await cms.dropFiles(getField(page, 'Photo'), [{ name: 'kite.png', buffer: kite }]);
  await expect(
    getField(page, 'Photo').getByRole('button', { name: 'Replace Image' }),
  ).toBeVisible();

  await page
    .getByRole('group', { name: 'Content Editor' })
    .getByRole('button', { name: 'Save' })
    .click();
  await expect
    .poll(async () => (await cms.readRepo())['content/notes/memo.md'])
    .toBe(
      "---\ntitle: Memo\ndocument: /uploads/minutes.pdf\nphoto: /uploads/kite.png\ncover: ''\n---\n",
    );
  expect(await cms.readRepoFile('static/uploads/minutes.pdf')).toEqual(minutes);
  expect(await cms.readRepoFile('static/uploads/kite.png')).toEqual(kite);
});

test('refuses a file of another type dropped in the Select File dialog', async ({ cms, page }) => {
  await getField(page, 'Document').getByRole('button', { name: 'Browse' }).click();

  const dialog = page.getByRole('dialog', { name: 'Select File' });
  const list = dialog.getByRole('listbox', { name: 'Available Files' });

  await expect(list.getByRole('option').first()).toBeVisible();
  await cms.dropFiles(list, [{ name: 'kite.png', buffer: createPNG({ color: [255, 255, 0] }) }]);

  const alert = page.getByRole('alertdialog', { name: 'Unsupported File Type' });

  await expect(alert).toContainText(
    'The dropped file is not one of the following types: \u2068.pdf or .txt\u2069. Please try again.',
  );
  await alert.getByRole('button', { name: 'OK' }).click();
  await expect(list.getByRole('option', { name: 'kite.png' })).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: 'Insert' })).toBeDisabled();
});

test('lists existing files of any type in the Select File dialog (known issue)', async ({
  page,
}) => {
  // Known issue: `accept` only applies to new files, so an existing file of another type can still
  // be picked from the dialog, and an Image field limited to PNG images lists an SVG image. Once
  // the dialog filters the files by `accept` too, expect only `guide.pdf` and `readme.txt` for the
  // File field, and only `sunset.png` for the Image field
  await getField(page, 'Document').getByRole('button', { name: 'Browse' }).click();

  const fileDialog = page.getByRole('dialog', { name: 'Select File' });

  await expect(
    fileDialog.getByRole('listbox', { name: 'Available Files' }).getByRole('option'),
  ).toHaveText([/guide\.pdf/, /logo\.svg/, /readme\.txt/, /sunset\.png/]);
  await page.keyboard.press('Escape');
  await expect(fileDialog).toBeHidden();

  await getField(page, 'Photo').getByRole('button', { name: 'Browse' }).click();

  const imageDialog = page.getByRole('dialog', { name: 'Select Image' });

  await expect(
    imageDialog.getByRole('listbox', { name: 'Available Images' }).getByRole('option'),
  ).toHaveText(['logo.svg', 'sunset.png']);
});

test('takes a file of another type chosen in the file picker (known issue)', async ({
  cms,
  page,
}) => {
  // Known issue: the type of a file chosen in the browser’s file picker isn’t checked, as the
  // `accept` attribute is taken to narrow the picker, while a picker can still offer every file,
  // like the “All Files” filter on Windows. Once it’s checked like a dropped file, expect the
  // Unsupported File Type dialog and an empty field
  const kite = createPNG({ color: [255, 255, 0] });

  await getField(page, 'Document')
    .locator('input[type="file"]')
    .first()
    .setInputFiles({ name: 'kite.png', mimeType: 'image/png', buffer: kite });
  await expect(getField(page, 'Document').getByRole('textbox', { name: 'Document' })).toHaveText(
    '/uploads/kite.png',
  );
  await page
    .getByRole('group', { name: 'Content Editor' })
    .getByRole('button', { name: 'Save' })
    .click();
  await expect
    .poll(async () => (await cms.readRepo())['content/notes/memo.md'])
    .toBe("---\ntitle: Memo\ndocument: /uploads/kite.png\nphoto: ''\ncover: ''\n---\n");
  expect(await cms.readRepoFile('static/uploads/kite.png')).toEqual(kite);
});
