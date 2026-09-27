import {
  markdown,
  MULTILINGUAL_CONFIG,
  MULTILINGUAL_FILES,
} from '../../fixtures/configs/multilingual.js';
import { expect, test } from '../../fixtures/test.js';

import { getEditor, getEditPane, openEntry, save, showLocale, watchSaveButton } from './helpers.js';

test.use({ config: MULTILINGUAL_CONFIG });

test.beforeEach(async ({ cms }) => {
  await cms.open();
  await cms.seed(MULTILINGUAL_FILES);
  await cms.signIn();
});

test.describe('multiple files', () => {
  test('creates an article in every locale, each field where its i18n option puts it', async ({
    cms,
    page,
  }) => {
    await page.getByRole('button', { name: 'Create New Entry' }).first().click();

    // The default locale is shown first, although it isn’t the first one listed
    const english = getEditPane(page, 'English');

    await english.getByRole('textbox', { name: 'Title' }).fill('Night Markets');
    await english.getByRole('textbox', { name: 'Date' }).fill('2026-05-01');
    await english.getByRole('textbox', { name: 'Author' }).fill('Lina Saleh');
    await english.getByRole('textbox', { name: 'Item Value' }).fill('food');
    await english.getByRole('textbox', { name: 'Summary' }).fill('Eat after dark.');
    await english.getByRole('textbox', { name: 'Body' }).click();
    await page.keyboard.type('Follow the lanterns.');

    const french = await showLocale(page, 1, 'French');

    // A duplicated field shows the default locale’s value, read-only, and a field that isn’t
    // localized isn’t shown at all
    await expect(french.getByRole('textbox', { name: 'Date' })).toHaveValue('2026-05-01');
    await expect(french.getByRole('textbox', { name: 'Date' })).toHaveAttribute('readonly');
    await expect(french.getByRole('textbox', { name: 'Item Value' })).toHaveValue('food');
    await expect(french.getByRole('textbox', { name: 'Author' })).toHaveCount(0);
    await french.getByRole('textbox', { name: 'Title' }).fill('Marchés de nuit');
    await french.getByRole('textbox', { name: 'Body' }).click();
    await page.keyboard.type('Suivez les lanternes.');

    // Switch the same pane to Arabic right away, while the French body is being converted
    const arabic = await showLocale(page, 1, 'Arabic');

    await expect(arabic.getByRole('textbox', { name: 'Body' })).toHaveText('');
    await arabic.getByRole('textbox', { name: 'Title' }).fill('أسواق الليل');
    await arabic.getByRole('textbox', { name: 'Summary' }).fill('كُل بعد حلول الظلام.');
    await arabic.getByRole('textbox', { name: 'Body' }).click();
    await page.keyboard.type('اتبع الفوانيس.');
    await save(page);

    const files = await cms.readRepo();

    expect(files['content/articles/night-markets.en.md']).toBe(
      markdown(
        {
          title: 'Night Markets',
          date: '2026-05-01',
          author: 'Lina Saleh',
          tags: ['food'],
          summary: 'Eat after dark.',
        },
        'Follow the lanterns.',
      ),
    );
    // The French summary is left empty, and the author is only written to the default locale
    expect(files['content/articles/night-markets.fr.md']).toBe(
      markdown(
        { title: 'Marchés de nuit', date: '2026-05-01', tags: ['food'], summary: '' },
        'Suivez les lanternes.',
      ),
    );
    expect(files['content/articles/night-markets.ar.md']).toBe(
      markdown(
        {
          title: 'أسواق الليل',
          date: '2026-05-01',
          tags: ['food'],
          summary: 'كُل بعد حلول الظلام.',
        },
        'اتبع الفوانيس.',
      ),
    );
  });

  test('opens an article without counting it as changed', async ({ page }) => {
    const saveButtonEnabled = await watchSaveButton(page);

    await openEntry(page, 'Articles', /Lyon/);
    await expect(getEditPane(page, 'English').getByRole('textbox', { name: 'Title' })).toHaveValue(
      'A Weekend in Lyon',
    );
    // A List field used to write its items back as soon as it was shown, and the rich text editor
    // loading the body enabled the Save button for a moment, both as if the entry had changed.
    // There’s nothing to wait for when that doesn’t happen, so wait a moment
    await page.waitForTimeout(1000);
    expect(await saveButtonEnabled()).toBe(false);
  });

  test('copies a duplicated field to every locale, and keeps the others where they are', async ({
    cms,
    page,
  }) => {
    await openEntry(page, 'Articles', /Lyon/);

    const english = getEditPane(page, 'English');

    await english.getByRole('textbox', { name: 'Date' }).fill('2026-03-21');
    await english.getByRole('button', { name: /Add.*Tags/ }).click();
    await english.getByRole('textbox', { name: 'Item Value' }).nth(2).fill('markets');
    await english.getByRole('textbox', { name: 'Author' }).fill('Camille Dupont');
    await save(page);

    const files = await cms.readRepo();

    expect(files['content/articles/lyon.en.md']).toBe(
      MULTILINGUAL_FILES['content/articles/lyon.en.md']
        .replace('2026-03-14', '2026-03-21')
        .replace('Camille Martin', 'Camille Dupont')
        .replace('  - france\n', '  - france\n  - markets\n'),
    );
    ['fr', 'ar'].forEach((locale) => {
      expect(files[`content/articles/lyon.${locale}.md`]).toBe(
        MULTILINGUAL_FILES[`content/articles/lyon.${locale}.md`]
          .replace('2026-03-14', '2026-03-21')
          .replace('  - france\n', '  - france\n  - markets\n'),
      );
    });
  });
});

