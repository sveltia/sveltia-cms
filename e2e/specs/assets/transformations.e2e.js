import { readFile } from 'fs/promises';

import { MEDIA_CONFIG, MEDIA_FILES } from '../../fixtures/configs/media.js';
import { createPNG } from '../../fixtures/files.js';
import { expect, test } from '../../fixtures/test.js';

/**
 * @import { Locator, Page } from '@playwright/test';
 */

/**
 * The media site, with uploaded raster images converted to WebP and scaled down to 400 × 400 pixels
 * at most, and SVG images optimized. The projects’ image field has its own transformations, which
 * replace the site’s: a maximum width of 120 pixels, and no SVG optimization.
 */
const CONFIG = {
  ...MEDIA_CONFIG,
  media_libraries: {
    all: {
      transformations: {
        raster_image: { format: 'webp', quality: 85, width: 400, height: 400 },
        svg: { optimize: true },
      },
    },
  },
  collections: MEDIA_CONFIG.collections.map((collection) =>
    collection.name === 'projects'
      ? {
          ...collection,
          fields: collection.fields.map((field) =>
            field.name === 'image'
              ? {
                  ...field,
                  media_libraries: {
                    default: { config: { transformations: { raster_image: { width: 120 } } } },
                  },
                }
              : field,
          ),
        }
      : collection,
  ),
};

test.use({ config: CONFIG });

/**
 * Number of requests for the HEIC decoder the test has answered.
 */
let heicDecoderRequests = 0;

test.beforeEach(async ({ cms, context }) => {
  heicDecoderRequests = 0;

  // SVGO and the HEIC decoder are loaded from UNPKG on first use; serve the copies installed with
  // the CMS instead, so the tests don’t depend on the network
  await context.route('https://unpkg.com/svgo@*/dist/svgo.browser.js', async (route) =>
    route.fulfill({
      contentType: 'text/javascript',
      body: await readFile(
        new URL('../../../node_modules/svgo/dist/svgo.browser.js', import.meta.url),
      ),
    }),
  );
  await context.route('https://unpkg.com/@discourse/heic@*/**', async (route) => {
    heicDecoderRequests += 1;

    const path = new URL(route.request().url()).pathname.replace(/^\/@discourse\/heic@[^/]+\//, '');

    await route.fulfill({
      contentType: path.endsWith('.wasm') ? 'application/wasm' : 'text/javascript',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: await readFile(
        new URL(`../../../node_modules/@discourse/heic/${path}`, import.meta.url),
      ),
    });
  });

  await cms.open();
  await cms.seed(MEDIA_FILES);
  await cms.signIn();
});

/**
 * A landscape photo larger than the site’s maximum size.
 */
const LANDSCAPE = {
  name: 'landscape.png',
  mimeType: 'image/png',
  buffer: createPNG({ width: 800, height: 600, color: [255, 128, 0] }),
};

/**
 * A portrait photo larger than the site’s maximum size.
 */
const PORTRAIT = {
  name: 'portrait.png',
  mimeType: 'image/png',
  buffer: createPNG({ width: 200, height: 1000, color: [0, 128, 255] }),
};

/**
 * An icon smaller than the site’s maximum size.
 */
const ICON = {
  name: 'icon.png',
  mimeType: 'image/png',
  buffer: createPNG({ width: 64, height: 32, color: [128, 0, 255] }),
};

/**
 * An SVG image with an XML declaration, a comment and editor metadata for SVGO to remove.
 */
const LOGO = {
  name: 'logo.svg',
  mimeType: 'image/svg+xml',
  buffer: Buffer.from(
    [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<!-- Generator: Some Drawing App 1.0 -->',
      '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 10 10">',
      '  <metadata>Drawn by hand</metadata>',
      '  <rect x="0" y="0" width="10" height="10" fill="#ff0000"/>',
      '</svg>',
      '',
    ].join('\n'),
  ),
};

/**
 * Check that a file is a WebP image: a RIFF container of the `WEBP` type.
 * @param {Buffer | undefined} buffer File content.
 */
const expectWebP = (buffer) => {
  expect(buffer?.subarray(0, 4).toString('ascii')).toBe('RIFF');
  expect(buffer?.subarray(8, 12).toString('ascii')).toBe('WEBP');
};

/**
 * Decode an image in the page to get its dimensions.
 * @param {Page} page Page.
 * @param {Buffer | undefined} buffer Image file content.
 * @returns {Promise<{ width: number, height: number }>} Dimensions.
 */
const getImageSize = (page, buffer) =>
  page.evaluate(
    async (bytes) => {
      const bitmap = await createImageBitmap(new Blob([new Uint8Array(bytes)]));
      const { width, height } = bitmap;

      bitmap.close();

      return { width, height };
    },
    /** @type {number[]} */ ([...(buffer ?? [])]),
  );

/**
 * Start a new entry in a collection and get a field group in the editor.
 * @param {Page} page Page.
 * @param {RegExp} collection Collection name, followed by the number of entries.
 * @param {string} label Field label.
 * @returns {Promise<Locator>} Field group.
 */
const createEntry = async (page, collection, label) => {
  await page.getByRole('treeitem', { name: collection }).click();
  await page.getByRole('button', { name: 'Create New Entry' }).first().click();

  const editor = page.getByRole('group', { name: 'Content Editor' });

  await editor.getByRole('textbox', { name: 'Title' }).fill('Trip');

  return editor.getByRole('group', { name: `“\u2068${label}\u2069” Field` });
};

/**
 * Upload files to a media field with its hidden file input.
 * @param {Locator} field Field group.
 * @param {{ name: string, mimeType: string, buffer: Buffer }[]} files Files.
 */
const uploadFiles = async (field, files) => {
  await field.locator('input[type="file"]').first().setInputFiles(files);
};

/**
 * Choose files with the Upload button of the asset library, and get the confirmation dialog.
 * @param {Page} page Page.
 * @param {{ name: string, mimeType: string, buffer: Buffer }[]} files Files.
 * @returns {Promise<Locator>} Upload dialog.
 */
const chooseAssets = async (page, files) => {
  await page.getByRole('radio', { name: 'Assets' }).click();
  await page.getByRole('option', { name: /Global Assets/ }).click();
  await page.getByRole('button', { name: 'Upload New Assets' }).click();

  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page
      .getByRole('dialog', { name: 'Upload New Assets' })
      .getByRole('button', { name: 'Choose Files' })
      .click(),
  ]);

  await chooser.setFiles(files);

  return page.getByRole('alertdialog', { name: 'Upload New Assets' });
};

