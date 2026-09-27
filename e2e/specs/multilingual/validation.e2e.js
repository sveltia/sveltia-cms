import { MULTILINGUAL_CONFIG, MULTILINGUAL_FILES } from '../../fixtures/configs/multilingual.js';
import { expect, test } from '../../fixtures/test.js';

import { getEditor, getEditPane, openEntry, save, showLocale } from './helpers.js';

test.use({ config: MULTILINGUAL_CONFIG });

test.beforeEach(async ({ cms }) => {
  await cms.open();
  await cms.seed(MULTILINGUAL_FILES);
  await cms.signIn();
});

test('refuses to save with an error in a locale that isn’t shown', async ({ cms, page }) => {
  await openEntry(page, 'Articles', /Lyon/);

  const editor = getEditor(page);
  const arabic = await showLocale(page, 1, 'Arabic');

  await arabic.getByRole('textbox', { name: 'Title' }).fill('');

  // Edit another locale, so the one with the error is out of sight
  const french = await showLocale(page, 1, 'French');

  await french.getByRole('textbox', { name: 'Summary' }).fill('Marchés, bouchons et traboules.');
  await editor.getByRole('button', { name: 'Save' }).click();

  const alert = page.getByRole('alert').filter({ hasText: /One field has an error/ });

  await expect(alert).toBeVisible();
  // The locale with the error is marked in both panes’ switchers
  await expect(
    editor.getByRole('radiogroup', { name: 'Switch Locale' }).getByRole('radio', {
      name: 'Arabic (error)',
    }),
  ).toHaveCount(2);

  // The Validation panel lists the error under its locale, and takes the user to the field
  await alert.getByRole('button', { name: 'Show Errors' }).click();

  const arabicErrors = page
    .getByRole('group')
    .filter({ has: page.getByRole('heading', { name: 'Arabic' }) });

  await arabicErrors.getByRole('button', { name: /Title/ }).click();
  await expect(
    getEditPane(page, 'Arabic')
      .getByRole('group', { name: /Title.*Field/ })
      .getByRole('alert'),
  ).toContainText('This field is required.');

  // Nothing has been saved
  expect((await cms.readRepo())['content/articles/lyon.fr.md']).toBe(
    MULTILINGUAL_FILES['content/articles/lyon.fr.md'],
  );

  await getEditPane(page, 'Arabic')
    .getByRole('textbox', { name: 'Title' })
    .fill('ليون في عطلة نهاية الأسبوع');
  await save(page);

  const files = await cms.readRepo();

  expect(files['content/articles/lyon.fr.md']).toContain(
    'summary: Marchés, bouchons et traboules.',
  );
  expect(files['content/articles/lyon.ar.md']).toContain('title: ليون في عطلة نهاية الأسبوع');
});

test('refuses to save a new entry filled in the default locale only', async ({ cms, page }) => {
  await page.getByRole('button', { name: 'Create New Entry' }).first().click();

  const english = getEditPane(page, 'English');

  await english.getByRole('textbox', { name: 'Title' }).fill('Night Markets');
  await english.getByRole('textbox', { name: 'Date' }).fill('2026-05-01');
  await english.getByRole('textbox', { name: 'Author' }).fill('Lina Saleh');
  await english.getByRole('textbox', { name: 'Body' }).click();
  await page.keyboard.type('Follow the lanterns.');
  await getEditor(page).getByRole('button', { name: 'Save' }).click();

  // The title and the body are required in every locale, as all of them are saved
  await expect(page.getByRole('alert').filter({ hasText: /4 fields have errors/ })).toBeVisible();
  expect(Object.keys(await cms.readRepo()).filter((path) => path.includes('night'))).toEqual([]);
});
