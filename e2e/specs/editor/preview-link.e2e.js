import { BASE_CONFIG, expect, test } from '../../fixtures/test.js';
import { getEditor, getOpenedURL } from '../../fixtures/ui.js';

/**
 * @import { Locator, Page } from '@playwright/test';
 */

/**
 * The blog with the URL of its live site, where a post is published under `/blog/`.
 */
const CONFIG = {
  ...BASE_CONFIG,
  site_url: 'https://www.example.com',
  collections: [{ ...BASE_CONFIG.collections[0], preview_path: 'blog/{{slug}}' }],
};

test.use({ config: CONFIG });

test.beforeEach(async ({ cms, page }) => {
  // Never reach the live site
  await page
    .context()
    .route('https://*.example.com/**', (route) =>
      route.fulfill({ contentType: 'text/html', body: '<title>Live site</title>' }),
    );

  await cms.open();
  await cms.seed({ 'content/posts/first-post.md': '---\ntitle: First Post\n---\n\nHello!\n' });
  await cms.signIn();
});

/**
 * Get the button that opens the account menu.
 * @param {Page} page Page.
 * @returns {Locator} Button.
 */
const getAccountButton = (page) => page.getByRole('button', { name: 'Show Account Menu' });

test('opens the page of an entry on the live site', async ({ cms, page }) => {
  await page.getByRole('row', { name: /First Post/ }).click();

  const editor = getEditor(page);
  const button = editor.getByRole('button', { name: 'View on Live Site' });

  expect(await getOpenedURL(page, () => button.click())).toBe(
    'https://www.example.com/blog/first-post',
  );
  // The content options have it too
  await cms.openPopup(
    editor.getByRole('button', { name: 'Show Content Options' }),
    page.getByRole('menu', { name: 'Content Options' }),
  );
  expect(
    await getOpenedURL(page, () =>
      page.getByRole('menuitem', { name: 'View on Live Site' }).click(),
    ),
  ).toBe('https://www.example.com/blog/first-post');
});

test('offers no live page for an entry that hasn’t been saved yet', async ({ page }) => {
  await page.getByRole('button', { name: 'Create New Entry' }).first().click();

  const editor = getEditor(page);

  await expect(editor.getByRole('textbox', { name: 'Title' })).toBeVisible();
  await expect(editor.getByRole('button', { name: 'View on Live Site' })).toHaveCount(0);
});

test('opens the live site from the account menu', async ({ cms, page }) => {
  await cms.openPopup(getAccountButton(page), page.getByRole('menu', { name: 'Account' }));

  expect(
    await getOpenedURL(page, () => page.getByRole('menuitem', { name: 'Live Site' }).click()),
  ).toBe('https://www.example.com/');
});

test.describe('with `display_url`', () => {
  test.use({
    config: {
      ...CONFIG,
      display_url: 'https://home.example.com/welcome',
      logo: { src: '/images/acme-logo.svg' },
    },
  });

  test('links the site from the UI with it, and entries with `site_url`', async ({ cms, page }) => {
    await cms.openPopup(getAccountButton(page), page.getByRole('menu', { name: 'Account' }));
    expect(
      await getOpenedURL(page, () => page.getByRole('menuitem', { name: 'Live Site' }).click()),
    ).toBe('https://home.example.com/welcome');
    // So does the logo in the header
    expect(
      await getOpenedURL(page, () => page.getByRole('button', { name: 'Visit Live Site' }).click()),
    ).toBe('https://home.example.com/welcome');

    // An entry’s page is still on the site at `site_url`
    await page.getByRole('row', { name: /First Post/ }).click();

    const editor = getEditor(page);

    expect(
      await getOpenedURL(page, () =>
        editor.getByRole('button', { name: 'View on Live Site' }).click(),
      ),
    ).toBe('https://www.example.com/blog/first-post');
  });
});

test.describe('with `show_preview_links: false`', () => {
  test.use({ config: { ...CONFIG, show_preview_links: false } });

  test('offers no live page for an entry, but still the site', async ({ cms, page }) => {
    // The option is about entries: the account menu still links the site
    await cms.openPopup(getAccountButton(page), page.getByRole('menu', { name: 'Account' }));
    expect(
      await getOpenedURL(page, () => page.getByRole('menuitem', { name: 'Live Site' }).click()),
    ).toBe('https://www.example.com/');

    await page.getByRole('row', { name: /First Post/ }).click();

    const editor = getEditor(page);

    await expect(editor.getByRole('textbox', { name: 'Title' })).toHaveValue('First Post');
    await expect(editor.getByRole('button', { name: 'View on Live Site' })).toHaveCount(0);
    // Nor in the content options
    await cms.openPopup(
      editor.getByRole('button', { name: 'Show Content Options' }),
      page.getByRole('menu', { name: 'Content Options' }),
    );
    await expect(page.getByRole('menuitem', { name: 'View on Live Site' })).toHaveCount(0);
  });
});