test('converts an image added to a field to WebP and scales it down', async ({ cms, page }) => {
  const field = await createEntry(page, /Notes/, 'Cover');

  await uploadFiles(field, [LANDSCAPE]);

  // The field shows the new name before the entry is saved
  await expect(field.getByRole('textbox', { name: 'Cover' })).toHaveText('/uploads/landscape.webp');
  await page.getByRole('button', { name: 'Save' }).click();

  await expect
    .poll(async () => (await cms.readRepo())['content/notes/trip.md'])
    .toBe("---\ntitle: Trip\ncover: /uploads/landscape.webp\nattachment: ''\ngallery: []\n---\n");

  const saved = await cms.readRepoFile('static/uploads/landscape.webp');

  expectWebP(saved);
  // 800 × 600 fits in 400 × 400 at half the size, keeping the 4:3 aspect ratio
  expect(await getImageSize(page, saved)).toEqual({ width: 400, height: 300 });
  expect(await cms.readRepoFile('static/uploads/landscape.png')).toBeUndefined();
});

test('converts images uploaded to the asset library, without enlarging a small one', async ({
  cms,
  page,
}) => {
  const dialog = await chooseAssets(page, [PORTRAIT, ICON]);

  // The dialog lists the files under their new names, and says what they were converted from
  await expect(dialog.getByRole('listitem')).toHaveText([
    /portrait\.webp WebP image · .+ \(converted from \u2068PNG image\u2069\)/,
    /icon\.webp WebP image · .+ \(converted from \u2068PNG image\u2069\)/,
  ]);
  await dialog.getByRole('button', { name: 'Upload' }).click();

  await expect.poll(() => cms.readRepoFile('static/uploads/icon.webp')).toBeDefined();

  const portrait = await cms.readRepoFile('static/uploads/portrait.webp');
  const icon = await cms.readRepoFile('static/uploads/icon.webp');

  expectWebP(portrait);
  expectWebP(icon);
  // 200 × 1000 is scaled down to fit the height, while 64 × 32 is kept as is
  expect(await getImageSize(page, portrait)).toEqual({ width: 80, height: 400 });
  expect(await getImageSize(page, icon)).toEqual({ width: 64, height: 32 });
  expect(await cms.readRepoFile('static/uploads/portrait.png')).toBeUndefined();
  expect(await cms.readRepoFile('static/uploads/icon.png')).toBeUndefined();
});

