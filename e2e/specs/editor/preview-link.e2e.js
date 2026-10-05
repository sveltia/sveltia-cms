import { BASE_CONFIG, expect, test } from '../../fixtures/test.js';

/**
 * @import { Page } from '@playwright/test';
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
    .route('https://www.example.com/**', (route) =>
      route.fulfill({ contentType: 'text/html', body: '<title>Live site</title>' }),
    );

  await cms.open();
  await cms.seed({ 'content/posts/first-post.md': '---\ntitle: First Post\n---\n\nHello!\n' });
  await cms.signIn();
});

/**
 * Click a control and get the URL of the tab it opens.
 * @param {Page} page Page.
 * @param {() => Promise<void>} click Function clicking the control.
 * @returns {Promise<string>} URL.
 */
const getOpenedURL = async (page, click) => {
  const [popup] = await Promise.all([page.waitForEvent('popup'), click()]);

  await popup.waitForLoadState();

  const url = popup.url();

  await popup.close();

  return url;
};

test('opens the page of an entry on the live site', async ({ page }) => {
  await page.getByRole('row', { name: /First Post/ }).click();

  const editor = page.getByRole('group', { name: 'Content Editor' });
  const button = editor.getByRole('button', { name: 'View on Live Site' });

  expect(await getOpenedURL(page, () => button.click())).toBe(
    'https://www.example.com/blog/first-post',
  );
});

test('offers no live page for an entry that hasn’t been saved yet', async ({ page }) => {
  await page.getByRole('button', { name: 'Create New Entry' }).first().click();

  const editor = page.getByRole('group', { name: 'Content Editor' });

  await expect(editor.getByRole('textbox', { name: 'Title' })).toBeVisible();
  await expect(editor.getByRole('button', { name: 'View on Live Site' })).toHaveCount(0);
});
