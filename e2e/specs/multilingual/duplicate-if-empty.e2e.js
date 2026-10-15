import { stringify } from 'yaml';

import { expect, test } from '../../fixtures/test.js';
import { getEditor } from '../../fixtures/ui.js';

import { getEditPane, openEntry, save, showLocale } from './helpers.js';

/**
 * A multilingual blog whose posts have fields using the `duplicate_if_empty` i18n strategy, which
 * fills in the other locales’ empty values with the default locale’s value while leaving them
 * editable.
 * @see https://github.com/sveltia/sveltia-cms/issues/120
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
        { name: 'title', label: 'Title', i18n: 'duplicate_if_empty' },
        { name: 'summary', label: 'Summary', widget: 'text', i18n: 'duplicate_if_empty' },
        { name: 'rank', label: 'Rank', widget: 'number', i18n: 'duplicate_if_empty' },
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

test.use({ config: CONFIG });

test.beforeEach(async ({ cms, page }) => {
  await cms.open();
  // The French post has a title of its own, but no summary or rank
  await cms.seed({
    'content/posts/hello.en.md': getPost({ title: 'Hello', summary: 'Summary', rank: 1 }),
    'content/posts/hello.fr.md': getPost({ title: 'Bonjour', summary: '' }),
  });
  await cms.signIn();
  await openEntry(page, 'Posts', /Hello/);
});

test('fills in the empty values of another locale from the default locale', async ({ page }) => {
  const french = await showLocale(page, 1, 'French');

  await expect(french.getByRole('textbox', { name: 'Title' })).toHaveValue('Bonjour');
  await expect(french.getByRole('textbox', { name: 'Summary' })).toHaveValue('Summary');
  await expect(french.getByRole('spinbutton', { name: 'Rank' })).toHaveValue('1');
  // The values can be edited in the locale
  await expect(french.getByRole('textbox', { name: 'Summary' })).toBeEditable();
  // Filling in the values is no change of the user’s
  await expect(getEditor(page).getByRole('button', { name: 'Save' })).toBeDisabled();
});

test('keeps another locale in sync until it gets a value of its own', async ({ cms, page }) => {
  const english = getEditPane(page, 'English');
  const french = await showLocale(page, 1, 'French');
  const englishSummary = english.getByRole('textbox', { name: 'Summary' });

  // The French summary follows the English one as it’s typed
  await englishSummary.fill('');
  await englishSummary.pressSequentially('New');
  await expect(french.getByRole('textbox', { name: 'Summary' })).toHaveValue('New');

  // A value of the locale’s own is left alone
  await english.getByRole('textbox', { name: 'Title' }).fill('Hello World');
  await expect(french.getByRole('textbox', { name: 'Title' })).toHaveValue('Bonjour');

  await french.getByRole('spinbutton', { name: 'Rank' }).fill('5');
  await english.getByRole('spinbutton', { name: 'Rank' }).fill('2');
  await expect(french.getByRole('spinbutton', { name: 'Rank' })).toHaveValue('5');

  await save(page);

  const files = await cms.readRepo();

  expect(files['content/posts/hello.en.md']).toBe(
    getPost({ title: 'Hello World', summary: 'New', rank: 2 }),
  );
  expect(files['content/posts/hello.fr.md']).toBe(
    getPost({ title: 'Bonjour', summary: 'New', rank: 5 }),
  );
});

test('restores the value of another locale when a change is reverted', async ({ page }) => {
  const english = getEditPane(page, 'English');
  const french = await showLocale(page, 1, 'French');

  await english.getByRole('textbox', { name: 'Summary' }).fill('Changed');
  await expect(french.getByRole('textbox', { name: 'Summary' })).toHaveValue('Changed');

  await english
    .getByRole('group', { name: /Summary.*Field/ })
    .getByRole('button', { name: 'Show Field Options' })
    .click();
  await page.getByRole('menuitem', { name: 'Revert Changes' }).click();

  await expect(english.getByRole('textbox', { name: 'Summary' })).toHaveValue('Summary');
  await expect(french.getByRole('textbox', { name: 'Summary' })).toHaveValue('Summary');
  await expect(getEditor(page).getByRole('button', { name: 'Save' })).toBeDisabled();
});
