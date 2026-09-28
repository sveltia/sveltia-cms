import {
  COLLECTION_OPTIONS_CONFIG,
  COLLECTION_OPTIONS_FILES,
} from '../../fixtures/configs/collection-options.js';
import { expect, test } from '../../fixtures/test.js';

import { openCollection } from './helpers.js';

/**
 * @import { Locator, Page } from '@playwright/test';
 */

test.use({ config: COLLECTION_OPTIONS_CONFIG });

test.beforeEach(async ({ cms, page }) => {
  // The `{{year}}`, `{{month}}` and `{{day}}` tags in the slug and the path come from the time of
  // saving
  await page.clock.install({ time: new Date('2026-05-10T12:00:00Z') });
  await cms.open();
  await cms.seed(COLLECTION_OPTIONS_FILES);
  await cms.signIn();
  await openCollection(page, 'Journal');
});

/**
 * Get the content editor.
 * @param {Page} page Page.
 * @returns {Locator} Editor.
 */
const getEditor = (page) => page.getByRole('group', { name: 'Content Editor' });

test('saves a new post under the path and slug templates', async ({ cms, page }) => {
  await page.getByRole('button', { name: 'Create New Entry' }).click();

  const editor = getEditor(page);

  await editor.getByRole('textbox', { name: 'Title' }).fill('Compost Day!');
  await editor
    .getByRole('radiogroup', { name: 'Plot' })
    .getByRole('radio', { name: 'Herb Spiral' })
    .click();
  await editor.getByRole('textbox', { name: 'Body' }).fill('Turned the heap.');
  await editor.getByRole('button', { name: 'Save' }).click();

  // The read-only field is saved with its default value
  await expect
    .poll(async () => (await cms.readRepo())['content/journal/2026/0510-compost-day.md'])
    .toBe(
      [
        '---',
        'title: Compost Day!',
        'season: spring',
        'plot: herb-spiral',
        '---',
        '',
        'Turned the heap.',
        '',
      ].join('\n'),
    );
  await expect(page.getByRole('row', { name: /Compost Day!/ })).toBeVisible();
});

test('keeps a read-only field from being edited', async ({ page }) => {
  await page.getByRole('row', { name: /First Sowing/ }).click();

  const season = getEditor(page).getByRole('textbox', { name: 'Season' });

  await expect(season).toHaveValue('spring');
  await expect(season).toHaveAttribute('readonly');
  await season.click();
  await page.keyboard.type('autumn');
  await expect(season).toHaveValue('spring');
  await expect(getEditor(page).getByRole('button', { name: 'Save' })).toBeDisabled();
});

test('shows no preview pane with `editor.preview: false`', async ({ cms, page }) => {
  await page.getByRole('row', { name: /First Sowing/ }).click();

  const editor = getEditor(page);

  await expect(editor.getByRole('textbox', { name: 'Body' })).toHaveValue('Peas went in today.');
  await expect(editor.getByRole('group', { name: 'Preview Content' })).toHaveCount(0);
  await expect(editor.getByRole('button', { name: 'Swap Panes' })).toHaveCount(0);
  // With a single locale, the preview is all the second pane would show
  await cms.openPopup(
    page.getByRole('button', { name: 'Show Editor Options' }),
    page.getByRole('menuitemcheckbox', { name: 'Show Preview' }),
  );
  await expect(page.getByRole('menuitemcheckbox', { name: 'Show Second Pane' })).toBeDisabled();
  await expect(page.getByRole('menuitemcheckbox', { name: 'Show Preview' })).toBeDisabled();
});

test('saves an existing post where it is, whatever the date', async ({ cms, page }) => {
  await page.getByRole('row', { name: /First Sowing/ }).click();

  const editor = getEditor(page);

  await editor.getByRole('textbox', { name: 'Body' }).fill('Peas and beans went in today.');
  await editor.getByRole('button', { name: 'Save' }).click();

  await expect
    .poll(async () => (await cms.readRepo())['content/journal/2026/0301-first-sowing.md'])
    .toBe(
      COLLECTION_OPTIONS_FILES['content/journal/2026/0301-first-sowing.md'].replace(
        'Peas',
        'Peas and beans',
      ),
    );
  expect(
    Object.keys(await cms.readRepo()).filter((path) => path.startsWith('content/journal/')),
  ).toEqual(['content/journal/2026/0301-first-sowing.md']);
});
