import { MEDIA_CONFIG, MEDIA_FILES } from '../../fixtures/configs/media.js';
import { createPNG } from '../../fixtures/files.js';
import { expect, test } from '../../fixtures/test.js';
import { getEditor, getField } from '../../fixtures/ui.js';

/**
 * A collection whose media folder has template tags, resolving to a dated folder below the global
 * one that every article uploaded in the same month shares (#1198).
 */
test.use({
  config: {
    ...MEDIA_CONFIG,
    collections: [
      {
        name: 'articles',
        label: 'Articles',
        label_singular: 'Article',
        folder: 'content/articles',
        create: true,
        media_folder: '{{media_folder}}/{{year}}/{{month}}',
        public_folder: '{{public_folder}}/{{year}}/{{month}}',
        fields: [
          { name: 'title', label: 'Title' },
          { name: 'image', label: 'Image', widget: 'image', required: false },
        ],
      },
    ],
  },
});

const petal = createPNG({ color: [240, 150, 180] });

test.beforeEach(async ({ cms }) => {
  await cms.open();
  await cms.seed({ ...MEDIA_FILES, 'static/uploads/2025/03/petal.png': petal });
  await cms.signIn();
});

test('browses Global Assets but uploads to the dated folder', async ({ cms, page }) => {
  await page.getByRole('button', { name: 'Create New Entry' }).first().click();

  const editor = getEditor(page);
  const image = getField(editor, 'Image', { exact: true });

  await editor.getByRole('textbox', { name: 'Title' }).fill('Spring');

  // The folder the tags resolve to is shared with other entries, so it isn’t offered as Entry
  // Assets, which would be empty for a new entry; Global Assets lists the existing images
  await image.getByRole('button', { name: 'Browse' }).click();

  const dialog = page.getByRole('dialog', { name: 'Select Image' });
  const list = dialog.getByRole('listbox', { name: 'Available Images' });

  await expect(dialog.getByRole('option', { name: 'Global Assets' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(dialog.getByRole('option', { name: 'Entry Assets' })).toHaveCount(0);
  await expect(list.getByRole('option')).toHaveText(['forest.png', 'ocean.png', 'sunset.png']);
  // An image an earlier article uploaded to a dated folder is found there too
  await dialog.getByRole('searchbox', { name: 'Search for Images' }).fill('petal');
  await expect(list.getByRole('option')).toHaveText([/petal\.png/]);
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(dialog).toBeHidden();

  // A file added to the field still goes to the folder the tags resolve to
  const blossom = createPNG({ color: [255, 190, 210] });

  await image
    .locator('input[type="file"]')
    .first()
    .setInputFiles([{ name: 'blossom.png', mimeType: 'image/png', buffer: blossom }]);
  await editor.getByRole('button', { name: 'Save' }).click();

  await expect
    .poll(async () => (await cms.readRepo())['content/articles/spring.md'])
    .toMatch(/^---\ntitle: Spring\nimage: \/uploads\/\d{4}\/\d{2}\/blossom\.png\n---\n$/);

  const [path] = Object.keys(await cms.readRepo()).filter((p) => p.endsWith('/blossom.png'));

  expect(path).toMatch(/^static\/uploads\/\d{4}\/\d{2}\/blossom\.png$/);
  expect(await cms.readRepoFile(path)).toEqual(blossom);
});
