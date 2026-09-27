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

test('lays out the Arabic rich text editor left to right (known issue)', async ({ page }) => {
  // Known issue: Sveltia UI’s `TextEditor` only applies its `dir` attribute to the Markdown source
  // text area, not to the rich text editor, which is left to right in every locale. Its paragraphs
  // take the direction of their own text, but an empty editor, a list or a mix of scripts is laid
  // out left to right. Once it’s fixed, expect the editor’s `dir` attribute to be `rtl`
  await openEntry(page, 'Articles', /Lyon/);

  const arabic = await showLocale(page, 1, 'Arabic');
  const field = arabic.getByRole('group', { name: /Body.*Field/ });
  const body = field.getByRole('textbox', { name: 'Body' });

  await expect(body).toHaveText('ابدأ بالسوق المغطى.');
  expect(await body.evaluate((element) => getComputedStyle(element).direction)).toBe('ltr');

  await field.getByRole('button', { name: 'Edit in Markdown' }).click();
  await expect(field.getByRole('textbox', { name: 'Body' })).toHaveAttribute('dir', 'rtl');
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
