import { createPNG } from '../fixtures/files.js';
import { expect, test } from '../fixtures/test.js';
import { getEditor, getEntryRows } from '../fixtures/ui.js';

/**
 * @import { Page } from '@playwright/test';
 */

/**
 * Files served next to the seed manifest, keyed by path.
 */
const SEED_FILES = {
  'content/posts/first-post.md': '---\ntitle: First Post\n---\n\nHello, world!\n',
  'content/posts/second-post.md': '---\ntitle: Second Post\n---\n\nSee you again.\n',
  'static/images/photo.png': createPNG(),
};

/**
 * Serve the seed manifest and files, and add a `<link rel="cms-seed-url">` element pointing to the
 * manifest to the admin page.
 * @param {Page} page Page.
 * @returns {Promise<{ manifestRequests: number }>} Counter of the requests for the manifest.
 */
const serveSeed = async (page) => {
  const counter = { manifestRequests: 0 };

  await page.route('**/admin/', async (route) => {
    const response = await route.fetch();

    await route.fulfill({
      response,
      body: (await response.text()).replace(
        '</head>',
        '<link rel="cms-seed-url" href="/seed/manifest.json" /></head>',
      ),
    });
  });

  await page.route('**/seed/**', async (route) => {
    const path = decodeURIComponent(new URL(route.request().url()).pathname.slice(6));

    if (path === 'manifest.json') {
      counter.manifestRequests += 1;
      await route.fulfill({ json: { files: [...Object.keys(SEED_FILES), 'missing.md'] } });
    } else if (path in SEED_FILES) {
      await route.fulfill({ body: SEED_FILES[/** @type {keyof SEED_FILES} */ (path)] });
    } else {
      await route.fulfill({ status: 404 });
    }
  });

  return counter;
};

/**
 * Sign in with the test backend, whose button offers to start the demo when the repository is
 * seeded, and wait for the main UI.
 * @param {Page} page Page.
 */
const startDemo = async (page) => {
  await page.getByRole('button', { name: 'Start Demo' }).click();
  await expect(page.getByRole('button', { name: 'Show Account Menu' })).toBeVisible();
};

test('seeds an empty repository on the first sign-in', async ({ cms, page }) => {
  await serveSeed(page);
  await cms.open();
  await startDemo(page);

  const list = page.getByRole('group', { name: 'Entry List' });

  await expect(getEntryRows(page)).toHaveCount(2);
  await expect(list.getByRole('row', { name: /First Post/ })).toBeVisible();
  await expect(list.getByRole('row', { name: /Second Post/ })).toBeVisible();

  await page.getByRole('radio', { name: 'Assets' }).click();
  await expect(
    page.getByRole('grid', { name: 'Assets' }).getByRole('row', { name: 'photo.png' }),
  ).toBeVisible();

  expect(await cms.readRepoFile('static/images/photo.png')).toEqual(
    SEED_FILES['static/images/photo.png'],
  );
});

test('keeps the changes to a seeded repository after a reload', async ({ cms, page }) => {
  const counter = await serveSeed(page);

  await cms.open();
  await startDemo(page);
  await page.getByRole('row', { name: /First Post/ }).click();

  const editor = getEditor(page);

  await editor.getByRole('textbox', { name: 'Title' }).fill('Edited Post');
  await editor.getByRole('button', { name: 'Save' }).click();
  await expect
    .poll(async () => (await cms.readRepo())['content/posts/first-post.md'])
    .toBe('---\ntitle: Edited Post\n---\n\nHello, world!\n');

  await page.goto(page.url().split('#')[0]);
  await expect(page.getByRole('row', { name: /Edited Post/ })).toBeVisible();
  await expect(page.getByRole('row', { name: /First Post/ })).toBeHidden();
  expect(counter.manifestRequests).toBe(1);
});

test('seeds the repository again after all the data is erased', async ({ cms, page }) => {
  const counter = await serveSeed(page);

  await cms.open();
  await cms.seed({ 'content/posts/existing-post.md': '---\ntitle: Existing Post\n---\n' });
  await startDemo(page);

  // An existing repository is not seeded
  await expect(getEntryRows(page)).toHaveCount(1);
  expect(counter.manifestRequests).toBe(0);

  const dialog = page.getByRole('dialog', { name: 'Settings' });

  await cms.chooseMenuItem(
    page.getByRole('button', { name: 'Show Account Menu' }),
    page.getByRole('menuitem', { name: 'Settings' }),
  );
  await dialog.getByRole('tab', { name: 'Data Management' }).click();
  await dialog.getByRole('button', { name: 'Erase All Data' }).click();
  await page
    .getByRole('alertdialog', { name: 'Erase All Data' })
    .getByRole('button', { name: 'Erase' })
    .click();

  await startDemo(page);
  await expect(getEntryRows(page)).toHaveCount(2);
  await expect(page.getByRole('row', { name: /Existing Post/ })).toBeHidden();
  expect(counter.manifestRequests).toBe(1);
});
