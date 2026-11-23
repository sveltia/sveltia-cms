import { stringify } from 'yaml';

import { expect, test } from '../../fixtures/test.js';
import { getEditor } from '../../fixtures/ui.js';

import { getEditPane, openEntry, save, showLocale } from './helpers.js';

/**
 * A multilingual blog whose posts have fields using the `sync` i18n strategy, which keeps a value
 * the same in every locale while it can be edited in any of them.
 * @see https://github.com/sveltia/sveltia-cms/issues/1128
 */
const CONFIG = {
  backend: { name: 'test-repo' },
  media_folder: 'static/uploads',
  i18n: { structure: 'multiple_files', locales: ['en', 'fr'], default_locale: 'en' },
  collections: [
    {
      name: 'posts',
      label: 'Posts',
      label_singular: 'Post',
      folder: 'content/posts',
      i18n: true,
      fields: [
        { name: 'title', label: 'Title', i18n: true },
        // Computed in the default locale only, from a translatable field
        { name: 'path', widget: 'compute', value: 'posts/{{fields.title}}', i18n: 'sync' },
        { name: 'tagline', label: 'Tagline', i18n: 'sync' },
        {
          name: 'links',
          label: 'Links',
          label_singular: 'Link',
          widget: 'list',
          i18n: 'sync',
          fields: [{ name: 'url', label: 'URL' }],
        },
      ],
    },
  ],
};

/**
 * Get the content of a post file.
 * @param {Record<string, any>} values Front matter values.
 * @returns {string} File content.
 */
const getPost = (values) => `---\n${stringify(values)}---\n`;
const path = 'posts/Hello';
const links = [{ url: 'https://a.example' }];

test.use({ config: CONFIG });

test.beforeEach(async ({ cms, page }) => {
  await cms.open();
  await cms.seed({
    'content/posts/hello.en.md': getPost({ title: 'Hello', path, tagline: 'Tag', links }),
    'content/posts/hello.fr.md': getPost({ title: 'Bonjour', path, tagline: 'Tag', links }),
  });
  await cms.signIn();
  await openEntry(page, 'Posts', /Hello/);
});

test('keeps a value the same in every locale, whichever locale it’s edited in', async ({
  cms,
  page,
}) => {
  const english = getEditPane(page, 'English');
  const french = await showLocale(page, 1, 'French');

  await french.getByRole('textbox', { name: 'Tagline' }).fill('Nouveau');
  await expect(english.getByRole('textbox', { name: 'Tagline' })).toHaveValue('Nouveau');

  await english.getByRole('textbox', { name: 'Tagline' }).fill('New');
  await expect(french.getByRole('textbox', { name: 'Tagline' })).toHaveValue('New');

  // A translatable field keeps a value of its own, while a synced Compute field takes the value
  // computed from the default locale’s
  await french.getByRole('textbox', { name: 'Title' }).fill('Salut');
  await english.getByRole('textbox', { name: 'Title' }).fill('Hi');

  await save(page);

  const files = await cms.readRepo();

  expect(files['content/posts/hello.en.md']).toBe(
    getPost({ title: 'Hi', path: 'posts/Hi', tagline: 'New', links }),
  );
  expect(files['content/posts/hello.fr.md']).toBe(
    getPost({ title: 'Salut', path: 'posts/Hi', tagline: 'New', links }),
  );
});

test('adds a list item to every locale from another locale', async ({ cms, page }) => {
  const english = getEditPane(page, 'English');
  const french = await showLocale(page, 1, 'French');

  await french.getByRole('button', { name: /Add\W+Link/ }).click();
  await french.getByRole('textbox', { name: 'URL' }).nth(1).fill('https://b.example');
  await expect(english.getByRole('textbox', { name: 'URL' }).nth(1)).toHaveValue(
    'https://b.example',
  );

  await save(page);

  const files = await cms.readRepo();
  const newLinks = [...links, { url: 'https://b.example' }];

  expect(files['content/posts/hello.en.md']).toBe(
    getPost({ title: 'Hello', path, tagline: 'Tag', links: newLinks }),
  );
  expect(files['content/posts/hello.fr.md']).toBe(
    getPost({ title: 'Bonjour', path, tagline: 'Tag', links: newLinks }),
  );
});

test('reverts a change in every locale from another locale', async ({ page }) => {
  const english = getEditPane(page, 'English');
  const french = await showLocale(page, 1, 'French');

  await french.getByRole('textbox', { name: 'Tagline' }).fill('Changed');
  await expect(english.getByRole('textbox', { name: 'Tagline' })).toHaveValue('Changed');

  await french
    .getByRole('group', { name: /Tagline.*Field/ })
    .getByRole('button', { name: 'Show Field Options' })
    .click();
  await page.getByRole('menuitem', { name: 'Revert Changes' }).click();

  await expect(french.getByRole('textbox', { name: 'Tagline' })).toHaveValue('Tag');
  await expect(english.getByRole('textbox', { name: 'Tagline' })).toHaveValue('Tag');
  await expect(getEditor(page).getByRole('button', { name: 'Save' })).toBeDisabled();
});
