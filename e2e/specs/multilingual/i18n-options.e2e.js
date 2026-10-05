import { expect, test } from '../../fixtures/test.js';

import { getEditPane, save, showLocale } from './helpers.js';

/**
 * @import { Page } from '@playwright/test';
 */

/**
 * Travel guides in English and French, each locale in a folder of its own with a slug localized
 * from the title. The translations of a guide are linked by a `ref` key holding the canonical
 * slug, and the English page of a guide is published without the locale in its path.
 */
const CONFIG = {
  backend: { name: 'test-repo' },
  media_folder: 'static/uploads',
  site_url: 'https://www.example.com',
  i18n: { locales: ['en', 'fr'], default_locale: 'en' },
  collections: [
    {
      name: 'guides',
      label: 'Guides',
      folder: 'content/guides',
      create: true,
      slug: '{{title | localize}}',
      preview_path: '{{locale}}/guides/{{slug}}',
      i18n: {
        structure: 'multiple_folders',
        canonical_slug: { key: 'ref', value: 'guide-{{slug}}' },
        omit_default_locale_from_preview_path: true,
      },
      fields: [
        { name: 'title', label: 'Title', i18n: true },
        { name: 'body', label: 'Body', widget: 'text', i18n: true },
      ],
    },
  ],
};

/**
 * Build a guide file.
 * @param {string} title Title.
 * @param {string} body Body.
 * @returns {string} File content.
 */
const guide = (title, body) => `---\nref: guide-lisbon\ntitle: ${title}\n---\n\n${body}\n`;

test.use({ config: CONFIG });

test.beforeEach(async ({ cms, page }) => {
  // Never reach the live site
  await page.context().route('https://www.example.com/**', (route) => route.fulfill({ body: '' }));
  await cms.open();
  await cms.seed({
    'content/guides/en/lisbon.md': guide('Lisbon', 'Ride the 28.'),
    'content/guides/fr/lisbonne.md': guide('Lisbonne', 'Prenez le 28.'),
  });
  await cms.signIn();
});

/**
 * Click a control and get the URL of the tab it opens.
 * @param {Page} page Page.
 * @param {() => Promise<void>} click Function clicking the control.
 * @returns {Promise<string>} URL.
 */
const getOpenedURL = async (page, click) => {
  const [popup] = await Promise.all([page.waitForEvent('popup'), click()]);
  const url = popup.url();

  await popup.close();

  return url;
};

test('writes the canonical slug to every translation of a new entry', async ({ cms, page }) => {
  await page.getByRole('button', { name: 'Create New Entry' }).first().click();

  const english = getEditPane(page, 'English');

  await english.getByRole('textbox', { name: 'Title' }).fill('Night Markets');
  await english.getByRole('textbox', { name: 'Body' }).fill('After dark.');

  const french = await showLocale(page, 1, 'French');

  await french.getByRole('textbox', { name: 'Title' }).fill('Marchés de nuit');
  await french.getByRole('textbox', { name: 'Body' }).fill('Après la nuit.');
  await save(page);

  // Each translation has a slug of its own, and the canonical one under the configured key
  const files = await cms.readRepo();

  expect(files['content/guides/en/night-markets.md']).toBe(
    '---\nref: guide-night-markets\ntitle: Night Markets\n---\n\nAfter dark.\n',
  );
  expect(files['content/guides/fr/marchés-de-nuit.md']).toBe(
    '---\nref: guide-night-markets\ntitle: Marchés de nuit\n---\n\nAprès la nuit.\n',
  );
});

test('opens the translations linked by their canonical slug as one entry', async ({
  cms,
  page,
}) => {
  await expect(page.getByRole('group', { name: 'Entry List' }).getByRole('row')).toHaveCount(1);
  await page.getByRole('row', { name: /Lisbon/ }).click();

  const french = await showLocale(page, 1, 'French');

  await expect(french.getByRole('textbox', { name: 'Title' })).toHaveValue('Lisbonne');
  await french.getByRole('textbox', { name: 'Body' }).fill('Montez dans le 28.');
  await save(page);

  // The French file keeps its own slug and the key linking it to the others
  expect((await cms.readRepo())['content/guides/fr/lisbonne.md']).toBe(
    guide('Lisbonne', 'Montez dans le 28.'),
  );
});

test('opens the live page of each locale, without the default locale in the path', async ({
  page,
}) => {
  await page.getByRole('row', { name: /Lisbon/ }).click();
  await showLocale(page, 1, 'French');

  expect(
    await getOpenedURL(page, () => page.getByRole('button', { name: 'View on Live Site' }).click()),
  ).toBe('https://www.example.com/guides/lisbon');

  // Each locale’s page is in the options of its pane
  await page.getByRole('button', { name: /Show.*French.*Content Options/ }).click();
  expect(
    await getOpenedURL(page, () =>
      page.getByRole('menuitem', { name: 'View on Live Site' }).click(),
    ),
  ).toBe('https://www.example.com/fr/guides/lisbonne');
});
