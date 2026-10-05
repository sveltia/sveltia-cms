import QRCode from 'qrcode';

import { expect, GITHUB_CONFIG, serveSite, test } from '../../fixtures/test.js';

import { getBottomNavigation, PHONE } from './helpers.js';

/**
 * @import { Browser, BrowserContext, Page } from '@playwright/test';
 * @import { MockGitHub } from '../../fixtures/github.js';
 */

/**
 * Origin of the site. The CMS only offers to sign in on a phone off localhost, which a phone can’t
 * reach.
 */
const SITE_ORIGIN = 'https://cms.example.com';

test.use({ config: GITHUB_CONFIG, siteOrigin: SITE_ORIGIN });

/**
 * The phones’ browser contexts opened by the current test, closed after it, even when it fails.
 * @type {BrowserContext[]}
 */
const phoneContexts = [];

test.afterEach(async () => {
  await Promise.all(phoneContexts.splice(0).map((context) => context.close()));
});

test.beforeEach(({ github }) => {
  github.commit({ 'content/posts/first-post.md': '---\ntitle: First Post\n---\n' });
});

/**
 * Read the QR code drawn on a canvas as a matrix of dark modules, assuming the way the `qrcode`
 * package draws one by default: four light modules around it, and four pixels to a module.
 * @param {Page} page Page.
 * @returns {Promise<boolean[]>} Whether each module is dark, row by row.
 */
const readQRModules = (page) =>
  page.locator('dialog:not([inert]) canvas').evaluate((/** @type {HTMLCanvasElement} */ canvas) => {
    const scale = 4;
    const margin = 4;
    const size = canvas.width / scale - margin * 2;

    const { data } = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d')).getImageData(
      0,
      0,
      canvas.width,
      canvas.height,
    );

    return Array.from({ length: size * size }, (_, index) => {
      // The centre of the module
      const x = (margin + (index % size)) * scale + scale / 2;
      const y = (margin + Math.floor(index / size)) * scale + scale / 2;

      return data[(y * canvas.width + x) * 4] < 128;
    });
  });

/**
 * Open the CMS on a phone: another browser context, which shares nothing with the desktop one but
 * the mocked repository.
 * @param {object} args Arguments.
 * @param {Browser} args.browser Browser.
 * @param {MockGitHub} args.github GitHub mock.
 * @param {string} args.baseURL URL of the test server.
 * @returns {Promise<Page>} Page.
 */
const openPhone = async ({ browser, github, baseURL }) => {
  const context = await browser.newContext({ ...PHONE, baseURL });
  const page = await context.newPage();

  phoneContexts.push(context);
  // Serve the site, like the `cms` fixture does for the desktop
  await serveSite(context, { config: GITHUB_CONFIG, siteOrigin: SITE_ORIGIN, baseURL });
  await github.install(page, { signedIn: false });

  return page;
};

/**
 * Show the QR code to sign in on a phone, from the account menu, and check it encodes the link
 * the CMS is expected to make: the page URL with the user’s token and preferences.
 * @param {Page} page Page.
 * @param {MockGitHub} github GitHub mock.
 * @returns {Promise<string>} Link.
 */
const getSignInLink = async (page, github) => {
  await page.getByRole('button', { name: 'Show Account Menu' }).click();
  await page.getByRole('menuitem', { name: 'Sign In with Mobile' }).click();

  const dialog = page.getByRole('dialog', { name: 'Sign In with Mobile' });

  await expect(dialog).toContainText('Scan the QR code below with your phone or tablet');

  // The preferences are kept in the local storage as the CMS has them
  const prefs = JSON.parse(
    /** @type {string} */ (await page.evaluate(() => localStorage.getItem('sveltia-cms.prefs'))),
  );

  const data = Buffer.from(JSON.stringify({ token: github.token, prefs })).toString('base64');
  const link = `${SITE_ORIGIN}/admin/#/signin/${data}`;
  const { modules } = QRCode.create(link);

  await expect
    .poll(() => readQRModules(page))
    .toEqual([...modules.data].map((module) => module === 1));

  return link;
};

test('signs in on a phone with the QR code, copying the settings', async ({
  baseURL,
  browser,
  cms,
  github,
  page,
}) => {
  await cms.open();
  await expect(page.getByRole('row', { name: /First Post/ })).toBeVisible();

  // Pick a theme on the desktop, which the phone takes on
  await cms.chooseMenuItem(
    page.getByRole('button', { name: 'Show Account Menu' }),
    page.getByRole('menuitem', { name: 'Settings' }),
  );
  await page
    .getByRole('dialog', { name: 'Settings' })
    .getByRole('radiogroup', { name: 'Select Theme' })
    .getByRole('radio', { name: 'Dark' })
    .click();
  await page
    .getByRole('dialog', { name: 'Settings' })
    .getByRole('button', { name: 'Close' })
    .click();

  const link = await getSignInLink(page, github);
  const phone = await openPhone({ browser, github, baseURL: /** @type {string} */ (baseURL) });

  await phone.goto(link);

  // The phone asks before signing in with someone else’s session
  const confirmation = phone.getByRole('alertdialog', { name: 'Sign In with Link' });

  await expect(confirmation).toContainText(/signs you in as .*mona.* on .*GitHub/);
  await confirmation.getByRole('button', { name: 'Sign In' }).click();

  // A phone starts on the collection list, where the post is counted
  await expect(getBottomNavigation(phone)).toBeVisible();
  await expect(phone.getByRole('treeitem', { name: 'Posts' })).toHaveText(/Posts\s*1/);
  expect(await phone.evaluate(() => document.documentElement.dataset.theme)).toBe('dark');
  // The token is taken out of the URL
  expect(phone.url()).not.toContain('/signin/');
});

test('leaves the phone signed out when the link is declined', async ({
  baseURL,
  browser,
  cms,
  github,
  page,
}) => {
  await cms.open();
  await expect(page.getByRole('row', { name: /First Post/ })).toBeVisible();

  const link = await getSignInLink(page, github);
  const phone = await openPhone({ browser, github, baseURL: /** @type {string} */ (baseURL) });

  await phone.goto(link);
  await phone
    .getByRole('alertdialog', { name: 'Sign In with Link' })
    .getByRole('button', { name: 'Cancel' })
    .click();

  await expect(phone.getByRole('button', { name: /^Sign In with .*GitHub/ })).toBeVisible();
  expect(phone.url()).not.toContain('/signin/');
});

test('ignores a link whose token isn’t valid', async ({ baseURL, browser, github }) => {
  const phone = await openPhone({ browser, github, baseURL: /** @type {string} */ (baseURL) });

  const data = Buffer.from(JSON.stringify({ token: 'expired-token', prefs: {} })).toString(
    'base64',
  );

  await phone.goto(`${SITE_ORIGIN}/admin/#/signin/${data}`);

  // There is no one to sign in as, so nothing is asked
  await expect(phone.getByRole('button', { name: /^Sign In with .*GitHub/ })).toBeVisible();
  await expect(phone.getByRole('alertdialog', { name: 'Sign In with Link' })).toHaveCount(0);
});
