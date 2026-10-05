import { expect, GITHUB_CONFIG, test } from '../../fixtures/test.js';

/**
 * @import { Page } from '@playwright/test';
 */

/**
 * URL of the latest version of the bundle on the CDN, which a site loads to be updated on its own.
 */
const UNPINNED_SCRIPT_URL = 'https://unpkg.com/@sveltia/cms/dist/sveltia-cms.js';

/**
 * Tell the update check that a newer version is out.
 * @param {Page} page Page.
 */
const announceNewVersion = async (page) => {
  await page.route('https://unpkg.com/@sveltia/cms/package.json', (route) =>
    route.fulfill({ json: { version: '99.0.0' } }),
  );
};

/**
 * Read the onboarding state the CMS has stored for the GitHub repository: which one-off notices
 * have been dismissed. It’s written in the background, so wait for it before reloading the page.
 * @param {Page} page Page.
 * @returns {Promise<Record<string, boolean> | undefined>} State keyed by notice name.
 */
const readOnboardingState = (page) =>
  page.evaluate(async () => {
    /** @type {IDBDatabase} */
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('github:sveltia/e2e-site');

      request.addEventListener('success', () => resolve(request.result));
      request.addEventListener('error', () => reject(request.error));
    });

    try {
      if (!db.objectStoreNames.contains('ui-settings')) {
        return undefined;
      }

      return await new Promise((resolve) => {
        const request = db.transaction('ui-settings').objectStore('ui-settings').get('onboarding');

        request.addEventListener('success', () => resolve(request.result));
      });
    } finally {
      db.close();
    }
  });

test.describe('update notification', () => {
  // The dev server is never updated, so it doesn’t check
  test.skip(
    process.env.E2E_TARGET === 'dev',
    'The bundle checks for updates, the dev server doesn’t',
  );

  test.beforeEach(async ({ cms }) => {
    await cms.page.clock.install();
  });

  test('offers to reload a site that loads the latest version from the CDN', async ({
    baseURL,
    cms,
    page,
  }) => {
    // The admin page loads the bundle from the CDN without a version, like many sites do
    await page.route(`${baseURL}/admin/`, (route) =>
      route.fulfill({
        contentType: 'text/html',
        body: `<!doctype html><meta charset="utf-8"><script src="${UNPINNED_SCRIPT_URL}"></script>`,
      }),
    );
    // The bundle, and anything it loads next to it, comes from the local build
    await page.route('https://unpkg.com/@sveltia/cms/dist/**', async (route) => {
      const path = new URL(route.request().url()).pathname.replace('/@sveltia/cms', '');

      await route.fulfill({ response: await route.fetch({ url: `${baseURL}${path}` }) });
    });
    await announceNewVersion(page);
    await cms.open();
    await cms.signIn();

    const infobar = page.getByRole('status').filter({ hasText: 'latest version' });

    // The CDN takes a while to serve the new version everywhere, so the notice waits for it
    await page.clock.fastForward('09:00');
    await expect(infobar).toHaveCount(0);
    await page.clock.fastForward('01:01');
    await expect(infobar).toHaveText(/The latest version of Sveltia CMS is available\./);

    // Reloading loads the new version
    const reloaded = page.waitForEvent('load');

    await infobar.getByRole('button', { name: 'Update Now' }).click();
    await reloaded;
    await expect(page.getByRole('button', { name: 'Show Account Menu' })).toBeVisible();
  });

  test('only logs a newer version for a site that pins its version', async ({ cms, page }) => {
    /** @type {string[]} */
    const warnings = [];

    page.on('console', (message) => {
      if (message.type() === 'warning') {
        warnings.push(message.text());
      }
    });

    await announceNewVersion(page);
    await cms.open();
    await cms.signIn();
    await page.clock.fastForward('10:01');

    // The admin page loads its own copy of the bundle, which has to be updated by hand
    await expect
      .poll(() => warnings)
      .toContainEqual(expect.stringContaining('A new version (99.0.0) is available.'));
    await expect(page.getByRole('status').filter({ hasText: 'latest version' })).toHaveCount(0);
  });
});

