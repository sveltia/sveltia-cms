import { BASE_CONFIG, expect, test } from '../../fixtures/test.js';

/**
 * @import { Page } from '@playwright/test';
 */

/**
 * Path of the site’s logo.
 */
const LOGO_PATH = '/images/acme-logo.svg';

/**
 * Serve the site’s logo, a red square.
 * @param {Page} page Page.
 */
const serveLogo = async (page) => {
  await page.route(`**${LOGO_PATH}`, (route) =>
    route.fulfill({
      contentType: 'image/svg+xml',
      body:
        '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64">' +
        '<rect width="64" height="64" fill="red"/></svg>',
    }),
  );
};

test.describe('without branding options', () => {
  test('shows the Sveltia CMS name and logo', async ({ cms, page }) => {
    await cms.open();

    await expect(page.getByRole('heading', { name: 'Sveltia CMS', level: 1 })).toBeVisible();
    await expect(page.getByText(/Powered by/)).toHaveCount(0);
    await expect(page.locator('link[rel="icon"]')).toHaveAttribute(
      'href',
      /^data:image\/svg\+xml;base64,/,
    );
    await cms.signIn();
    await expect(page).toHaveTitle(/ – Sveltia CMS$/);
    // The header only shows a custom logo
    await expect(page.getByRole('button', { name: 'Visit Live Site' })).toHaveCount(0);
  });
});

test.describe('with `app_title`', () => {
  test.use({ config: { ...BASE_CONFIG, app_title: 'Acme Admin' } });

  test('names the app on the sign-in page and in the browser tab', async ({ cms, page }) => {
    await cms.open();

    await expect(page.getByRole('heading', { name: 'Acme Admin', level: 1 })).toBeVisible();
    await expect(page).toHaveTitle('Acme Admin');
    await expect(page.getByRole('status')).toHaveText('Welcome to \u2068Acme Admin\u2069');
    // Sveltia CMS is still credited
    await expect(page.getByText('Powered by \u2068Sveltia CMS\u2069')).toBeVisible();
    await cms.signIn();

    // Each view has its own title, followed by the app name
    await expect(page).toHaveTitle('\u2068Posts\u2069 Collection – Acme Admin');
    await page.getByRole('button', { name: 'Create New Entry' }).first().click();
    await expect(page).toHaveTitle('Creating \u2068Post\u2069 – Acme Admin');
  });
});

test.describe('with `logo`', () => {
  test.use({ config: { ...BASE_CONFIG, app_title: 'Acme Admin', logo: { src: LOGO_PATH } } });

  test('shows the logo on the sign-in page, in the header and as the icon', async ({
    cms,
    page,
  }) => {
    await serveLogo(page);
    await cms.open();

    await expect(page.locator(`img[src="${LOGO_PATH}"]`)).toBeVisible();
    await expect(page.locator('link[rel="icon"]')).toHaveAttribute('href', LOGO_PATH);
    await expect(page.locator('link[rel="icon"]')).toHaveAttribute('type', 'image/svg+xml');
    // The logo is turned into the icon of the installed app
    await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute(
      'href',
      /^data:image\/webp;base64,/,
    );

    const manifestURL = await page.locator('link[rel="manifest"]').getAttribute('href');

    expect(
      await page.evaluate(
        async (url) => (await fetch(/** @type {string} */ (url))).json(),
        manifestURL,
      ),
    ).toMatchObject({
      name: 'Acme Admin',
      short_name: 'Acme Admin',
      icons: [
        { sizes: '192x192', type: 'image/webp' },
        { sizes: '512x512', type: 'image/webp' },
      ],
    });
    await cms.signIn();

    await expect(
      page.getByRole('button', { name: 'Visit Live Site' }).locator(`img[src="${LOGO_PATH}"]`),
    ).toBeVisible();
  });

  test.describe('and `show_in_header: false`', () => {
    test.use({ config: { ...BASE_CONFIG, logo: { src: LOGO_PATH, show_in_header: false } } });

    test('leaves the logo out of the header', async ({ cms, page }) => {
      await serveLogo(page);
      await cms.open();

      await expect(page.locator(`img[src="${LOGO_PATH}"]`)).toBeVisible();
      await cms.signIn();
      await expect(page.getByRole('main', { name: /Posts.*Collection/ })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Visit Live Site' })).toHaveCount(0);
      await expect(page.locator('link[rel="icon"]')).toHaveAttribute('href', LOGO_PATH);
    });
  });
});

test.describe('with the deprecated `logo_url`', () => {
  test.use({ config: { ...BASE_CONFIG, logo_url: LOGO_PATH } });

  test('shows the logo, and logs a deprecation warning', async ({ cms, page }) => {
    /** @type {string[]} */
    const warnings = [];

    page.on('console', (message) => {
      if (message.type() === 'warning') {
        warnings.push(message.text());
      }
    });

    await serveLogo(page);
    await cms.open();

    await expect(page.locator(`img[src="${LOGO_PATH}"]`)).toBeVisible();
    await expect(page.locator('link[rel="icon"]')).toHaveAttribute('href', LOGO_PATH);
    await cms.signIn();
    await expect(
      page.getByRole('button', { name: 'Visit Live Site' }).locator(`img[src="${LOGO_PATH}"]`),
    ).toBeVisible();
    // It still works, but `logo.src` replaces it
    expect(warnings).toContainEqual(
      expect.stringContaining(
        'The `logo_url` option is deprecated and will be removed in a future',
      ),
    );
  });
});
