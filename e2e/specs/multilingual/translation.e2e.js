import { fileURLToPath } from 'node:url';

import {
  markdown,
  MULTILINGUAL_CONFIG,
  MULTILINGUAL_FILES,
} from '../../fixtures/configs/multilingual.js';
import { expect, test } from '../../fixtures/test.js';

import { getEditPane, save, showLocale } from './helpers.js';

/**
 * @import { Page } from '@playwright/test';
 */

test.use({ config: MULTILINGUAL_CONFIG });

/**
 * A made-up Google Cloud Translation API key, in the format the CMS accepts.
 */
const API_KEY = `AIza${'0'.repeat(35)}`;

/**
 * Answer the Google Cloud Translation API requests with a fake translation, which tags each text
 * with the target language, e.g. `AR: `, and keep the requests to check them.
 * @param {Page} page Page.
 * @returns {Promise<{ q: string[], source: string, target: string, apiKey: string | null }[]>}
 * Requests received so far.
 */
const mockTranslator = async (page) => {
  /** @type {{ q: string[], source: string, target: string, apiKey: string | null }[]} */
  const requests = [];

  // The CMS loads Turndown from a CDN to convert the translated HTML back to Markdown; serve the
  // installed copy instead, so the tests don’t depend on the network
  await page.route('https://unpkg.com/turndown@*/lib/turndown.browser.es.js', (route) =>
    route.fulfill({
      contentType: 'text/javascript',
      path: fileURLToPath(import.meta.resolve('turndown/lib/turndown.browser.es.js')),
    }),
  );
  await page.route('https://translation.googleapis.com/**', (route) => {
    const request = route.request();
    const { q, source, target } = request.postDataJSON();

    requests.push({ q, source, target, apiKey: request.headers()['x-goog-api-key'] ?? null });

    return route.fulfill({
      json: {
        data: {
          translations: q.map((/** @type {string} */ text) => ({
            // Tag the text within the HTML the CMS sends for a Markdown field
            translatedText: text.replace(/^(<p[^>]*>)?/, `$1${target.toUpperCase()}: `),
          })),
        },
      },
    });
  });

  return requests;
};

test.beforeEach(async ({ cms, page }) => {
  await cms.open();
  await cms.seed(MULTILINGUAL_FILES);
  await cms.signIn();
  await page.getByRole('button', { name: 'Create New Entry' }).first().click();

  const english = getEditPane(page, 'English');

  await english.getByRole('textbox', { name: 'Title' }).fill('Night Markets');
  await english.getByRole('textbox', { name: 'Date' }).fill('2026-05-01');
  await english.getByRole('textbox', { name: 'Author' }).fill('Lina Saleh');
  await english.getByRole('textbox', { name: 'Item Value' }).fill('food');
  await english.getByRole('textbox', { name: 'Summary' }).fill('Eat after dark.');
  await english.getByRole('textbox', { name: 'Body' }).click();
  await page.keyboard.type('Follow the **lanterns**.');
});

test('copies the fields from another locale', async ({ cms, page }) => {
  const french = await showLocale(page, 1, 'French');

  // The locales to copy from are gathered in a submenu of the pane’s options
  await cms.chooseMenuItem(
    french.getByRole('button', { name: /Show.*French.*Content Options/ }),
    page.getByRole('menuitem', { name: 'Copy from…' }),
  );
  await page.getByRole('menuitem', { name: 'English' }).click();
  await expect(page.getByRole('status').filter({ hasText: /3 fields copied from/ })).toBeVisible();
  await expect(french.getByRole('textbox', { name: 'Title' })).toHaveValue('Night Markets');
  await expect(french.getByRole('textbox', { name: 'Body' })).toHaveText('Follow the lanterns.');

  const arabic = await showLocale(page, 1, 'Arabic');

  await arabic.getByRole('textbox', { name: 'Title' }).fill('أسواق الليل');
  await arabic.getByRole('textbox', { name: 'Body' }).click();
  await page.keyboard.type('اتبع الفوانيس.');
  await save(page);

  // The field that isn’t localized isn’t copied
  expect((await cms.readRepo())['content/articles/night-markets.fr.md']).toBe(
    markdown(
      { title: 'Night Markets', date: '2026-05-01', tags: ['food'], summary: 'Eat after dark.' },
      'Follow the **lanterns**.',
    ),
  );
});

test('translates one field, asking for the API key first', async ({ cms, page }) => {
  const requests = await mockTranslator(page);
  const french = await showLocale(page, 1, 'French');
  const field = french.getByRole('group', { name: /Body.*Field/ });

  await cms.chooseMenuItem(
    field.getByRole('button', { name: 'Translate' }),
    page.getByRole('menuitem', { name: /Translate from.*English/ }),
  );

  const dialog = page.getByRole('alertdialog', { name: 'Translate Field' });

  await dialog.getByRole('textbox', { name: 'API Key' }).fill(API_KEY);
  await expect(page.getByRole('status').filter({ hasText: /Field translated from/ })).toBeVisible();
  await expect(field.getByRole('textbox', { name: 'Body' })).toHaveText('FR: Follow the lanterns.');
  // The other fields are left alone
  await expect(french.getByRole('textbox', { name: 'Title' })).toHaveValue('');

  // The Markdown is sent as HTML
  expect(requests).toEqual([
    {
      q: ['<p dir="auto">Follow the <strong>lanterns</strong>.</p>\n'],
      source: 'en',
      target: 'fr',
      apiKey: API_KEY,
    },
  ]);
});

test('translates every empty field of a locale at once', async ({ cms, page }) => {
  const requests = await mockTranslator(page);
  const arabic = await showLocale(page, 1, 'Arabic');

  // A field filled in already is kept
  await arabic.getByRole('textbox', { name: 'Title' }).fill('أسواق الليل');
  // The pane’s button comes before those of the fields
  await cms.chooseMenuItem(
    arabic.getByRole('button', { name: 'Translate' }).first(),
    page.getByRole('menuitem', { name: /Translate from.*English/ }),
  );
  await page
    .getByRole('alertdialog', { name: 'Translate Fields' })
    .getByRole('textbox', { name: 'API Key' })
    .fill(API_KEY);
  await expect(
    page.getByRole('status').filter({ hasText: /2 fields translated from/ }),
  ).toBeVisible();
  await expect(arabic.getByRole('textbox', { name: 'Title' })).toHaveValue('أسواق الليل');
  await expect(arabic.getByRole('textbox', { name: 'Summary' })).toHaveValue('AR: Eat after dark.');
  await expect(arabic.getByRole('textbox', { name: 'Body' })).toHaveText(
    'AR: Follow the lanterns.',
  );
  expect(requests.map(({ q, target }) => ({ q, target }))).toEqual([
    {
      q: ['Eat after dark.', '<p dir="auto">Follow the <strong>lanterns</strong>.</p>\n'],
      target: 'ar',
    },
  ]);

  const french = await showLocale(page, 1, 'French');

  await french.getByRole('textbox', { name: 'Title' }).fill('Marchés de nuit');
  await french.getByRole('textbox', { name: 'Body' }).click();
  await page.keyboard.type('Suivez les lanternes.');
  await save(page);

  // The field that isn’t localized isn’t translated
  expect((await cms.readRepo())['content/articles/night-markets.ar.md']).toBe(
    markdown(
      { title: 'أسواق الليل', date: '2026-05-01', tags: ['food'], summary: 'AR: Eat after dark.' },
      'AR: Follow the **lanterns**.',
    ),
  );
});
