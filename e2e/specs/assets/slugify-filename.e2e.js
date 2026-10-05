import { MEDIA_CONFIG, MEDIA_FILES, MEDIA_IMAGES } from '../../fixtures/configs/media.js';
import { createPNG } from '../../fixtures/files.js';
import { expect, test } from '../../fixtures/test.js';

/**
 * {@link MEDIA_CONFIG} with the `slugify_filename` option enabled for the whole site.
 */
const CONFIG = {
  ...MEDIA_CONFIG,
  media_libraries: { default: { config: { slugify_filename: true } } },
};

test.use({ config: CONFIG });

test.beforeEach(async ({ cms }) => {
  await cms.open();
  await cms.seed(MEDIA_FILES);
  await cms.signIn();
});

test('slugifies the name of an uploaded file', async ({ cms, page }) => {
  const kite = createPNG({ color: [255, 255, 0] });

  await page.getByRole('radio', { name: 'Assets' }).click();
  await page.getByRole('option', { name: /Global Assets/ }).click();
  await page.getByRole('button', { name: 'Upload New Assets' }).click();

  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page
      .getByRole('dialog', { name: 'Upload New Assets' })
      .getByRole('button', { name: 'Choose Files' })
      .click(),
  ]);

  await chooser.setFiles([{ name: 'Blog Photo 1.PNG', mimeType: 'image/png', buffer: kite }]);

  const dialog = page.getByRole('alertdialog', { name: 'Upload New Assets' });

  await expect(dialog.getByRole('listitem')).toHaveText([/blog-photo-1\.png/]);
  await dialog.getByRole('button', { name: 'Upload' }).click();

  await expect.poll(() => cms.readRepoFile('static/uploads/blog-photo-1.png')).toEqual(kite);
});

test('slugifies the new name of an asset renamed in the Asset Library', async ({ cms, page }) => {
  await page.getByRole('radio', { name: 'Assets' }).click();
  await page.getByRole('option', { name: /Global Assets/ }).click();
  await page.getByRole('row', { name: 'sunset.png' }).click();
  await cms.chooseMenuItem(
    page.getByRole('button', { name: 'Show Edit Options' }),
    page.getByRole('menuitem', { name: 'Rename Asset' }),
  );

  const dialog = page.getByRole('dialog', { name: /Rename.*sunset\.png/ });

  await dialog.getByRole('textbox').fill('Evening Sky 1.png');
  // The resulting name is shown before the rename
  await expect(dialog.getByRole('status')).toHaveText(
    'The file will be saved as “\u2068evening-sky-1.png\u2069”.',
  );
  await dialog.getByRole('button', { name: 'Rename' }).click();

  await expect
    .poll(() => cms.readRepoFile('static/uploads/evening-sky-1.png'))
    .toEqual(MEDIA_IMAGES.sunset);
  expect(await cms.readRepoFile('static/uploads/Evening Sky 1.png')).toBeUndefined();
  expect(await cms.readRepoFile('static/uploads/sunset.png')).toBeUndefined();
  expect((await cms.readRepo())['content/notes/evening.md']).toBe(
    '---\ntitle: Evening\ncover: /uploads/evening-sky-1.png\n---\n',
  );
});

test('slugifies the new name of an unsaved upload renamed in a field', async ({ cms, page }) => {
  const kite = createPNG({ color: [255, 255, 0] });

  await page.getByRole('button', { name: 'Create New Entry' }).first().click();

  const editor = page.getByRole('group', { name: 'Content Editor' });
  const cover = editor.getByRole('group', { name: '“\u2068Cover\u2069” Field' });

  await editor.getByRole('textbox', { name: 'Title' }).fill('Kite');
  await cover
    .locator('input[type="file"]')
    .first()
    .setInputFiles([{ name: 'kite.png', mimeType: 'image/png', buffer: kite }]);
  await cover.getByRole('button', { name: 'Rename' }).click();
  await cover.getByRole('textbox', { name: 'Cover' }).fill('Blog Photo 1.png');
  await expect(cover.getByRole('status')).toHaveText(
    'The file will be saved as “\u2068blog-photo-1.png\u2069”.',
  );
  await cover.getByRole('button', { name: 'Done' }).click();
  await expect(cover.getByRole('textbox', { name: 'Cover' })).toHaveText(/blog-photo-1\.png/);
  await editor.getByRole('button', { name: 'Save' }).click();

  await expect
    .poll(async () => (await cms.readRepo())['content/notes/kite.md'])
    .toBe("---\ntitle: Kite\ncover: /uploads/blog-photo-1.png\nattachment: ''\ngallery: []\n---\n");
  expect(await cms.readRepoFile('static/uploads/blog-photo-1.png')).toEqual(kite);
});
