import { createPNG } from '../../fixtures/files.js';
import { expect, GITHUB_CONFIG, test } from '../../fixtures/test.js';

/**
 * @import { Locator, Page } from '@playwright/test';
 */

/**
 * Blog with an image field, on GitHub, as the draft backups are stored in IndexedDB for each
 * repository, which the `test-repo` backend doesn’t have.
 */
const CONFIG = {
  ...GITHUB_CONFIG,
  collections: [
    {
      ...GITHUB_CONFIG.collections[0],
      fields: [
        { name: 'title', label: 'Title' },
        { name: 'cover', label: 'Cover', widget: 'image', required: false },
      ],
    },
  ],
};

test.use({ config: CONFIG });

test.beforeEach(async ({ github }) => {
  github.commit({
    'content/posts/kite.md': '---\ntitle: Kite\ncover: /images/red.png\n---\n',
    'static/images/red.png': createPNG({ color: [255, 0, 0] }),
  });
});

/**
 * Get the color of the centre pixel of an image, with each channel rounded to 0 or 255, as the
 * thumbnail can be slightly off the original color.
 * @param {Locator} image Image.
 * @returns {Promise<number[]>} Red, green and blue values.
 */
const getColor = (image) =>
  image.evaluate(async (/** @type {HTMLImageElement} */ img) => {
    await img.decode();

    const canvas = document.createElement('canvas');
    const context = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));

    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    context.drawImage(img, 0, 0);

    return Array.from(
      context.getImageData(canvas.width / 2, canvas.height / 2, 1, 1).data.slice(0, 3),
    ).map((value) => (value < 128 ? 0 : 255));
  });

/**
 * Wait until the draft backup holding an unsaved file has been stored.
 * @param {Page} page Page.
 */
const waitForFileBackup = async (page) => {
  await expect
    .poll(() =>
      page.evaluate(async () => {
        /**
         * Wait for an IndexedDB request to succeed.
         * @param {IDBRequest} request Request.
         * @returns {Promise<any>} Result.
         */
        const getResult = (request) =>
          new Promise((resolve) => {
            request.addEventListener('success', () => resolve(request.result));
          });

        const counts = await Promise.all(
          (await indexedDB.databases()).map(async ({ name }) => {
            /** @type {IDBDatabase} */
            const db = await getResult(indexedDB.open(/** @type {string} */ (name)));

            if (!db.objectStoreNames.contains('draft-backups')) {
              db.close();

              return 0;
            }

            /** @type {{ files?: object }[]} */
            const backups = await getResult(
              db.transaction('draft-backups').objectStore('draft-backups').getAll(),
            );

            db.close();

            return backups.filter(({ files }) => Object.keys(files ?? {}).length).length;
          }),
        );

        return counts.reduce((sum, count) => sum + count, 0);
      }),
    )
    .toBe(1);
};

test('shows the preview of a restored unsaved image replacing a saved one', async ({
  cms,
  page,
}) => {
  await cms.open();

  const row = page.getByRole('row', { name: /Kite/ });
  const editor = page.getByRole('group', { name: 'Content Editor' });
  const cover = editor.getByRole('group', { name: '“\u2068Cover\u2069” Field' });
  const preview = cover.locator('img');

  await row.click();
  await expect.poll(() => getColor(preview)).toEqual([255, 0, 0]);

  // A change is only backed up once the user has interacted with the editor
  await editor.getByRole('textbox', { name: 'Title' }).click();
  await cover
    .locator('input[type="file"]')
    .first()
    .setInputFiles({
      name: 'yellow.png',
      mimeType: 'image/png',
      buffer: createPNG({ color: [255, 255, 0] }),
    });
  await expect(cover.getByRole('textbox', { name: 'Cover' })).toHaveText('/images/yellow.png');
  await expect.poll(() => getColor(preview)).toEqual([255, 255, 0]);
  await waitForFileBackup(page);
  await editor.getByRole('button', { name: 'Cancel Editing' }).click();

  // The saved image is shown in the editor until the backup is restored, which then replaces it
  // with the unsaved image in place
  await row.click();

  const dialog = page.getByRole('alertdialog', { name: 'Restore Draft' });

  await expect(dialog).toBeVisible();
  await expect.poll(() => getColor(preview)).toEqual([255, 0, 0]);
  await dialog.getByRole('button', { name: 'Restore' }).click();
  await expect(cover.getByRole('textbox', { name: 'Cover' })).toHaveText('/images/yellow.png');
  await expect.poll(() => getColor(preview)).toEqual([255, 255, 0]);
});
