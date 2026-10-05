import { expect, GITHUB_CONFIG, test } from '../fixtures/test.js';

/**
 * @import { Locator, Page } from '@playwright/test';
 * @import { CMS } from '../fixtures/test.js';
 */

const FIRST_POST = '---\ntitle: First Post\n---\n\nHello, world!\n';
/**
 * Deploy hook a test sets in the Settings dialog instead of GitHub Actions.
 */
const HOOK_URL = 'https://hooks.example.com/deploy';

test.beforeEach(async ({ github }) => {
  github.commit({ 'content/posts/first-post.md': FIRST_POST });
});

/**
 * Open the first post and change its body, ready to be saved.
 * @param {Page} page Page.
 * @returns {Promise<Locator>} Content editor.
 */
const editFirstPost = async (page) => {
  const editor = page.getByRole('group', { name: 'Content Editor' });

  await page.getByRole('row', { name: /First Post/ }).click();
  await editor.getByRole('textbox', { name: 'Body' }).fill('Hello again!');

  return editor;
};

/**
 * Save the entry with the option in the menu of the split Save button, the opposite of what the
 * button itself does.
 * @param {CMS} cms CMS.
 * @param {Locator} editor Content editor.
 * @param {string} label Label of the menu item.
 */
const saveWithMenuItem = async (cms, editor, label) => {
  await cms.chooseMenuItem(
    editor.getByRole('button', { name: 'More Options' }),
    editor.page().getByRole('menuitem', { name: label }),
  );
};

/**
 * Get the Publish Changes button in the global toolbar.
 * @param {Page} page Page.
 * @returns {Locator} Button.
 */
const getPublishButton = (page) => page.getByRole('button', { name: 'Publish Changes' });

/**
 * Answer the requests to the deploy hook.
 * @param {Page} page Page.
 * @param {object} [options] Options.
 * @param {number} [options.status] HTTP status of the response.
 * @returns {Promise<(string | undefined)[]>} Authorization header of each `POST` request the hook
 * gets, filled in as they come.
 */
const routeDeployHook = async (page, { status = 200 } = {}) => {
  /** @type {(string | undefined)[]} */
  const requests = [];

  await page.route(HOOK_URL, (route) => {
    const request = route.request();

    // The authorization header makes it a CORS request, which asks for permission first
    if (request.method() === 'OPTIONS') {
      return route.fulfill({
        headers: {
          'access-control-allow-origin': '*',
          'access-control-allow-headers': 'authorization',
          'access-control-allow-methods': 'POST',
        },
      });
    }

    requests.push(request.headers().authorization);

    return route.fulfill({ status, headers: { 'access-control-allow-origin': '*' }, json: {} });
  });

  return requests;
};

/**
 * Set the deploy hook in the Advanced panel of the Settings dialog.
 * @param {CMS} cms CMS.
 * @param {Page} page Page.
 * @param {object} hook Hook.
 * @param {string} hook.url URL.
 * @param {string} hook.auth Authorization header.
 */
const setDeployHook = async (cms, page, { url, auth }) => {
  const settings = page.getByRole('dialog', { name: 'Settings' });
  const authInput = settings.getByRole('textbox', { name: /^Authorization header/ });

  await cms.chooseMenuItem(
    page.getByRole('button', { name: 'Show Account Menu' }),
    page.getByRole('menuitem', { name: 'Settings' }),
  );
  await settings.getByRole('tab', { name: 'Advanced' }).click();
  await settings.getByRole('textbox', { name: 'Hook URL' }).fill(url);
  await authInput.fill(auth);
  // The settings are stored when the input loses the focus
  await authInput.blur();
  await settings.getByRole('button', { name: 'Close' }).click();
  await expect(settings).toBeHidden();
};

