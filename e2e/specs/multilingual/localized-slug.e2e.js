import { expect, test } from '../../fixtures/test.js';

import { getEditPane, save, showLocale } from './helpers.js';

/**
 * A multilingual blog whose posts are kept in a folder for each locale, with a localized slug made
 * of a translated title and a category that isn’t localized.
 */
const CONFIG = {
  backend: { name: 'test-repo' },
  media_folder: 'static/uploads',
  i18n: { structure: 'multiple_folders', locales: ['en', 'fr'], default_locale: 'en' },
  collections: [
    {
      name: 'posts',
      label: 'Posts',
      label_singular: 'Post',
      folder: 'content/posts',
      create: true,
      i18n: true,
      slug: { template: '{{title}}-{{category}}', i18n: true },
      fields: [
        { name: 'title', label: 'Title', i18n: true },
        {
          name: 'category',
          label: 'Category',
          widget: 'select',
          options: ['news', 'travel'],
          i18n: false,
        },
      ],
    },
  ],
};

test.use({ config: CONFIG });

test('fills a non-localized field in the slug of every locale from the default locale', async ({
  cms,
  page,
}) => {
  await cms.open();
  await cms.signIn();
  await page.getByRole('button', { name: 'Create New Entry' }).first().click();

  const english = getEditPane(page, 'English');

  await english.getByRole('textbox', { name: 'Title' }).fill('Hello');
  await english.getByRole('radio', { name: 'travel' }).click();

  const french = await showLocale(page, 1, 'French');

  await french.getByRole('textbox', { name: 'Title' }).fill('Bonjour');
  await save(page);

  // The French slug used to get a random value in place of the category, which only exists in the
  // default locale
  const files = await cms.readRepo();

  expect(Object.keys(files).sort()).toEqual([
    'content/posts/en/hello-travel.md',
    'content/posts/fr/bonjour-travel.md',
  ]);
});
