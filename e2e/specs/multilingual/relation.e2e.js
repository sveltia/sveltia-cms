import { markdown } from '../../fixtures/configs/multilingual.js';
import { expect, test } from '../../fixtures/test.js';

import { getEditPane, save, showLocale } from './helpers.js';

/**
 * A multilingual blog whose posts refer to tags with a multi-value Relation field duplicated to
 * every locale, storing each tag with the locale as a prefix, e.g. `fr/food` in French.
 */
const CONFIG = {
  backend: { name: 'test-repo' },
  media_folder: 'static/uploads',
  i18n: { structure: 'multiple_files', locales: ['en', 'fr'], default_locale: 'en' },
  collections: [
    {
      name: 'tags',
      label: 'Tags',
      label_singular: 'Tag',
      folder: 'content/tags',
      i18n: true,
      identifier_field: 'name',
      fields: [{ name: 'name', label: 'Name', i18n: true }],
    },
    {
      name: 'posts',
      label: 'Posts',
      label_singular: 'Post',
      folder: 'content/posts',
      create: true,
      i18n: true,
      fields: [
        { name: 'title', label: 'Title', i18n: true },
        {
          name: 'tags',
          label: 'Tags',
          widget: 'relation',
          collection: 'tags',
          multiple: true,
          value_field: '{{locale}}/{{slug}}',
          display_fields: ['name'],
          search_fields: ['name'],
          i18n: 'duplicate',
        },
      ],
    },
  ],
};

test.use({ config: CONFIG });

test('stores a tag selected in the default locale with each locale’s prefix', async ({
  cms,
  page,
}) => {
  await cms.open();
  await cms.seed({
    'content/tags/food.en.md': markdown({ name: 'Food' }, ''),
    'content/tags/food.fr.md': markdown({ name: 'Cuisine' }, ''),
    'content/tags/hiking.en.md': markdown({ name: 'Hiking' }, ''),
    'content/tags/hiking.fr.md': markdown({ name: 'Randonnée' }, ''),
  });
  await cms.signIn();
  await page.getByRole('treeitem', { name: 'Posts' }).click();
  await page.getByRole('button', { name: 'Create New Entry' }).first().click();

  const english = getEditPane(page, 'English');

  await english.getByRole('textbox', { name: 'Title' }).fill('Mountain Lunch');
  await english.getByRole('checkbox', { name: 'Food' }).check();

  const french = await showLocale(page, 1, 'French');

  // The French content used to get the English value, `en/food`, which refers to no French tag
  await expect(french.getByRole('checkbox', { name: 'Cuisine' })).toBeChecked();
  await french.getByRole('textbox', { name: 'Title' }).fill('Déjeuner en montagne');
  await save(page);

  const files = await cms.readRepo();

  expect(files['content/posts/mountain-lunch.en.md']).toBe(
    '---\ntitle: Mountain Lunch\ntags:\n  - en/food\n---\n',
  );
  expect(files['content/posts/mountain-lunch.fr.md']).toBe(
    '---\ntitle: Déjeuner en montagne\ntags:\n  - fr/food\n---\n',
  );
});
