import { expect, test } from '../../fixtures/test.js';

import { getEditor, getEditPane } from './helpers.js';

/**
 * A multilingual blog whose posts have a KeyValue field duplicated to every locale.
 */
const CONFIG = {
  backend: { name: 'test-repo' },
  media_folder: 'static/uploads',
  i18n: { structure: 'multiple_files', locales: ['en', 'fr'], default_locale: 'en' },
  collections: [
    {
      name: 'posts',
      label: 'Posts',
      folder: 'content/posts',
      i18n: true,
      fields: [
        { name: 'title', label: 'Title', i18n: true },
        { name: 'metadata', label: 'Metadata', widget: 'keyvalue', i18n: 'duplicate' },
      ],
    },
  ],
};

/**
 * Get the content of a post file.
 * @param {string} title Title.
 * @param {string} pairs Metadata pairs in YAML.
 * @returns {string} File content.
 */
const getPost = (title, pairs) => `---\ntitle: ${title}\nmetadata:\n${pairs}---\n`;

test.use({ config: CONFIG });

test.beforeEach(async ({ cms, page }) => {
  await cms.open();
  // The French file lists the pairs in another order, as it may when edited by hand
  await cms.seed({
    'content/posts/hello.en.md': getPost('Hello', "  capacity: '120'\n  parking: free\n"),
    'content/posts/hello.fr.md': getPost('Bonjour', "  parking: free\n  capacity: '120'\n"),
  });
  await cms.signIn();
  await page.getByRole('row', { name: /Hello/ }).click();
  await expect(getEditPane(page, 'English').getByRole('group', { name: /Metadata/ })).toBeVisible();
});

test('opens an entry whose locales list the duplicated pairs in different orders', async ({
  page,
}) => {
  // The pairs are lined up with the default locale’s, which is no change of the user’s
  await expect(getEditor(page).getByRole('button', { name: 'Save' })).toBeDisabled();
});

test('saves the duplicated pairs in the new order in every locale', async ({ cms, page }) => {
  const metadata = getEditPane(page, 'English').getByRole('group', { name: /Metadata/ });

  await metadata.getByRole('button', { name: 'Reorder Item' }).first().focus();
  await page.keyboard.press('ArrowDown');
  await getEditor(page).getByRole('button', { name: 'Save' }).click();

  await expect
    .poll(async () => {
      const files = await cms.readRepo();

      return [files['content/posts/hello.en.md'], files['content/posts/hello.fr.md']];
    })
    .toEqual([
      getPost('Hello', "  parking: free\n  capacity: '120'\n"),
      getPost('Bonjour', "  parking: free\n  capacity: '120'\n"),
    ]);
});
