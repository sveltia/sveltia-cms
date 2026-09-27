import {
  markdown,
  MULTILINGUAL_CONFIG,
  MULTILINGUAL_FILES,
} from '../../fixtures/configs/multilingual.js';
import { expect, test } from '../../fixtures/test.js';

import { getEditPane, getPreviewPane, openEntry, save, showLocale } from './helpers.js';

test.use({ config: MULTILINGUAL_CONFIG });

test.beforeEach(async ({ cms }) => {
  await cms.open();
  await cms.seed(MULTILINGUAL_FILES);
  await cms.signIn();
});

test('lays out the Arabic fields and preview right to left', async ({ page }) => {
  await openEntry(page, 'Articles', /Lyon/);

  const english = getEditPane(page, 'English');

  await expect(english.getByRole('textbox', { name: 'Title' })).toHaveAttribute('dir', 'ltr');

  // The preview follows the locale edited in the first pane
  const arabic = await showLocale(page, 0, 'Arabic');

  await expect(arabic.getByRole('textbox', { name: 'Title' })).toHaveAttribute('dir', 'rtl');
  await expect(arabic.getByRole('textbox', { name: 'Title' })).toHaveAttribute('lang', 'ar');
  await expect(arabic.getByRole('textbox', { name: 'Summary' })).toHaveAttribute('dir', 'rtl');
  await expect(arabic.getByRole('textbox', { name: 'Item Value' }).first()).toHaveAttribute(
    'dir',
    'rtl',
  );

  const preview = getPreviewPane(page).getByRole('document', { name: 'Content Preview' });
  const title = preview.getByText('عطلة نهاية الأسبوع في ليون');

  await expect(title).toHaveAttribute('dir', 'rtl');
  await expect(title).toHaveAttribute('lang', 'ar');
  await expect(preview.getByText('أسواق ومطاعم.')).toHaveAttribute('dir', 'rtl');
  // A rich text block takes the direction of its own text
  await expect(preview.getByText('ابدأ بالسوق المغطى.')).toHaveAttribute('dir', 'auto');
});

test('lays out the Arabic rich text editor right to left', async ({ page }) => {
  await openEntry(page, 'Articles', /Lyon/);

  const arabic = await showLocale(page, 1, 'Arabic');
  const field = arabic.getByRole('group', { name: /Body.*Field/ });
  const body = field.getByRole('textbox', { name: 'Body' });

  await expect(body).toHaveText('ابدأ بالسوق المغطى.');
  await expect(body).toHaveAttribute('dir', 'rtl');
  // A new paragraph follows the editor, although it has no text to take a direction from. Put the
  // caret at the end, as a click would split the paragraph; the End key doesn’t move it on macOS
  await body.evaluate((element) => {
    /** @type {HTMLElement} */ (element).focus();
    window.getSelection()?.selectAllChildren(element);
    window.getSelection()?.collapseToEnd();
  });
  await page.keyboard.press('Enter');
  await expect(body.locator('p')).toHaveCount(2);
  await expect(body.locator('p').nth(1)).toHaveText('');
  expect(
    await body
      .locator('p')
      .nth(1)
      .evaluate((element) => getComputedStyle(element).direction),
  ).toBe('rtl');

  // So does the Markdown source
  await field.getByRole('button', { name: 'Edit in Markdown' }).click();
  await expect(field.getByRole('textbox', { name: 'Body' })).toHaveAttribute('dir', 'rtl');

  // The English editor is left to right
  await expect(
    getEditPane(page, 'English')
      .getByRole('group', { name: /Body.*Field/ })
      .getByRole('textbox', { name: 'Body' }),
  ).toHaveAttribute('dir', 'ltr');
});

test('gives a localized slug in Arabic script to the Arabic file', async ({ cms, page }) => {
  await openEntry(page, 'Guides', /Kyoto/);

  const arabic = await showLocale(page, 1, 'Arabic');

  await arabic.getByRole('button', { name: /Enable.*Arabic/ }).click();
  await arabic.getByRole('textbox', { name: 'Title' }).fill('معابد كيوتو');
  await arabic.getByRole('textbox', { name: 'Body' }).click();
  await page.keyboard.type('اذهب مبكرًا.');
  await save(page);

  expect((await cms.readRepo())['content/ar/guides/معابد-كيوتو.md']).toBe(
    markdown(
      { translationKey: 'kyoto-temples', title: 'معابد كيوتو', region: 'Asia' },
      'اذهب مبكرًا.',
    ),
  );
});
