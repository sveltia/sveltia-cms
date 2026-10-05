import { expect, test } from '../../fixtures/test.js';

import { getEditPane, openEntry, save, showLocale } from './helpers.js';

/**
 * The i18n structures that keep each locale in a folder of its own, without a `{{locale}}`
 * placeholder in the collection folder, which `structures.e2e.js` covers. Each collection uses one
 * of them, and gives the path of an entry, where `{locale}` and `{slug}` are filled in, and the
 * path in the default locale if it’s another one.
 */
const STRUCTURES = [
  {
    title: 'multiple_folders',
    name: 'notes',
    label: 'Notes',
    i18n: { structure: 'multiple_folders' },
    path: 'content/notes/{locale}/{slug}.md',
  },
  {
    title: 'multiple_root_folders',
    name: 'stories',
    label: 'Stories',
    i18n: { structure: 'multiple_root_folders' },
    path: '{locale}/content/stories/{slug}.md',
  },
  {
    title: 'multiple_folders_i18n_root, the deprecated name of multiple_root_folders',
    name: 'legacy',
    label: 'Legacy',
    i18n: { structure: 'multiple_folders_i18n_root' },
    path: '{locale}/content/legacy/{slug}.md',
  },
  {
    title: 'multiple_root_folders, with the default locale at the collection folder',
    name: 'docs',
    label: 'Docs',
    i18n: { structure: 'multiple_root_folders', omit_default_locale_from_file_path: true },
    path: '{locale}/content/docs/{slug}.md',
    defaultLocalePath: 'content/docs/{slug}.md',
  },
];

test.use({
  config: {
    backend: { name: 'test-repo' },
    media_folder: 'static/uploads',
    i18n: { locales: ['en', 'fr'], default_locale: 'en' },
    collections: STRUCTURES.map(({ name, label, i18n }) => ({
      name,
      label,
      folder: `content/${name}`,
      create: true,
      i18n,
      fields: [
        { name: 'title', label: 'Title', i18n: true },
        { name: 'body', label: 'Body', widget: 'text', i18n: true },
      ],
    })),
  },
});

/**
 * Build a Markdown file with a title and a body.
 * @param {string} title Title.
 * @param {string} body Body.
 * @returns {string} File content.
 */
const markdown = (title, body) => `---\ntitle: ${title}\n---\n\n${body}\n`;

STRUCTURES.forEach(({ title, label, path, defaultLocalePath = path }) => {
  /**
   * Get the path of an entry in a locale.
   * @param {string} locale Locale.
   * @param {string} slug Entry slug.
   * @returns {string} File path.
   */
  const getPath = (locale, slug) =>
    (locale === 'en' ? defaultLocalePath : path)
      .replace('{locale}', locale)
      .replace('{slug}', slug);

  test.describe(title, () => {
    const englishPath = getPath('en', 'harbour');
    const frenchPath = getPath('fr', 'harbour');

    test.beforeEach(async ({ cms }) => {
      await cms.open();
      await cms.seed({
        [englishPath]: markdown('Harbour', 'Boats at dawn.'),
        [frenchPath]: markdown('Port', 'Des bateaux à l’aube.'),
      });
      await cms.signIn();
    });

    test('lists the locales of an entry as one, and updates one locale’s file', async ({
      cms,
      page,
    }) => {
      await page.getByRole('treeitem', { name: label }).click();
      await expect(page.getByRole('group', { name: 'Entry List' }).getByRole('row')).toHaveCount(1);
      await openEntry(page, label, /Harbour/);

      const english = getEditPane(page, 'English');

      await expect(english.getByRole('textbox', { name: 'Body' })).toHaveValue('Boats at dawn.');

      const french = await showLocale(page, 1, 'French');

      await expect(french.getByRole('textbox', { name: 'Title' })).toHaveValue('Port');
      await french.getByRole('textbox', { name: 'Body' }).fill('Des bateaux au lever du jour.');
      await save(page);

      const files = await cms.readRepo();

      expect(files[frenchPath]).toBe(markdown('Port', 'Des bateaux au lever du jour.'));
      expect(files[englishPath]).toBe(markdown('Harbour', 'Boats at dawn.'));
      expect(Object.keys(files).sort()).toEqual([englishPath, frenchPath].sort());
    });

    test('creates an entry in each locale’s folder', async ({ cms, page }) => {
      await page.getByRole('treeitem', { name: label }).click();
      await page.getByRole('button', { name: 'Create New Entry' }).first().click();

      const english = getEditPane(page, 'English');

      await english.getByRole('textbox', { name: 'Title' }).fill('Lighthouse');
      await english.getByRole('textbox', { name: 'Body' }).fill('A beam at night.');

      const french = await showLocale(page, 1, 'French');

      await french.getByRole('textbox', { name: 'Title' }).fill('Phare');
      await french.getByRole('textbox', { name: 'Body' }).fill('Un faisceau la nuit.');
      await save(page);

      const files = await cms.readRepo();

      expect(files[getPath('en', 'lighthouse')]).toBe(markdown('Lighthouse', 'A beam at night.'));
      expect(files[getPath('fr', 'lighthouse')]).toBe(markdown('Phare', 'Un faisceau la nuit.'));
      // Nothing is written anywhere else
      expect(Object.keys(files).sort()).toEqual(
        [englishPath, frenchPath, getPath('en', 'lighthouse'), getPath('fr', 'lighthouse')].sort(),
      );
    });
  });
});
