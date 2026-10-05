import { createPNG } from '../../fixtures/files.js';
import { expect, test } from '../../fixtures/test.js';

/**
 * A blog keeping its images next to each entry, with the `encode_file_path` option, which saves a
 * reference with the file name percent-encoded, brackets included.
 */
const CONFIG = {
  backend: { name: 'test-repo' },
  media_folder: 'static/uploads',
  public_folder: '/uploads',
  output: { encode_file_path: true },
  collections: [
    {
      name: 'posts',
      label: 'Posts',
      folder: 'content/posts',
      path: '{{slug}}/index',
      media_folder: '',
      public_folder: '',
      fields: [
        { name: 'title', label: 'Title' },
        { name: 'cover', label: 'Cover', widget: 'image' },
      ],
    },
  ],
};

test.use({ config: CONFIG });

test('renames an asset next to an entry and updates its encoded reference', async ({
  cms,
  page,
}) => {
  const photo = createPNG({ color: [10, 120, 200] });

  await cms.open();
  await cms.seed({
    'content/posts/hello/index.md': '---\ntitle: Hello\ncover: photo%20%281%29.png\n---\n',
    'content/posts/hello/photo (1).png': photo,
  });
  await cms.signIn();
  await page.getByRole('radio', { name: 'Assets' }).click();
  await page.getByRole('option', { name: /Posts/ }).click();
  await page.getByRole('row', { name: 'photo (1).png' }).click();
  await cms.chooseMenuItem(
    page.getByRole('button', { name: 'Show Edit Options' }),
    page.getByRole('menuitem', { name: 'Rename Asset' }),
  );

  const dialog = page.getByRole('dialog', { name: /Rename.*photo \(1\)\.png/ });

  await expect(dialog).toContainText('An entry using the asset will also be updated.');
  await dialog.getByRole('textbox').fill('photo (2).png');
  await dialog.getByRole('button', { name: 'Rename' }).click();

  // The entry file is written last, after its assets
  await expect
    .poll(async () => (await cms.readRepo())['content/posts/hello/index.md'])
    .toBe('---\ntitle: Hello\ncover: photo%20%282%29.png\n---\n');
  expect(await cms.readRepoFile('content/posts/hello/photo (2).png')).toEqual(photo);
});
