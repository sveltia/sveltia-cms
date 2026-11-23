import {
  expect,
  GITEA_CONFIG,
  GITHUB_CONFIG,
  GITLAB_CONFIG,
  PROXY_COOKIE,
  recordCookies,
  test,
} from '../fixtures/test.js';
import { openFirstPost } from '../fixtures/ui.js';

/**
 * @import { Locator, Page } from '@playwright/test';
 * @import { MockGitRepository } from '../fixtures/git.js';
 * @import { MockGitHub } from '../fixtures/github.js';
 * @import { MockGitLab } from '../fixtures/gitlab.js';
 */

const POST_PATH = 'content/posts/first-post.md';
const FIRST_POST = '---\ntitle: First Post\n---\n\nHello, world!\n';

/**
 * Open the History panel of the first post and get the URL its first commit opens.
 * @param {Page} page Page.
 * @param {string} hostPattern Glob of the hosting site, to answer the page it opens.
 * @returns {Promise<string>} URL.
 */
const getCommitURL = async (page, hostPattern) => {
  await openFirstPost(page);
  await page
    .getByRole('radiogroup', { name: 'Sidebar Panels' })
    .getByRole('radio', { name: 'History' })
    .click();
  await page.context().route(hostPattern, (route) => route.fulfill({ body: '' }));

  const [popup] = await Promise.all([
    page.waitForEvent('popup'),
    page.getByRole('group', { name: 'History', exact: true }).getByRole('link').first().click(),
  ]);

  const url = popup.url();

  await popup.close();

  return url;
};

/**
 * Save a change to the first post and check that it reaches the mock.
 * @param {Page} page Page.
 * @param {MockGitRepository} mock Mocked repository.
 */
const saveChange = async (page, mock) => {
  const editor = await openFirstPost(page);

  await editor.getByRole('textbox', { name: 'Body' }).fill('Hello from home!');
  await editor.getByRole('button', { name: 'Save' }).click();

  await expect
    .poll(() => mock.readFile(POST_PATH))
    .toBe('---\ntitle: First Post\n---\n\nHello from home!\n');
};

/**
 * Record the URLs of the requests the browser context sends.
 * @param {Page} page Page.
 * @returns {string[]} URLs, filled in as they come.
 */
const recordRequests = (page) => {
  /** @type {string[]} */
  const urls = [];

  page.context().on('request', (request) => urls.push(request.url()));

  return urls;
};

/**
 * Record the cookies each request to the REST and GraphQL APIs of an instance carries, once it has
 * a session cookie. See {@link recordCookies}.
 * @param {Page} page Page.
 * @param {MockGitHub | MockGitLab} mock Mocked repository.
 * @returns {Promise<() => Promise<(string | undefined)[]>>} Function returning the `Cookie` header
 * of each request sent so far.
 */
const recordAPICookies = (page, mock) =>
  recordCookies(page, {
    hostname: new URL(mock.apiRoot).hostname,
    /**
     * Tell whether a request goes to the REST or GraphQL API of the instance.
     * @param {URL} url Request URL.
     * @returns {boolean} Result.
     */
    filter: ({ href, origin, pathname }) =>
      href.startsWith(`${mock.apiRoot}/`) || `${origin}${pathname}` === mock.graphqlURL,
  });

test.describe('GitHub Enterprise Server', () => {
  // The REST and GraphQL roots are worked out from the host
  test.use({
    config: {
      ...GITHUB_CONFIG,
      backend: { ...GITHUB_CONFIG.backend, api_root: 'https://github.example.com' },
    },
  });

  test.beforeEach(({ github }) => {
    Object.assign(github, {
      apiRoot: 'https://github.example.com/api/v3',
      graphqlURL: 'https://github.example.com/api/graphql',
    });
    github.commit({ [POST_PATH]: FIRST_POST });
  });

  test('loads and saves an entry through the instance’s API', async ({ cms, github, page }) => {
    // The status of github.com says nothing about the instance, so it isn’t checked
    github.statusIndicator = 'major';

    const urls = recordRequests(page);

    await cms.open();
    await saveChange(page, github);

    expect(urls.filter((url) => url.includes('githubstatus.com'))).toEqual([]);
    expect(urls.filter((url) => url.startsWith('https://api.github.com'))).toEqual([]);
    await expect(page.getByRole('alert').filter({ hasText: /is experiencing/ })).toHaveCount(0);
  });

  test('links a commit to the instance', async ({ cms, github, page }) => {
    await cms.open();

    expect(await getCommitURL(page, 'https://github.example.com/sveltia/**')).toBe(
      `https://github.example.com/sveltia/e2e-site/commit/${github.head.oid}`,
    );
  });
});

