import { expect, test } from '../../fixtures/test.js';
import { getEditor } from '../../fixtures/ui.js';
import { getEditPane, save, showLocale } from '../multilingual/helpers.js';

/**
 * A DateTime field in a custom format with the month name, written in German with
 * `localize_format: de` on a site without i18n.
 */
const MONOLINGUAL_CONFIG = {
  backend: { name: 'test-repo' },
  media_folder: 'static/uploads',
  collections: [
    {
      name: 'events',
      label: 'Events',
      label_singular: 'Event',
      folder: 'content/events',
      extension: 'yml',
      create: true,
      slug: '{{title}}',
      fields: [
        { name: 'title', label: 'Title' },
        {
          name: 'date',
          label: 'Date',
          widget: 'datetime',
          type: 'date',
          format: 'D. MMMM YYYY',
          localize_format: 'de',
        },
      ],
    },
  ],
};

/**
 * The same field duplicated to every locale of a multilingual site with `localize_format: true`,
 * so each locale gets the date in its own language.
 */
const MULTILINGUAL_CONFIG = {
  backend: { name: 'test-repo' },
  media_folder: 'static/uploads',
  i18n: { structure: 'multiple_files', locales: ['en', 'de'], default_locale: 'en' },
  collections: [
    {
      name: 'events',
      label: 'Events',
      label_singular: 'Event',
      folder: 'content/events',
      extension: 'yml',
      create: true,
      slug: '{{title}}',
      i18n: true,
      fields: [
        { name: 'title', label: 'Title', i18n: true },
        {
          name: 'date',
          label: 'Date',
          widget: 'datetime',
          type: 'date',
          format: 'D MMMM YYYY',
          localize_format: true,
          i18n: 'duplicate',
        },
      ],
    },
  ],
};

test.describe('with a locale code', () => {
  test.use({ config: MONOLINGUAL_CONFIG });

  test('writes the month name in the locale', async ({ cms, page }) => {
    await cms.open();
    await cms.signIn();
    await page.getByRole('button', { name: 'Create New Entry' }).first().click();

    const editor = getEditor(page);

    await editor.getByRole('textbox', { name: 'Title' }).fill('Launch');
    await editor.getByRole('textbox', { name: 'Date' }).fill('2026-03-01');
    await editor.getByRole('button', { name: 'Save' }).click();

    await expect
      .poll(async () => (await cms.readRepo())['content/events/launch.yml'])
      .toBe('title: Launch\ndate: 1. März 2026\n');
  });

  test('reads a value written in the locale, leaving the entry unmodified', async ({
    cms,
    page,
  }) => {
    await cms.open();
    await cms.seed({ 'content/events/launch.yml': 'title: Launch\ndate: 1. März 2026\n' });
    await cms.signIn();
    await page.getByRole('row', { name: /Launch/ }).click();

    const editor = getEditor(page);

    await expect(editor.getByRole('textbox', { name: 'Date' })).toHaveValue('2026-03-01');
    await expect(editor.getByRole('button', { name: 'Save' })).toBeDisabled();
  });
});

test.describe('with `true`', () => {
  test.use({ config: MULTILINGUAL_CONFIG });

  test('writes a duplicated value in each locale', async ({ cms, page }) => {
    await cms.open();
    await cms.signIn();
    await page.getByRole('button', { name: 'Create New Entry' }).first().click();

    const english = getEditPane(page, 'English');

    await english.getByRole('textbox', { name: 'Title' }).fill('Launch');
    await english.getByRole('textbox', { name: 'Date' }).fill('2026-03-01');

    const german = await showLocale(page, 1, 'German');

    await german.getByRole('textbox', { name: 'Title' }).fill('Start');
    await expect(german.getByRole('textbox', { name: 'Date' })).toHaveValue('2026-03-01');
    await save(page);

    const files = await cms.readRepo();

    expect(files['content/events/launch.en.yml']).toBe('title: Launch\ndate: 1 March 2026\n');
    expect(files['content/events/launch.de.yml']).toBe('title: Start\ndate: 1 März 2026\n');
  });
});

test.describe('with `true` in a summary', () => {
  test.use({
    config: {
      ...MULTILINGUAL_CONFIG,
      collections: [
        { ...MULTILINGUAL_CONFIG.collections[0], summary: "{{title}} ({{date | date('MMMM')}})" },
      ],
    },
  });

  test('reads the value of an entry only written in another locale in that locale', async ({
    cms,
    page,
  }) => {
    await cms.open();
    await cms.seed({ 'content/events/launch.de.yml': 'title: Start\ndate: 1 März 2026\n' });
    await cms.signIn();

    await expect(page.getByRole('row', { name: /Start/ })).toContainText('Start (März)');
  });
});