test.describe('with automatic deployments off', () => {
  test.use({
    config: {
      ...GITHUB_CONFIG,
      backend: { ...GITHUB_CONFIG.backend, automatic_deployments: false },
    },
  });

  test('saves without deploying, then deploys with Publish Changes', async ({
    cms,
    github,
    page,
  }) => {
    await cms.open();

    // The site is up to date with the last commit
    await expect(getPublishButton(page)).toBeDisabled();

    const editor = await editFirstPost(page);

    await editor.getByRole('button', { name: 'Save', exact: true }).click();

    await expect(page.getByRole('status').filter({ hasText: 'Entry saved.' })).toBeVisible();
    await expect
      .poll(() => github.readFile('content/posts/first-post.md'))
      .toBe('---\ntitle: First Post\n---\n\nHello again!\n');
    // The CI is told to skip the commit
    expect(github.received[0].message.headline).toBe('[skip ci] Update Post “first-post”');

    // So the site is out of date until it’s deployed by hand
    await expect(getPublishButton(page)).toBeEnabled();
    await getPublishButton(page).click();

    await expect(page.getByRole('status').filter({ hasText: 'Publishing Changes…' })).toBeVisible();
    // The toast is shown as soon as the button is clicked, before the request is sent
    await expect.poll(() => github.dispatches).toEqual(['sveltia-cms-publish']);
    await expect(getPublishButton(page)).toBeDisabled();
  });

  test('deploys right away with Save and Publish', async ({ cms, github, page }) => {
    await cms.open();

    const editor = await editFirstPost(page);

    await saveWithMenuItem(cms, editor, 'Save and Publish');

    await expect(
      page.getByRole('status').filter({ hasText: 'Entry saved and published.' }),
    ).toBeVisible();
    await expect.poll(() => github.received.length).toBe(1);
    expect(github.received[0].message.headline).toBe('Update Post “first-post”');
    await expect(getPublishButton(page)).toBeDisabled();
    expect(github.dispatches).toEqual([]);
  });

  test('calls the deploy hook set in the settings instead of GitHub Actions', async ({
    cms,
    github,
    page,
  }) => {
    const hookRequests = await routeDeployHook(page);

    await cms.open();
    await setDeployHook(cms, page, { url: HOOK_URL, auth: 'Bearer e2e' });

    const editor = await editFirstPost(page);

    await editor.getByRole('button', { name: 'Save', exact: true }).click();
    await getPublishButton(page).click();

    await expect.poll(() => hookRequests).toEqual(['Bearer e2e']);
    await expect(getPublishButton(page)).toBeDisabled();
    expect(github.dispatches).toEqual([]);
  });

  test('keeps Publish Changes available when the deploy hook fails', async ({ cms, page }) => {
    await routeDeployHook(page, { status: 500 });
    await cms.open();
    // Without an authorization header, the hook is called in the `no-cors` mode, whose response
    // can’t be read, so only a hook called with one can be found to have failed
    await setDeployHook(cms, page, { url: HOOK_URL, auth: 'Bearer e2e' });

    const editor = await editFirstPost(page);

    await editor.getByRole('button', { name: 'Save', exact: true }).click();
    await getPublishButton(page).click();

    await expect(
      page.getByRole('alert').filter({ hasText: 'Couldn’t publish changes. Please try again.' }),
    ).toBeVisible();
    await expect(getPublishButton(page)).toBeEnabled();
  });
});

test.describe('with automatic deployments on', () => {
  test.use({
    config: {
      ...GITHUB_CONFIG,
      backend: { ...GITHUB_CONFIG.backend, automatic_deployments: true },
    },
  });

  test('deploys on saving, unless saved without publishing', async ({ cms, github, page }) => {
    await cms.open();

    const editor = await editFirstPost(page);

    // Saving deploys the site, which the button says
    await expect(editor.getByRole('button', { name: 'Publish', exact: true })).toBeEnabled();
    await saveWithMenuItem(cms, editor, 'Save without Publishing');

    await expect(page.getByRole('status').filter({ hasText: 'Entry saved.' })).toBeVisible();
    await expect.poll(() => github.received.length).toBe(1);
    expect(github.received[0].message.headline).toBe('[skip ci] Update Post “first-post”');
    await expect(getPublishButton(page)).toBeEnabled();
  });
});

test.describe('without the deployment options', () => {
  test.use({ config: GITHUB_CONFIG });

  test('hides Publish Changes', async ({ cms, page }) => {
    await cms.open();

    await expect(page.getByRole('row', { name: /First Post/ })).toBeVisible();
    await expect(getPublishButton(page)).toBeHidden();
  });
});