test.describe('new language', () => {
  // The browser is set to Japanese, and the user has picked English before Japanese was available
  test.use({ config: GITHUB_CONFIG, locale: 'ja-JP' });

  test.beforeEach(async ({ github, page }) => {
    github.commit({ 'content/posts/first-post.md': '---\ntitle: First Post\n---\n' });
    await page.addInitScript(() => {
      localStorage.setItem('sveltia-cms.prefs', JSON.stringify({ locale: 'en-US' }));
    });
  });

  test('offers the language of the browser in English (known issue)', async ({ cms, page }) => {
    await cms.open();

    // The offer is meant to be written in the language it offers, as the infobar asks for the
    // strings of that locale. But the production bundle only includes the English strings, and
    // only fetches those of another locale once it’s picked, so the offer falls back to English.
    // Once the strings are loaded for the offer, expect “Sveltia CMS が 日本語 に対応しました！”
    // with the buttons “言語を変更” and “後で”
    const infobar = page.getByRole('status').filter({ hasText: 'is now available in' });

    await expect(infobar).toHaveText(/Sveltia CMS is now available in \u2068日本語\u2069!/);
    await expect(infobar.getByRole('button', { name: 'Change Language' })).toBeVisible();
  });

  test('switches to the offered language', async ({ cms, page }) => {
    await cms.open();

    const infobar = page.getByRole('status').filter({ hasText: 'is now available in' });

    await infobar.getByRole('button', { name: 'Change Language' }).click();

    await expect(page.getByRole('button', { name: 'アカウントメニューを表示' })).toBeVisible();
    await expect(infobar).toBeHidden();
  });

  test('doesn’t offer it again once declined', async ({ cms, page }) => {
    await cms.open();

    const infobar = page.getByRole('status').filter({ hasText: 'is now available in' });

    await infobar.getByRole('button', { name: 'Later' }).click();
    await expect(infobar).toBeHidden();
    await expect.poll(() => readOnboardingState(page)).toMatchObject({ newLanguageCta: true });

    await page.reload();
    await expect(page.getByRole('row', { name: /First Post/ })).toBeVisible();
    await expect(infobar).toHaveCount(0);
    // The UI stays in English
    await expect(page.getByRole('button', { name: 'Show Account Menu' })).toBeVisible();
  });
});

test.describe('mobile promotion', () => {
  // The offer to sign in on a phone is only made for a site off localhost, as a phone can’t reach
  // the user’s computer
  test.use({ config: GITHUB_CONFIG, siteOrigin: 'https://cms.example.com' });

  test.beforeEach(({ github }) => {
    github.commit({ 'content/posts/first-post.md': '---\ntitle: First Post\n---\n' });
  });

  test('offers to try the CMS on a phone, until it’s dismissed', async ({ cms, page }) => {
    await cms.open();

    const infobar = page.getByRole('status').filter({ hasText: 'available on mobile' });

    await expect(infobar).toHaveText(/Sveltia CMS is now available on mobile!/);
    await infobar.getByRole('button', { name: 'Give it a try' }).click();

    // The dialog to sign in on a phone opens, and the offer isn’t made again
    await expect(page.getByRole('dialog', { name: /phone|Mobile/i })).toBeVisible();
    await expect(infobar).toBeHidden();
    await expect.poll(() => readOnboardingState(page)).toMatchObject({ mobileCta: true });
    await page.reload();
    await expect(page.getByRole('row', { name: /First Post/ })).toBeVisible();
    await expect(infobar).toHaveCount(0);
  });

  test('isn’t offered on localhost', async ({ cms, page }) => {
    cms.siteOrigin = undefined;
    await cms.open();

    await expect(page.getByRole('row', { name: /First Post/ })).toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: 'available on mobile' })).toHaveCount(
      0,
    );
  });
});