test.describe('multiple folders', () => {
  test('creates a guide in the default locale only, in its locale folder', async ({
    cms,
    page,
  }) => {
    await page.getByRole('treeitem', { name: 'Guides' }).click();
    await page.getByRole('button', { name: 'Create New Entry' }).first().click();

    const english = getEditPane(page, 'English');

    await english.getByRole('textbox', { name: 'Title' }).fill('Lisbon Trams');
    await english.getByRole('radio', { name: 'Europe' }).click();
    await english.getByRole('textbox', { name: 'Body' }).click();
    await page.keyboard.type('Ride the 28.');

    // `initial_locales: default` leaves the other locales disabled
    const switcher = getEditor(page).getByRole('radiogroup', { name: 'Switch Locale' }).nth(1);

    await expect(switcher.getByRole('radio', { name: /^French.*disabled/ })).toBeVisible();
    await expect(switcher.getByRole('radio', { name: /^Arabic.*disabled/ })).toBeVisible();
    await save(page);

    // The localized slug goes with a key linking the translations of the entry
    const files = await cms.readRepo();

    expect(files['content/en/guides/lisbon-trams.md']).toBe(
      markdown(
        { translationKey: 'lisbon-trams', title: 'Lisbon Trams', region: 'Europe' },
        'Ride the 28.',
      ),
    );
    expect(Object.keys(files).filter((path) => path.includes('lisbon'))).toEqual([
      'content/en/guides/lisbon-trams.md',
    ]);
  });
});