/**
 * Configuration of a self-managed GitLab instance.
 */
const SELF_MANAGED_GITLAB_CONFIG = {
  ...GITLAB_CONFIG,
  backend: { ...GITLAB_CONFIG.backend, api_root: 'https://gitlab.example.com/api/v4' },
};

test.describe('self-managed GitLab', () => {
  test.use({ config: SELF_MANAGED_GITLAB_CONFIG });

  test.beforeEach(({ gitlab }) => {
    Object.assign(gitlab, {
      apiRoot: 'https://gitlab.example.com/api/v4',
      graphqlURL: 'https://gitlab.example.com/api/graphql',
    });
    gitlab.commit({ [POST_PATH]: FIRST_POST });
  });

  test('reads the files in smaller batches, and saves through the instance’s API', async ({
    cms,
    gitlab,
    page,
  }) => {
    gitlab.commit(
      Object.fromEntries(
        Array.from({ length: 30 }, (_, index) => [
          `content/posts/post-${index}.md`,
          `---\ntitle: Post ${index}\n---\n`,
        ]),
      ),
    );

    /** @type {number[]} */
    const batchSizes = [];

    page.context().on('request', (request) => {
      if (request.url() === gitlab.graphqlURL && request.postData()?.includes('rawTextBlob')) {
        batchSizes.push(request.postDataJSON().variables.paths.length);
      }
    });

    const urls = recordRequests(page);

    await cms.open();
    // The list only renders the rows in view, but the collection counts them all
    await expect(page.getByRole('status').filter({ hasText: /Posts/ })).toContainText(
      'which has 31 entries',
    );

    // A self-managed instance runs on less powerful hardware than GitLab.com, so the CMS asks for
    // at most 20 files at a time instead of 100
    expect(batchSizes.sort((a, b) => b - a)).toEqual([20, 11]);
    // Nor is the status of GitLab.com checked
    expect(urls.filter((url) => url.includes('hostedstatus.com'))).toEqual([]);
    await saveChange(page, gitlab);
  });

  test('links a commit to the instance', async ({ cms, gitlab, page }) => {
    await cms.open();

    expect(await getCommitURL(page, 'https://gitlab.example.com/sveltia/**')).toBe(
      `https://gitlab.example.com/sveltia/e2e-site/-/commit/${gitlab.head.oid}`,
    );
  });

  test('leaves the instance’s cookies out of the API requests', async ({ cms, gitlab, page }) => {
    const readCookies = await recordAPICookies(page, gitlab);

    await cms.open();
    await expect(page.getByRole('row', { name: /First Post/ })).toBeVisible();

    const cookies = await readCookies();

    expect(cookies.length).toBeGreaterThan(0);
    expect(cookies.filter(Boolean)).toEqual([]);
  });

  // For an instance behind a proxy that authenticates with a cookie
  test.describe('with `include_credentials`', () => {
    test.use({
      config: {
        ...SELF_MANAGED_GITLAB_CONFIG,
        backend: { ...SELF_MANAGED_GITLAB_CONFIG.backend, include_credentials: true },
      },
    });

    test('sends the instance’s cookies with every API request', async ({ cms, gitlab, page }) => {
      const readCookies = await recordAPICookies(page, gitlab);

      await cms.open();
      await expect(page.getByRole('row', { name: /First Post/ })).toBeVisible();
      await saveChange(page, gitlab);

      const cookies = await readCookies();

      expect(cookies.length).toBeGreaterThan(0);
      expect(new Set(cookies)).toEqual(new Set([PROXY_COOKIE]));
    });
  });
});

