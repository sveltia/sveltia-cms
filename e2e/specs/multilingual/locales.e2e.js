import {
  markdown,
  MULTILINGUAL_CONFIG,
  MULTILINGUAL_FILES,
} from '../../fixtures/configs/multilingual.js';
import { expect, test } from '../../fixtures/test.js';

import { getEditor, getEditPane, getPreviewPane, openEntry, save, showLocale } from './helpers.js';

test.use({ config: MULTILINGUAL_CONFIG });

test.beforeEach(async ({ cms }) => {
  await cms.open();
  await cms.seed(MULTILINGUAL_FILES);
  await cms.signIn();
});

test('switches the locale in both panes, and swaps them', async ({ page }) => {
  await openEntry(page, 'Articles', /Lyon/);

  const switchers = getEditor(page).getByRole('radiogroup', { name: 'Switch Locale' });

  // The second pane previews the locale edited in the first one
  await expect(getPreviewPane(page)).toContainText('Start at the covered market.');
  await showLocale(page, 0, 'French');
  await expect(getPreviewPane(page)).toContainText('Commencez par les halles.');

  // Once the second pane edits a locale, the other pane doesn’t offer it, but offers the preview
  const arabic = await showLocale(page, 1, 'Arabic');

  await expect(switchers.nth(0).getByRole('radio')).toHaveText(['French', 'English', 'Preview']);
  await expect(switchers.nth(1).getByRole('radio')).toHaveText(['English', 'Arabic', 'Preview']);
  await expect(arabic.getByRole('textbox', { name: 'Title' })).toHaveValue(
    'عطلة نهاية الأسبوع في ليون',
  );

  const french = getEditPane(page, 'French');

  await expect(french.getByRole('textbox', { name: 'Title' })).toHaveValue('Un week-end à Lyon');

  // Each pane keeps its own locale when they’re swapped
  await getEditor(page).getByRole('button', { name: 'Swap Panes' }).click();
  await expect(switchers.nth(0).getByRole('radio', { name: 'Arabic' })).toBeChecked();
  await expect(switchers.nth(1).getByRole('radio', { name: 'French' })).toBeChecked();

  // The first pane goes back to the default locale
  await showLocale(page, 0, 'English');
  await expect(getEditPane(page, 'English').getByRole('textbox', { name: 'Title' })).toHaveValue(
    'A Weekend in Lyon',
  );
});

test('keeps a change typed right before switching the locale', async ({ cms, page }) => {
  await openEntry(page, 'Articles', /Lyon/);

  const french = await showLocale(page, 1, 'French');
  const body = french.getByRole('textbox', { name: 'Body' });

  await expect(body).toHaveText('Commencez par les halles.');
  await body.click();
  await page.keyboard.type('Bienvenue. ');
  // The editor writes what was typed to the draft with a short delay, which the switch waits for.
  // It used to be lost, or written to the locale switched to
  await showLocale(page, 1, 'Arabic');
  await showLocale(page, 1, 'French');
  await expect(body).toContainText('Bienvenue.');
  await save(page);

  const files = await cms.readRepo();

  expect(files['content/articles/lyon.fr.md']).toContain('Bienvenue.');
  expect(files['content/articles/lyon.ar.md']).toBe(
    MULTILINGUAL_FILES['content/articles/lyon.ar.md'],
  );
});

test('enables a locale for an entry', async ({ cms, page }) => {
  await openEntry(page, 'Guides', /Kyoto/);

  const french = await showLocale(page, 1, 'French');

  await expect(french.getByRole('alert')).toHaveText(/The.*French.*content has been disabled\./);
  await french.getByRole('button', { name: /Enable.*French/ }).click();
  // The duplicated field comes from the default locale, and the rest is to be translated
  await expect(french.getByRole('radio', { name: 'Asia' })).toBeChecked();
  await french.getByRole('textbox', { name: 'Title' }).fill('Temples de Kyoto');
  await french.getByRole('textbox', { name: 'Body' }).click();
  await page.keyboard.type('Partez tôt.');
  await save(page);

  // The French file gets a slug of its own, linked to the English one by the translation key
  expect((await cms.readRepo())['content/fr/guides/temples-de-kyoto.md']).toBe(
    markdown(
      { translationKey: 'kyoto-temples', title: 'Temples de Kyoto', region: 'Asia' },
      'Partez tôt.',
    ),
  );
});

test('disables a locale for an entry, deleting its file', async ({ cms, page }) => {
  await openEntry(page, 'Guides', /Marrakesh/);

  const french = await showLocale(page, 1, 'French');

  await cms.chooseMenuItem(
    french.getByRole('button', { name: /Show.*French.*Content Options/ }),
    page.getByRole('menuitem', { name: /Disable.*French/ }),
  );
  await expect(french.getByRole('alert')).toHaveText(
    /The.*French.*content is now disabled\. It will be deleted when you save the entry\./,
  );

  // The default locale can’t be disabled
  const english = getEditPane(page, 'English');

  await english.getByRole('button', { name: /Show.*English.*Content Options/ }).click();
  await expect(page.getByRole('menuitem', { name: /Disable.*English/ })).toBeDisabled();
  await page.keyboard.press('Escape');

  await save(page);

  const files = await cms.readRepo();

  expect(files['content/fr/guides/souks-de-marrakech.md']).toBeUndefined();
  expect(files['content/en/guides/marrakesh-souks.md']).toBe(
    MULTILINGUAL_FILES['content/en/guides/marrakesh-souks.md'],
  );
});
