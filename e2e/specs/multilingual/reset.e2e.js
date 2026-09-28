import { expect, test } from '../../fixtures/test.js';

import { getEditor, getEditPane } from './helpers.js';

/**
 * A multilingual blog whose posts are stored in a folder for each locale, under a localized slug,
 * with a key linking the translations of a post. The fields have default values, and are either
 * translated, duplicated from English, or hold keys duplicated from English with translated values.
 */
const CONFIG = {
  backend: { name: 'test-repo' },
  media_folder: 'static/uploads',
  i18n: { structure: 'multiple_files', locales: ['en', 'fr'], default_locale: 'en' },
  collections: [
    {
      name: 'posts',
      label: 'Posts',
      folder: 'content/{{locale}}/posts',
      extension: 'yml',
      slug: '{{title | localize}}',
      i18n: true,
      fields: [
        { name: 'title', label: 'Title', i18n: true, required: false, default: 'Untitled' },
        {
          name: 'tags',
          label: 'Tags',
          widget: 'list',
          i18n: 'duplicate',
          required: false,
          default: ['news'],
        },
        {
          name: 'attrs',
          label: 'Attrs',
          widget: 'keyvalue',
          i18n: 'duplicate_keys',
          required: false,
          default: { size: 'M' },
        },
      ],
    },
  ],
};

const EN_PATH = 'content/en/posts/hello.yml';
const FR_PATH = 'content/fr/posts/bonjour.yml';
/**
 * Get the content of a post file.
 * @param {string[]} lines Lines after the translation key.
 * @returns {string} File content.
 */
const getPost = (lines) => ['translationKey: hello', ...lines, ''].join('\n');

test.use({ config: CONFIG });

test.beforeEach(async ({ cms, page }) => {
  await cms.open();
  await cms.seed({
    [EN_PATH]: getPost(['title: Hello', 'tags:', '  - a', 'attrs:', '  size: L', '  color: red']),
    [FR_PATH]: getPost([
      'title: Bonjour',
      'tags:',
      '  - a',
      'attrs:',
      '  size: G',
      '  color: rouge',
    ]),
  });
  await cms.signIn();
  await page.getByRole('row', { name: /Hello/ }).click();
  await expect(
    getEditPane(page, 'English').getByRole('group', { name: /Attrs.*Field/ }),
  ).toBeVisible();
});

/**
 * Read the saved files of the post.
 * @param {import('../../fixtures/test.js').CMS} cms CMS.
 * @returns {Promise<(string | undefined)[]>} English and French files.
 */
const readPost = async (cms) => {
  const files = await cms.readRepo();

  return [files[EN_PATH], files[FR_PATH]];
};

test('restores the default values in every locale', async ({ cms, page }) => {
  await cms.chooseMenuItem(
    page.getByRole('button', { name: 'Show Editor Options' }),
    page.getByRole('menuitem', { name: 'Restore Default' }),
  );
  await page.getByRole('alertdialog').getByRole('button', { name: 'Restore Default' }).click();
  await getEditor(page).getByRole('button', { name: 'Save' }).click();

  // A translated field gets its default in each locale, a duplicated one follows English, and the
  // keys follow English as well, while French keeps its own value of a key that’s still there. The
  // key linking the translations isn’t a field, so it’s left alone
  await expect
    .poll(() => readPost(cms))
    .toEqual([
      getPost(['title: Untitled', 'tags:', '  - news', 'attrs:', '  size: M']),
      getPost(['title: Untitled', 'tags:', '  - news', 'attrs:', '  size: G']),
    ]);
});

test('clears the fields in every locale', async ({ cms, page }) => {
  await cms.chooseMenuItem(
    page.getByRole('button', { name: 'Show Editor Options' }),
    page.getByRole('menuitem', { name: 'Clear All' }),
  );
  await page.getByRole('alertdialog').getByRole('button', { name: 'Clear All' }).click();
  await getEditor(page).getByRole('button', { name: 'Save' }).click();

  // The keys are removed from French along with English
  await expect
    .poll(() => readPost(cms))
    .toEqual([
      getPost(["title: ''", 'tags: []', 'attrs: {}']),
      getPost(["title: ''", 'tags: []', 'attrs: {}']),
    ]);
});

test('reorders the keys in every locale', async ({ cms, page }) => {
  const attrs = getEditPane(page, 'English').getByRole('group', { name: /Attrs.*Field/ });

  await attrs.getByRole('button', { name: 'Reorder Item' }).first().focus();
  await page.keyboard.press('ArrowDown');
  await getEditor(page).getByRole('button', { name: 'Save' }).click();

  // French follows the order of the keys, keeping its own values
  await expect
    .poll(() => readPost(cms))
    .toEqual([
      getPost(['title: Hello', 'tags:', '  - a', 'attrs:', '  color: red', '  size: L']),
      getPost(['title: Bonjour', 'tags:', '  - a', 'attrs:', '  color: rouge', '  size: G']),
    ]);
});
