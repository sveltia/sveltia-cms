import { createPNG } from '../fixtures/files.js';
import { BASE_CONFIG, expect, test } from '../fixtures/test.js';

test.use({
  config: {
    ...BASE_CONFIG,
    collections: [
      {
        ...BASE_CONFIG.collections[0],
        fields: [
          { name: 'title', label: 'Title' },
          { name: 'image', label: 'Image', widget: 'image' },
        ],
      },
    ],
  },
});

test('uploads an image with an entry', async ({ cms, page }) => {
  const image = createPNG({ color: [0, 128, 255] });

  await cms.open();
  await cms.signIn();
  await page.getByRole('button', { name: 'Create New Entry' }).first().click();

  const editor = page.getByRole('group', { name: 'Content Editor' });
  const imageField = editor.getByRole('group', { name: /Image/ });

  await editor.getByRole('textbox', { name: 'Title' }).fill('Photo Post');
  // The field has no visible file input; the hidden one behind the Browse button takes the file
  await imageField
    .locator('input[type="file"]')
    .first()
    .setInputFiles({ name: 'photo.png', mimeType: 'image/png', buffer: image });
  await expect(imageField.getByRole('button', { name: 'Replace Image' })).toBeVisible();
  await editor.getByRole('button', { name: 'Save' }).click();

  await expect
    .poll(async () => (await cms.readRepo())['content/posts/photo-post.md'])
    .toBe('---\ntitle: Photo Post\nimage: /images/photo.png\n---\n');
  expect(await cms.readRepoFile('static/images/photo.png')).toEqual(image);

  // The upload is listed in the Asset Library
  await page.getByRole('radio', { name: 'Assets' }).click();
  await expect(
    page.getByRole('grid', { name: 'Assets' }).getByRole('row', { name: 'photo.png' }),
  ).toBeVisible();
});
