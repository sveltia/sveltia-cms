import { expect, test } from '../../fixtures/test.js';
import { getField } from '../../fixtures/ui.js';

import { getEditPane, save, showLocale } from './helpers.js';

/**
 * A site in English and German, whose fields have their labels, hints and default values localized
 * with the `_localized` options: a string field, a list of strings with a singular label and a list
 * with a variable type.
 */
const CONFIG = {
  backend: { name: 'test-repo' },
  media_folder: 'static/uploads',
  i18n: { structure: 'multiple_files', locales: ['en', 'de'], default_locale: 'en' },
  collections: [
    {
      name: 'posts',
      label: 'Posts',
      folder: 'content/posts',
      create: true,
      i18n: true,
      fields: [
        {
          name: 'title',
          label: 'Title',
          label_localized: { de: 'Titel' },
          hint: 'Keep it short.',
          hint_localized: { de: 'Kurz halten.' },
          default: 'Untitled',
          default_localized: { de: 'Ohne Titel' },
          i18n: true,
        },
        {
          name: 'categories',
          label: 'Categories',
          label_localized: { de: 'Kategorien' },
          label_singular: 'Category',
          label_singular_localized: { de: 'Kategorie' },
          widget: 'list',
          default: ['car repair', 'tuning'],
          default_localized: { de: ['Autoreparatur', 'Tuning'] },
          i18n: true,
        },
        {
          name: 'blocks',
          label: 'Blocks',
          label_localized: { de: 'Blöcke' },
          widget: 'list',
          required: false,
          i18n: true,
          types: [
            {
              name: 'quote',
              label: 'Quote',
              label_localized: { de: 'Zitat' },
              hint: 'Words of someone else.',
              hint_localized: { de: 'Worte von jemand anderem.' },
              fields: [{ name: 'text', label: 'Text', i18n: true }],
            },
          ],
        },
      ],
    },
  ],
};

test.use({ config: CONFIG });

test('accepts the localized options and shows each pane in its own language', async ({
  cms,
  page,
}) => {
  /** @type {string[]} */
  const warnings = [];

  page.on('console', (message) => {
    if (message.type() === 'warning') {
      warnings.push(message.text());
    }
  });

  await cms.open();
  await cms.signIn();
  await page.getByRole('button', { name: 'Create New Entry' }).first().click();

  const english = getEditPane(page, 'English');

  await expect(english.getByRole('textbox', { name: 'Title' })).toHaveValue('Untitled');
  await expect(getField(english, 'Title')).toContainText('Keep it short.');
  await expect(english.getByRole('button', { name: /^Add.*Category/ })).toBeVisible();

  const german = await showLocale(page, 1, 'German');

  await expect(german.getByRole('textbox', { name: 'Titel' })).toHaveValue('Ohne Titel');
  await expect(getField(german, 'Titel')).toContainText('Kurz halten.');
  await expect(german.getByRole('button', { name: /^Add.*Kategorie/ })).toBeVisible();

  // The types of a list are labelled in the pane’s language as well
  await german.getByRole('button', { name: /^Add.*Blöcke/ }).click();
  await page.getByRole('menuitem', { name: 'Zitat' }).click();
  await expect(getField(german, 'Blöcke')).toContainText('Worte von jemand anderem.');
  await german.getByRole('textbox', { name: 'Text' }).fill('Fahrvergnügen');

  await save(page);

  const files = await cms.readRepo();

  expect(files['content/posts/untitled.en.md']).toBe(
    '---\ntitle: Untitled\ncategories:\n  - car repair\n  - tuning\nblocks: []\n---\n',
  );
  expect(files['content/posts/untitled.de.md']).toBe(
    '---\ntitle: Ohne Titel\ncategories:\n  - Autoreparatur\n  - Tuning\nblocks:\n' +
      '  - type: quote\n    text: Fahrvergnügen\n---\n',
  );
  expect(warnings).not.toContainEqual(expect.stringContaining('_localized'));
});
