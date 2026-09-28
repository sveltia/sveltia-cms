import { MULTILINGUAL_CONFIG, MULTILINGUAL_FILES } from '../../fixtures/configs/multilingual.js';
import { expect, test } from '../../fixtures/test.js';
import { getEditPane } from '../multilingual/helpers.js';

import { getEditor, PHONE, signIn } from './helpers.js';

/**
 * @import { CMS } from '../../fixtures/test.js';
 * @import { Page } from '@playwright/test';
 */

test.use({ config: MULTILINGUAL_CONFIG, ...PHONE });

test.beforeEach(async ({ cms, page }) => {
  await cms.open();
  await cms.seed(MULTILINGUAL_FILES);
  await signIn(page);
  await page.getByRole('treeitem', { name: 'Articles' }).click();
  await page.getByRole('row', { name: /Lyon/ }).tap();
});

/**
 * Show another locale in the only pane, with the “Switch Locale” dropdown list in its header,
 * which replaces the radio group of a larger screen.
 * @param {CMS} cms CMS.
 * @param {Page} page Page.
 * @param {string} localeName Locale name, e.g. `French`.
 */
const switchLocale = async (cms, page, localeName) => {
  await cms.chooseMenuItem(
    getEditor(page).getByRole('combobox', { name: 'Switch Locale' }),
    page.getByRole('listbox').getByRole('option', { name: localeName }),
  );
  await expect(getEditPane(page, localeName)).toBeVisible();
};

test('switches the locale in the only pane, and saves', async ({ cms, page }) => {
  const editor = getEditor(page);
  const switcher = editor.getByRole('combobox', { name: 'Switch Locale' });

  // One pane at a time: the default locale comes first, and the other locales are in the list
  await expect(getEditPane(page, 'English').getByRole('textbox', { name: 'Title' })).toHaveValue(
    'A Weekend in Lyon',
  );
  await expect(editor.getByRole('group', { name: /^Edit.*Content$/ })).toHaveCount(1);
  await expect(switcher).toHaveText('English');
  await cms.openPopup(switcher, page.getByRole('listbox'));
  await expect(page.getByRole('listbox')).toMatchAriaSnapshot(`
    - option "French"
    - option "English" [selected]
    - option "Arabic"
  `);
  await page.keyboard.press('Escape');

  await switchLocale(cms, page, 'French');

  const french = getEditPane(page, 'French');

  await expect(switcher).toHaveText('French');
  await expect(getEditPane(page, 'English')).toHaveCount(0);
  await expect(french.getByRole('textbox', { name: 'Title' })).toHaveValue('Un week-end à Lyon');
  await french.getByRole('textbox', { name: 'Title' }).fill('Deux jours à Lyon');

  // The Arabic content is laid out from right to left
  await switchLocale(cms, page, 'Arabic');
  await expect(getEditPane(page, 'Arabic').getByRole('textbox', { name: 'Title' })).toHaveAttribute(
    'dir',
    'rtl',
  );

  // The change made in French is kept while another locale is shown
  await switchLocale(cms, page, 'French');
  await expect(french.getByRole('textbox', { name: 'Title' })).toHaveValue('Deux jours à Lyon');

  await editor.getByRole('button', { name: 'Save' }).click();
  await expect
    .poll(async () => (await cms.readRepo())['content/articles/lyon.fr.md'])
    .toMatch(/^title: Deux jours à Lyon$/m);
  expect((await cms.readRepo())['content/articles/lyon.en.md']).toBe(
    MULTILINGUAL_FILES['content/articles/lyon.en.md'],
  );
});

test('previews the locale shown in the pane', async ({ cms, page }) => {
  const editor = getEditor(page);
  const previewButton = editor.getByRole('button', { name: 'Preview' });

  await switchLocale(cms, page, 'French');
  await previewButton.click();
  await expect(previewButton).toHaveAttribute('aria-pressed', 'true');

  const preview = editor.getByRole('group', { name: /^Preview.*Content$/ });

  await expect(preview).toContainText('Commencez par les halles.');
  await expect(getEditPane(page, 'French')).toHaveCount(0);

  // Choosing another locale goes back to the editor, and the preview then shows that locale
  await cms.chooseMenuItem(
    editor.getByRole('combobox', { name: 'Switch Locale' }),
    page.getByRole('listbox').getByRole('option', { name: 'English' }),
  );
  await expect(getEditPane(page, 'English')).toBeVisible();
  await expect(previewButton).toHaveAttribute('aria-pressed', 'false');
  await previewButton.click();
  await expect(preview).toContainText('Start at the covered market.');

  // Back to the editor, in the same locale
  await previewButton.click();
  await expect(getEditPane(page, 'English').getByRole('textbox', { name: 'Title' })).toHaveValue(
    'A Weekend in Lyon',
  );
});