test.describe('single file', () => {
  test('creates a destination with every locale in one file', async ({ cms, page }) => {
    await page.getByRole('treeitem', { name: 'Destinations' }).click();
    await page.getByRole('button', { name: 'Create New Entry' }).first().click();

    const english = getEditPane(page, 'English');

    await english.getByRole('textbox', { name: 'Name' }).fill('Amman');
    await english.getByRole('textbox', { name: 'Description' }).fill('A city of hills.');
    await english.getByRole('textbox', { name: 'Currency' }).fill('JOD');
    await english.getByRole('spinbutton', { name: 'Population' }).fill('4000000');

    const french = await showLocale(page, 1, 'French');

    await french.getByRole('textbox', { name: 'Name' }).fill('Amman');
    await french.getByRole('textbox', { name: 'Description' }).fill('Une ville de collines.');

    const arabic = await showLocale(page, 1, 'Arabic');

    await arabic.getByRole('textbox', { name: 'Name' }).fill('عمّان');
    await arabic.getByRole('textbox', { name: 'Description' }).fill('مدينة التلال.');
    await save(page);

    // The locales come in the configured order, and the field that isn’t localized only goes to the
    // default locale
    expect((await cms.readRepo())['data/destinations/amman.yml']).toBe(
      [
        'fr:',
        '  name: Amman',
        '  description: Une ville de collines.',
        '  currency: JOD',
        'en:',
        '  name: Amman',
        '  description: A city of hills.',
        '  currency: JOD',
        '  population: 4000000',
        'ar:',
        '  name: عمّان',
        '  description: مدينة التلال.',
        '  currency: JOD',
        '',
      ].join('\n'),
    );
  });

  test('updates a destination in two locales', async ({ cms, page }) => {
    await openEntry(page, 'Destinations', /Paris/);

    const english = getEditPane(page, 'English');

    await english.getByRole('textbox', { name: 'Currency' }).fill('EUR €');
    await english.getByRole('spinbutton', { name: 'Population' }).fill('2200000');

    const french = await showLocale(page, 1, 'French');

    await expect(french.getByRole('spinbutton', { name: 'Population' })).toHaveCount(0);
    await french.getByRole('textbox', { name: 'Description' }).fill('La ville des lumières.');
    await save(page);

    expect((await cms.readRepo())['data/destinations/paris.yml']).toBe(
      MULTILINGUAL_FILES['data/destinations/paris.yml']
        .replaceAll('currency: EUR', 'currency: EUR €')
        .replace('2100000', '2200000')
        .replace('La ville lumière.', 'La ville des lumières.'),
    );
  });
});

test.describe('file collection and singleton', () => {
  test('updates one locale’s file of a page', async ({ cms, page }) => {
    await openEntry(page, 'Pages', 'About Page');

    const arabic = await showLocale(page, 1, 'Arabic');

    await arabic.getByRole('textbox', { name: 'Title' }).fill('عن المجلة');
    await save(page);

    const files = await cms.readRepo();

    expect(files['content/pages/about.ar.md']).toBe(
      markdown({ title: 'عن المجلة' }, 'نسافر ببطء.'),
    );
    expect(files['content/pages/about.en.md']).toBe(
      MULTILINGUAL_FILES['content/pages/about.en.md'],
    );
    expect(files['content/pages/about.fr.md']).toBe(
      MULTILINGUAL_FILES['content/pages/about.fr.md'],
    );
  });

  test('updates a file holding every locale', async ({ cms, page }) => {
    await openEntry(page, 'Pages', 'Contact Page');
    await getEditPane(page, 'English')
      .getByRole('textbox', { name: 'Email' })
      .fill('team@example.com');

    const french = await showLocale(page, 1, 'French');

    await french.getByRole('textbox', { name: 'Address' }).fill('2 rue de la Paix, Paris');
    await save(page);

    expect((await cms.readRepo())['data/contact.yml']).toBe(
      MULTILINGUAL_FILES['data/contact.yml'].replace('hello@', 'team@').replace('1 rue', '2 rue'),
    );
  });

  test('updates the singleton', async ({ cms, page }) => {
    await page.getByRole('treeitem', { name: 'Site Settings' }).click();
    await getEditPane(page, 'English')
      .getByRole('spinbutton', { name: 'Posts per Page' })
      .fill('12');

    const arabic = await showLocale(page, 1, 'Arabic');

    await arabic.getByRole('textbox', { name: 'Tagline' }).fill('سافر على مهل');
    await save(page);

    expect(JSON.parse((await cms.readRepo())['data/settings.json'])).toEqual({
      fr: { site_name: 'Vagabond', tagline: 'Voyager lentement' },
      en: { site_name: 'Wanderer', tagline: 'Travel slowly', posts_per_page: 12 },
      ar: { site_name: 'الرحّالة', tagline: 'سافر على مهل' },
    });
  });
});
