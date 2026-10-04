import { expect, test } from '../fixtures/test.js';

test.describe('with a valid config', () => {
  test('shows the sign-in screen, then the collection', async ({ cms, page }) => {
    await cms.open();
    await expect(page.getByRole('button', { name: 'Work with Test Repository' })).toBeVisible();
    await cms.signIn();
    await expect(page.getByRole('main', { name: /Posts.*Collection/ })).toBeVisible();
  });
});

test.describe('on a subdomain of localhost', () => {
  test('loads the config over HTTP, as the page is a secure context', async ({
    adminPath,
    baseURL,
    cms,
    page,
  }) => {
    // Chromium resolves any `*.localhost` name to the loopback address. The bundle loads the config
    // from next to the page, on the subdomain too; the dev server always loads it from `127.0.0.1`
    const url = new URL(adminPath, baseURL);

    url.hostname = 'e2e.localhost';
    await page.goto(url.href);
    await expect(page.getByRole('button', { name: 'Work with Test Repository' })).toBeVisible();
    await cms.signIn();
    await expect(page.getByRole('main', { name: /Posts.*Collection/ })).toBeVisible();
  });
});

test.describe('with an invalid config', () => {
  test.use({ config: { backend: { name: 'test-repo' }, media_folder: 'static/images' } });

  test('shows the config error', async ({ cms, page }) => {
    await cms.open();
    await expect(page.getByText('Collections are not defined.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Work with Test Repository' })).toBeHidden();
  });
});