test('optimizes an SVG image uploaded to the asset library', async ({ cms, page }) => {
  const dialog = await chooseAssets(page, [LOGO]);

  // An SVG image keeps its format and name
  await expect(dialog.getByRole('listitem')).toHaveText([/logo\.svg.*SVG image/]);
  await expect(dialog.getByRole('listitem')).not.toContainText('converted');
  await dialog.getByRole('button', { name: 'Upload' }).click();

  await expect.poll(() => cms.readRepoFile('static/uploads/logo.svg')).toBeDefined();

  const saved = /** @type {Buffer} */ (await cms.readRepoFile('static/uploads/logo.svg'));
  const svg = saved.toString('utf8');

  expect(svg).toMatch(/^<svg /);
  expect(svg).not.toContain('<?xml');
  expect(svg).not.toContain('Generator');
  expect(svg).not.toContain('metadata');
  expect(svg).not.toContain('\n');
  expect(svg).toContain('viewBox="0 0 10 10"');
  expect(saved.length).toBeLessThan(LOGO.buffer.length);
});

test('applies the transformations of a field over the site’s', async ({ cms, page }) => {
  const field = await createEntry(page, /Projects/, 'Image');

  await uploadFiles(field, [LANDSCAPE]);

  await expect(field.getByRole('textbox', { name: 'Image' })).toHaveText(
    '/projects/landscape.webp',
  );
  await page.getByRole('button', { name: 'Save' }).click();

  await expect
    .poll(async () => (await cms.readRepo())['content/projects/trip.md'])
    .toBe('---\ntitle: Trip\nimage: /projects/landscape.webp\n---\n');

  const saved = await cms.readRepoFile('static/projects/landscape.webp');

  // The field’s maximum width of 120 pixels replaces the site’s 400 × 400, and the height follows
  expectWebP(saved);
  expect(await getImageSize(page, saved)).toEqual({ width: 120, height: 90 });
});

test('leaves an SVG image as is in a field whose transformations don’t optimize it', async ({
  cms,
  page,
}) => {
  const field = await createEntry(page, /Projects/, 'Image');

  await uploadFiles(field, [LOGO]);

  await expect(field.getByRole('textbox', { name: 'Image' })).toHaveText('/projects/logo.svg');
  await page.getByRole('button', { name: 'Save' }).click();

  await expect
    .poll(async () => (await cms.readRepo())['content/projects/trip.md'])
    .toBe('---\ntitle: Trip\nimage: /projects/logo.svg\n---\n');
  expect(await cms.readRepoFile('static/projects/logo.svg')).toEqual(LOGO.buffer);
});

test('converts a HEIC photo added to a field to WebP', async ({ cms, page }) => {
  const field = await createEntry(page, /Notes/, 'Cover');

  // A 600 × 200 photo made with `sips -s format heic` on macOS
  await uploadFiles(field, [
    {
      name: 'photo.heic',
      mimeType: 'image/heic',
      buffer: await readFile(new URL('fixtures/teal-600x200.heic', import.meta.url)),
    },
  ]);

  await expect(field.getByRole('textbox', { name: 'Cover' })).toHaveText('/uploads/photo.webp');
  await page.getByRole('button', { name: 'Save' }).click();

  await expect
    .poll(async () => (await cms.readRepo())['content/notes/trip.md'])
    .toBe("---\ntitle: Trip\ncover: /uploads/photo.webp\nattachment: ''\ngallery: []\n---\n");

  const saved = await cms.readRepoFile('static/uploads/photo.webp');

  expectWebP(saved);
  // Scaled down to the maximum width, keeping the 3:1 aspect ratio
  expect(await getImageSize(page, saved)).toEqual({ width: 400, height: 133 });
  expect(await cms.readRepoFile('static/uploads/photo.heic')).toBeUndefined();
  // The decoder was loaded from the route above, not from the network
  expect(heicDecoderRequests).toBeGreaterThan(0);
});
