import { expect, test } from '../../fixtures/test.js';
import { getEntryRows } from '../../fixtures/ui.js';

import { getEditPane, save, showLocale } from './helpers.js';

/**
 * @import { Locator, Page } from '@playwright/test';
 */

/**
 * Build the config of a site in English and French, each locale of an entry in a file of its own,
 * with the given i18n options for its only collection.
 * @param {Record<string, any>} i18n Collection i18n options.
 * @returns {object} Config.
 */
const getConfig = (i18n) => ({
  backend: { name: 'test-repo' },
  media_folder: 'static/uploads',
  i18n: { structure: 'multiple_files', locales: ['en', 'fr'], default_locale: 'en' },
  collections: [
    {
      name: 'pages',
      label: 'Pages',
      folder: 'content/pages',
      create: true,
      i18n,
      fields: [
        { name: 'title', label: 'Title', i18n: true },
        { name: 'body', label: 'Body', widget: 'text', i18n: true },
      ],
    },
  ],
});

/**
 * Build a Markdown file with a title and a body.
 * @param {string} title Title.
 * @param {string} body Body.
 * @returns {string} File content.
 */
const markdown = (title, body) => `---\ntitle: ${title}\n---\n\n${body}\n`;

/**
 * Create an entry in both locales.
 * @param {Page} page Page.
 * @returns {Promise<Locator>} French pane.
 */
const fillNewEntry = async (page) => {
  await page.getByRole('button', { name: 'Create New Entry' }).first().click();

  const english = getEditPane(page, 'English');

  await english.getByRole('textbox', { name: 'Title' }).fill('About');
  await english.getByRole('textbox', { name: 'Body' }).fill('Who we are.');

  const french = await showLocale(page, 1, 'French');

  // Every locale is enabled for a new entry
  await french.getByRole('textbox', { name: 'Title' }).fill('À propos');
  await french.getByRole('textbox', { name: 'Body' }).fill('Qui nous sommes.');

  return french;
};

test.describe('initial_locales: all', () => {
  test.use({ config: getConfig({ initial_locales: 'all' }) });

  test.beforeEach(async ({ cms }) => {
    await cms.open();
    await cms.signIn();
  });

  test('saves every locale of a new entry', async ({ cms, page }) => {
    await fillNewEntry(page);
    await save(page);

    const files = await cms.readRepo();

    expect(files['content/pages/about.en.md']).toBe(markdown('About', 'Who we are.'));
    expect(files['content/pages/about.fr.md']).toBe(markdown('À propos', 'Qui nous sommes.'));
  });

  test('lets a locale of a new entry be disabled before saving', async ({ cms, page }) => {
    const french = await fillNewEntry(page);

    await cms.chooseMenuItem(
      french.getByRole('button', { name: /Show.*French.*Content Options/ }),
      page.getByRole('menuitem', { name: /Disable.*French/ }),
    );
    await save(page);

    // Only the English file is written
    expect(await cms.readRepo()).toEqual({
      'content/pages/about.en.md': markdown('About', 'Who we are.'),
    });
  });
});

test.describe('omit_default_locale_from_file_path', () => {
  test.use({ config: getConfig({ omit_default_locale_from_file_path: true }) });

  test('leaves the default locale out of a new entry’s file name', async ({ cms, page }) => {
    await cms.open();
    await cms.seed({
      'content/pages/contact.md': markdown('Contact', 'Write to us.'),
      'content/pages/contact.fr.md': markdown('Contact', 'Écrivez-nous.'),
    });
    await cms.signIn();

    // The existing entry is read from the same files
    await expect(getEntryRows(page)).toHaveCount(1);
    await fillNewEntry(page);
    await save(page);

    const files = await cms.readRepo();

    expect(files['content/pages/about.md']).toBe(markdown('About', 'Who we are.'));
    expect(files['content/pages/about.fr.md']).toBe(markdown('À propos', 'Qui nous sommes.'));
    expect(files['content/pages/about.en.md']).toBeUndefined();
  });
});