// A GraphQL endpoint of its own, e.g. a proxy, instead of the one worked out from `api_root`
test.describe('with `graphql_api_root`', () => {
  test.describe('on GitHub', () => {
    test.use({
      config: {
        ...GITHUB_CONFIG,
        backend: {
          ...GITHUB_CONFIG.backend,
          graphql_api_root: 'https://proxy.example.com/github/graphql',
        },
      },
    });

    test('sends the GraphQL queries there, and the rest to the REST API', async ({
      cms,
      github,
      page,
    }) => {
      github.graphqlURL = 'https://proxy.example.com/github/graphql';
      github.commit({ [POST_PATH]: FIRST_POST });

      const urls = recordRequests(page);

      await cms.open();
      await saveChange(page, github);

      expect(urls).toContain(github.graphqlURL);
      expect(urls.filter((url) => url.startsWith('https://api.github.com/graphql'))).toEqual([]);
      expect(urls.some((url) => url.startsWith('https://api.github.com/repos/'))).toBe(true);
    });
  });

  test.describe('on GitLab', () => {
    test.use({
      config: {
        ...GITLAB_CONFIG,
        backend: {
          ...GITLAB_CONFIG.backend,
          graphql_api_root: 'https://proxy.example.com/gitlab/api/graphql',
        },
      },
    });

    test('sends the GraphQL queries there, and the rest to the REST API', async ({
      cms,
      gitlab,
      page,
    }) => {
      gitlab.graphqlURL = 'https://proxy.example.com/gitlab/api/graphql';
      gitlab.commit({ [POST_PATH]: FIRST_POST });

      const urls = recordRequests(page);

      await cms.open();
      await saveChange(page, gitlab);

      expect(urls).toContain(gitlab.graphqlURL);
      expect(urls.filter((url) => url.startsWith('https://gitlab.com/api/graphql'))).toEqual([]);
      expect(urls.some((url) => url.startsWith('https://gitlab.com/api/v4/'))).toBe(true);
    });
  });
});

test.describe('self-hosted Gitea or Forgejo under a subpath', () => {
  test.use({
    config: {
      ...GITEA_CONFIG,
      backend: { ...GITEA_CONFIG.backend, api_root: 'https://code.example.com/git/api/v1' },
    },
  });

  test.beforeEach(({ gitea }) => {
    gitea.apiRoot = 'https://code.example.com/git/api/v1';
    gitea.commit({ [POST_PATH]: FIRST_POST });
  });

  // Both report a bare version above 2, so the CMS asks the Forgejo API, which only Forgejo has,
  // and reads the files with the API of the one it finds
  [
    { name: 'Forgejo', version: '13.0.3', forgejo: true, endpoint: '/git/blobs?' },
    { name: 'Gitea', version: '28.0.0', forgejo: false, endpoint: '/file-contents?' },
  ].forEach(({ name, version, forgejo, endpoint }) => {
    test(`tells ${name} by asking for its version, and reads the files with its API`, async ({
      cms,
      gitea,
      page,
    }) => {
      Object.assign(gitea, { version, forgejo });

      const urls = recordRequests(page);

      await cms.open();
      await expect(page.getByRole('row', { name: /First Post/ })).toBeVisible();

      expect(urls).toContain('https://code.example.com/git/api/forgejo/v1/version');
      expect(urls.some((url) => url.includes(endpoint))).toBe(true);
      await saveChange(page, gitea);
    });
  });

  test('links a commit to the instance, under its subpath', async ({ cms, gitea, page }) => {
    await cms.open();

    expect(await getCommitURL(page, 'https://code.example.com/git/sveltia/**')).toBe(
      `https://code.example.com/git/sveltia/e2e-site/commit/${gitea.head.oid}`,
    );
  });
});
