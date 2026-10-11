import { createPNG } from '../../fixtures/files.js';
import { expect, test } from '../../fixtures/test.js';

import { getEditPane, openEntry, save, showLocale } from './helpers.js';

/**
 * @import { Locator } from '@playwright/test';
 */

/**
 * With the `multiple_folders` i18n structure and an entry-relative media folder, each locale’s
 * entry file has a folder of its own, and the images a locale references are stored beside it.
 */
test.use({
  config: {
    backend: { name: 'test-repo' },
    media_folder: 'static/uploads',
    public_folder: '/uploads',
    i18n: { structure: 'multiple_folders', locales: ['en', 'fr'], default_locale: 'en' },
    collections: [
      {
        name: 'posts',
        label: 'Posts',
        folder: 'content/posts',
        path: '{{slug}}/index',
        create: true,
        i18n: true,
        media_folder: '',
        public_folder: '',
        fields: [
          { name: 'title', label: 'Title', i18n: true },
          { name: 'cover', label: 'Cover', widget: 'image', i18n: true },
        ],
      },
    ],
  },
});

// Each copy has an aspect ratio of its own, which tells which one is shown, as the thumbnail is
// scaled
const ENGLISH_PHOTO = createPNG({ width: 40, height: 20, color: [200, 100, 50] });
const FRENCH_PHOTO = createPNG({ width: 20, height: 40, color: [50, 100, 200] });
const FRENCH_ONLY_PHOTO = createPNG({ width: 60, height: 20, color: [100, 200, 50] });

test.beforeEach(async ({ cms }) => {
  await cms.open();
  await cms.seed({
    'content/posts/en/hello/index.md': '---\ntitle: Hello\ncover: photo.png\n---\n',
    'content/posts/en/hello/photo.png': ENGLISH_PHOTO,
    'content/posts/fr/hello/index.md': '---\ntitle: Bonjour\ncover: photo-fr.png\n---\n',
    'content/posts/fr/hello/photo.png': FRENCH_PHOTO,
    'content/posts/fr/hello/photo-fr.png': FRENCH_ONLY_PHOTO,
  });
  await cms.signIn();
});

/**
 * Get the Cover field of an editor pane.
 * @param {Locator} pane Editor pane.
 * @returns {Locator} Field group.
 */
const getCover = (pane) => pane.getByRole('group', { name: '“\u2068Cover\u2069” Field' });

/**
 * Wait for the thumbnail of an Image field to be decoded, and get its aspect ratio.
 * @param {Locator} field Field group.
 * @returns {Promise<number>} Width divided by height.
 */
const getThumbnailRatio = async (field) => {
  // The thumbnail is decorative, with an empty `alt`, so it has no role
  const thumbnail = field.locator('img');

  await expect(thumbnail).toBeVisible();
  await expect.poll(() => thumbnail.evaluate((img) => img.naturalWidth)).toBeGreaterThan(0);

  return thumbnail.evaluate((img) => img.naturalWidth / img.naturalHeight);
};

test('shows the image a locale references from beside its own entry file', async ({ page }) => {
  await openEntry(page, 'Posts', /Hello/);
  expect(await getThumbnailRatio(getCover(getEditPane(page, 'English')))).toBeCloseTo(2, 1);

  const french = await showLocale(page, 1, 'French');
  const cover = getCover(french);

  await expect(cover.getByRole('textbox', { name: 'Cover' })).toHaveText('photo-fr.png');
  expect(await getThumbnailRatio(cover)).toBeCloseTo(3, 1);
});

test('picks an image from the folder of the locale being edited', async ({ cms, page }) => {
  await openEntry(page, 'Posts', /Hello/);

  const french = await showLocale(page, 1, 'French');
  const cover = getCover(french);

  await cover.getByRole('button', { name: 'Replace Image' }).click();

  const dialog = page.getByRole('dialog', { name: 'Select Image' });
  const list = dialog.getByRole('listbox', { name: 'Available Images' });

  await expect(dialog.getByRole('option', { name: 'Entry Assets' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  // The French entry’s images, not the English one’s
  await expect(list.getByRole('option')).toHaveText(['photo-fr.png', 'photo.png']);
  await list.getByRole('option', { name: 'photo.png' }).click();
  await dialog.getByRole('button', { name: 'Insert' }).click();
  await expect(dialog).toBeHidden();

  // The French copy is referenced, with a path relative to the French entry file
  await expect(cover.getByRole('textbox', { name: 'Cover' })).toHaveText('photo.png');
  expect(await getThumbnailRatio(cover)).toBeCloseTo(0.5, 1);

  await save(page);

  const files = await cms.readRepo();

  expect(files['content/posts/fr/hello/index.md']).toBe(
    '---\ntitle: Bonjour\ncover: photo.png\n---\n',
  );
  expect(files['content/posts/en/hello/index.md']).toBe(
    '---\ntitle: Hello\ncover: photo.png\n---\n',
  );
});
