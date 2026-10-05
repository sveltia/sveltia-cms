import { createPNG } from '../../fixtures/files.js';
import { expect, test } from '../../fixtures/test.js';

/**
 * Config whose collections use the `{{filename}}` template tag for the summary and the media
 * folder: a blog, and a `multiple_files` collection, whose file names end with a locale code.
 */
const CONFIG = {
  backend: { name: 'test-repo' },
  media_folder: 'static/images',
  public_folder: '/images',
  i18n: { structure: 'multiple_files', locales: ['en', 'fr'] },
  collections: [
    {
      name: 'posts',
      label: 'Posts',
      label_singular: 'Post',
      folder: 'content/posts',
      summary: '{{filename}}',
      media_folder: '/static/media/{{filename}}',
      public_folder: '/media/{{filename}}',
      fields: [
        { name: 'title', label: 'Title' },
        { name: 'cover', label: 'Cover', widget: 'image', required: false },
      ],
    },
    {
      name: 'pages',
      label: 'Pages',
      label_singular: 'Page',
      folder: 'content/pages',
      summary: '{{filename}}',
      i18n: true,
      fields: [{ name: 'title', label: 'Title', i18n: true }],
    },
  ],
};

const FILES = {
  'content/posts/my.post.md': '---\ntitle: My Post\ncover: \n---\n',
  'content/pages/index.en.md': '---\ntitle: Home\n---\n',
  'content/pages/index.fr.md': '---\ntitle: Accueil\n---\n',
  'content/pages/about.us.en.md': '---\ntitle: About Us\n---\n',
  'content/pages/about.us.fr.md': '---\ntitle: À propos\n---\n',
};

test.use({ config: CONFIG });

test.beforeEach(async ({ cms }) => {
  await cms.open();
  await cms.seed(FILES);
  await cms.signIn();
});

test('strips only the last extension, and the locale code, in the summary', async ({ page }) => {
  const rows = page.getByRole('grid', { name: 'Entries' }).getByRole('row');

  await expect(rows).toHaveText(['my.post']);

  await page.getByRole('treeitem', { name: 'Pages' }).click();
  await expect(rows).toHaveText(['about.us', 'index']);
});

test('strips only the last extension in the media folder', async ({ cms, page }) => {
  // Open the only post, `my.post.md`
  await page.getByRole('grid', { name: 'Entries' }).getByRole('row').click();

  const editor = page.getByRole('group', { name: 'Content Editor' });
  const cover = editor.getByRole('group', { name: '“\u2068Cover\u2069” Field' });
  const kite = createPNG({ color: [255, 255, 0] });

  await cover
    .locator('input[type="file"]')
    .first()
    .setInputFiles({ name: 'kite.png', mimeType: 'image/png', buffer: kite });
  await expect(cover.getByRole('button', { name: 'Replace Image' })).toBeVisible();
  await editor.getByRole('button', { name: 'Save' }).click();

  // The entry file is written last, after its assets
  await expect
    .poll(async () => (await cms.readRepo())['content/posts/my.post.md'])
    .toBe('---\ntitle: My Post\ncover: /media/my.post/kite.png\n---\n');
  expect(await cms.readRepoFile('static/media/my.post/kite.png')).toEqual(kite);
});
