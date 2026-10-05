import { stringify } from 'yaml';

import { BASE_CONFIG, expect, test } from '../../fixtures/test.js';

/**
 * @import { Page } from '@playwright/test';
 */

/**
 * Change the HTML of the admin page, the way a site sets the CMS up. A single route has to make
 * every change, as a later route would fetch the original page again.
 * @param {Page} page Page.
 * @param {(html: string) => string} edit Function that returns the changed HTML.
 */
const editAdminPage = async (page, edit) => {
  await page.route('**/admin/', async (route) => {
    const response = await route.fetch();

    await route.fulfill({ response, body: edit(await response.text()) });
  });
};

/**
 * Add `<link rel="cms-config-url">` elements to the head of the admin page.
 * @param {Page} page Page.
 * @param {{ href: string, type?: string }[]} links Links to the config files, in order.
 */
const addConfigLinks = async (page, links) => {
  const elements = links
    .map(
      ({ href, type }) =>
        `<link href="${href}"${type ? ` type="${type}"` : ''} rel="cms-config-url" />`,
    )
    .join('');

  await editAdminPage(page, (html) => html.replace('</head>', `${elements}</head>`));
};

/**
 * Answer the requests for a config file. The CMS appends a timestamp to the URL to bypass the
 * cache, hence the `?*` in the pattern.
 * @param {Page} page Page.
 * @param {string} path Path of the file, e.g. `/admin/notes.json`.
 * @param {string} body Content of the file.
 * @param {number} [status] HTTP status.
 */
const serveConfigFile = async (page, path, body, status = 200) => {
  await page.route(`**${path}?*`, (route) => route.fulfill({ status, body }));
};

/**
 * The Notes collection, added by another config file.
 */
const NOTES_COLLECTION = {
  name: 'notes',
  label: 'Notes',
  folder: 'content/notes',
  create: true,
  fields: [{ name: 'title', label: 'Title' }],
};

test.describe('config files linked from the admin page', () => {
  // The admin page of the dev server links its own config file
  test.skip(process.env.E2E_TARGET === 'dev', 'The dev server’s admin page can’t be changed');

  test('loads YAML, JSON and TOML files, and merges them in order', async ({ cms, page }) => {
    // `config.yml` is the base config. The JSON file adds a collection and a title, which the TOML
    // file then overrides
    await addConfigLinks(page, [
      { href: '/admin/config.yml', type: 'application/yaml' },
      { href: '/admin/notes.json', type: 'application/json' },
      { href: '/admin/branding.toml', type: 'application/toml' },
    ]);
    await serveConfigFile(
      page,
      '/admin/notes.json',
      JSON.stringify({ app_title: 'Notes Admin', collections: [NOTES_COLLECTION] }),
    );
    await serveConfigFile(page, '/admin/branding.toml', 'app_title = "Acme Admin"\n');
    await cms.open();

    await expect(page.getByRole('heading', { name: 'Acme Admin' })).toBeVisible();
    await cms.signIn();

    // The `collections` arrays are concatenated rather than replaced
    await expect(
      page.getByRole('tree', { name: 'Collection List' }).getByRole('treeitem'),
    ).toHaveText([/Posts/, /Notes/]);
  });

  test('loads only the linked files, as YAML without a `type`', async ({ cms, page }) => {
    /** @type {string[]} */
    const configRequests = [];

    page.on('request', (request) => {
      if (request.url().includes('config.yml')) {
        configRequests.push(request.url());
      }
    });

    // The `.yaml` file is a complete config, and `text/yaml` is the legacy type of YAML
    await addConfigLinks(page, [
      { href: '/cms/site.yaml' },
      { href: '/cms/notes.yaml', type: 'text/yaml' },
    ]);
    await serveConfigFile(page, '/cms/site.yaml', stringify(BASE_CONFIG));
    await serveConfigFile(page, '/cms/notes.yaml', stringify({ collections: [NOTES_COLLECTION] }));
    await cms.open();
    await cms.signIn();

    await expect(
      page.getByRole('tree', { name: 'Collection List' }).getByRole('treeitem'),
    ).toHaveText([/Posts/, /Notes/]);
    // The default `config.yml` next to the admin page isn’t requested
    expect(configRequests).toEqual([]);
  });

  test('shows an error when a linked file is missing', async ({ cms, page }) => {
    /** @type {string[]} */
    const consoleErrors = [];

    page.on('console', (message) => {
      if (message.type() === 'error') {
        consoleErrors.push(message.text());
      }
    });

    await addConfigLinks(page, [{ href: '/admin/config.yml' }, { href: '/admin/missing.yml' }]);
    await serveConfigFile(page, '/admin/missing.yml', 'Not Found', 404);
    await cms.open();

    await expect(page.getByRole('alert')).toContainText(
      'The configuration file could not be retrieved.',
    );
    await expect(page.getByRole('button', { name: 'Work with Test Repository' })).toBeHidden();
    // The cause is logged for the developer
    expect(consoleErrors.join('\n')).toContain('HTTP response returned with status 404.');
  });

  test('shows an error when a linked file can’t be loaded', async ({ cms, page }) => {
    await addConfigLinks(page, [{ href: 'https://cms.example.com/config.yml' }]);
    await page.route('https://cms.example.com/**', (route) => route.abort());
    await cms.open();

    await expect(page.getByRole('alert')).toContainText(
      'The configuration file could not be retrieved.',
    );
    await expect(page.getByRole('button', { name: 'Work with Test Repository' })).toBeHidden();
  });

  test('shows an error when a linked file can’t be parsed', async ({ cms, page }) => {
    await addConfigLinks(page, [
      { href: '/admin/config.yml' },
      { href: '/admin/broken.json', type: 'application/json' },
    ]);
    await serveConfigFile(page, '/admin/broken.json', '{ "app_title": "Acme Admin", }');
    await cms.open();

    await expect(page.getByRole('alert')).toContainText(
      'The configuration file could not be parsed.',
    );
    await expect(page.getByRole('button', { name: 'Work with Test Repository' })).toBeHidden();
  });

  test('shows an error for a file type it can’t parse', async ({ cms, page }) => {
    await addConfigLinks(page, [{ href: '/admin/config.yml', type: 'text/plain' }]);
    await cms.open();

    await expect(page.getByRole('alert')).toContainText(
      'The configuration file could not be parsed.',
    );
    await expect(page.getByRole('button', { name: 'Work with Test Repository' })).toBeHidden();
  });

  test('refuses a file on an insecure URL', async ({ cms, page }) => {
    /** @type {string[]} */
    const requests = [];

    page.on('request', (request) => {
      if (request.url().startsWith('http://cms.example.com/')) {
        requests.push(request.url());
      }
    });

    await addConfigLinks(page, [
      { href: '/admin/config.yml' },
      { href: 'http://cms.example.com/config.yml' },
    ]);
    await cms.open();

    await expect(page.getByRole('alert')).toContainText(
      'The configuration file URLs must use HTTPS protocol or localhost addresses.',
    );
    await expect(page.getByRole('button', { name: 'Work with Test Repository' })).toBeHidden();
    // Not even the file on the secure URL is requested ahead of time
    expect(requests).toEqual([]);
  });
});

test.describe('custom mount element', () => {
  test.skip(process.env.E2E_TARGET === 'dev', 'The dev server’s admin page can’t be changed');

  /**
   * The site’s own header, which the CMS has to leave alone.
   */
  const SITE_HEADER = '<header><a href="/">Acme Site</a></header>';

  test('mounts the CMS on `<div id="nc-root">`, beside the page content', async ({ cms, page }) => {
    await editAdminPage(page, (html) =>
      html.replace('<body>', `<body>${SITE_HEADER}<div id="nc-root"></div>`),
    );
    await cms.open();

    const root = page.locator('#nc-root');

    await expect(root.getByRole('button', { name: 'Work with Test Repository' })).toBeVisible();
    await cms.signIn();
    await expect(root.getByRole('main', { name: /Posts.*Collection/ })).toBeVisible();
    // The page content outside the mount element stays
    await expect(page.getByRole('banner').getByRole('link', { name: 'Acme Site' })).toBeVisible();
    // The app isn’t mounted on `<body>` as well
    await expect(page.getByRole('button', { name: 'Work with Test Repository' })).toHaveCount(0);
    await expect(page.locator('body > :not(header, #nc-root, script)')).toHaveCount(0);
  });

  test('waits for a mount element that comes after the CMS `<script>`', async ({ cms, page }) => {
    // The element isn’t there yet when the CMS script runs, so it waits for the page to load
    await editAdminPage(page, (html) =>
      html.replace('</body>', `${SITE_HEADER}<div id="nc-root"></div></body>`),
    );
    await cms.open();

    await expect(
      page.locator('#nc-root').getByRole('button', { name: 'Work with Test Repository' }),
    ).toBeVisible();
    await cms.signIn();
    await expect(
      page.locator('#nc-root').getByRole('main', { name: /Posts.*Collection/ }),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: 'Acme Site' })).toBeVisible();
  });
});
