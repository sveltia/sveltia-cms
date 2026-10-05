import { createHash } from 'crypto';

import { expect, GITEA_CONFIG, GITHUB_CONFIG, GITLAB_CONFIG, test } from '../fixtures/test.js';

/**
 * @import { Page } from '@playwright/test';
 * @import { MockGitRepository } from '../fixtures/git.js';
 */

const FIRST_POST = { 'content/posts/first-post.md': '---\ntitle: First Post\n---\n\nHello!\n' };
/**
 * URL of the authenticator the GitHub and GitLab backends sign in through by default: Netlify’s,
 * or a Sveltia CMS Authenticator set with `base_url`, which works the same way.
 */
const AUTHENTICATOR_URL = 'https://api.netlify.com/auth';

// Every test here starts signed out
test.use({ signedIn: false });

/**
 * Answer the authenticator’s page, which the CMS opens in a popup. Like the real one once the user
 * has authorized the app, it tells the CMS it’s there, then posts the result when the CMS answers.
 * @param {Page} page Page.
 * @param {object} result What the authenticator posts.
 * @param {'success' | 'error' | 'close'} result.state `success` to post a token, `error` to post
 * an error, or `close` for the user to close the popup without signing in.
 * @param {Record<string, any>} [result.content] Token or error.
 * @returns {Promise<URLSearchParams[]>} Query parameters of each popup opened so far.
 */
const mockAuthenticator = async (page, { state, content = {} }) => {
  /** @type {URLSearchParams[]} */
  const requests = [];

  await page.context().route(`${AUTHENTICATOR_URL}?*`, (route) => {
    requests.push(new URL(route.request().url()).searchParams);

    return route.fulfill({
      contentType: 'text/html',
      body: `<!doctype html><script>
        const { state, content } = ${JSON.stringify({ state, content })};
        const provider = new URLSearchParams(location.search).get('provider');

        if (state === 'close') {
          window.close();
        } else {
          window.addEventListener('message', ({ data, origin }) => {
            if (data === 'authorizing:' + provider) {
              window.opener.postMessage(
                'authorization:' + provider + ':' + state + ':' + JSON.stringify(content),
                origin,
              );
            }
          });
          window.opener.postMessage('authorizing:' + provider, '*');
        }
      </script>`,
    });
  });

  return requests;
};

/**
 * Answer an OAuth provider’s authorization page and token endpoint, for the PKCE flow the CMS runs
 * on its own in a popup. The authorization page sends the popup straight back to the CMS with a
 * code, as it does once the user has authorized the app, and the token endpoint exchanges the code
 * for the mock’s access token, checking the code verifier against the challenge sent before.
 * @param {Page} page Page.
 * @param {object} args Arguments.
 * @param {string} args.authorizeURL URL of the authorization page.
 * @param {string} args.tokenURL URL of the token endpoint.
 * @param {MockGitRepository} args.mock Mocked repository, whose token is handed out.
 * @param {string} [args.state] State to send back instead of the one the CMS sent, as a forged
 * redirect would.
 * @returns {Promise<{ authorize: URLSearchParams[], token: Record<string, any>[] }>} Requests
 * received so far.
 */
const mockOAuthProvider = async (page, { authorizeURL, tokenURL, mock, state }) => {
  /** @type {{ authorize: URLSearchParams[], token: Record<string, any>[] }} */
  const requests = { authorize: [], token: [] };
  const context = page.context();

  await context.route(`${authorizeURL}?*`, (route) => {
    const params = new URL(route.request().url()).searchParams;
    const redirectURL = new URL(/** @type {string} */ (params.get('redirect_uri')));

    requests.authorize.push(params);
    redirectURL.search = new URLSearchParams({
      code: 'e2e-code',
      state: state ?? /** @type {string} */ (params.get('state')),
    }).toString();

    return route.fulfill({ status: 302, headers: { location: redirectURL.href } });
  });

  await context.route(tokenURL, (route) => {
    const body = route.request().postDataJSON();
    const challenge = requests.authorize.at(-1)?.get('code_challenge');

    const verified =
      createHash('sha256').update(body.code_verifier).digest('base64url') === challenge;

    requests.token.push(body);

    return route.fulfill({
      json:
        body.code === 'e2e-code' && verified
          ? { access_token: mock.token, refresh_token: 'e2e-refresh-token', token_type: 'bearer' }
          : { error: 'invalid_grant' },
    });
  });

  return requests;
};

/**
 * Sign in with an access token, entered in the dialog the sign-in page offers.
 * @param {Page} page Page.
 * @param {string} token Token.
 */
const signInWithToken = async (page, token) => {
  await page.getByRole('button', { name: 'Sign In Using Access Token' }).click();

  const dialog = page.getByRole('alertdialog', { name: 'Sign In Using Access Token' });

  await dialog.getByRole('textbox', { name: 'Personal Access Token' }).fill(token);
  await dialog.getByRole('button', { name: 'Sign In' }).click();
};

test.describe('GitHub', () => {
  test.use({ config: GITHUB_CONFIG });

  test.beforeEach(({ github }) => {
    github.commit(FIRST_POST);
  });

  test('signs in through the authenticator in a popup', async ({ cms, github, page }) => {
    const requests = await mockAuthenticator(page, {
      state: 'success',
      content: { provider: 'github', token: github.token },
    });

    await cms.open();
    await page.getByRole('button', { name: /^Sign In with .*GitHub/ }).click();

    await expect(page.getByRole('row', { name: /First Post/ })).toBeVisible();
    expect(requests).toHaveLength(1);
    expect(Object.fromEntries(requests[0])).toEqual({
      provider: 'github',
      site_id: '127.0.0.1',
      scope: 'repo,user',
    });

    // The session is kept
    await page.reload();
    await expect(page.getByRole('row', { name: /First Post/ })).toBeVisible();
  });

  test('says why the authenticator refused to sign in', async ({ cms, page }) => {
    await mockAuthenticator(page, {
      state: 'error',
      content: { provider: 'github', error: 'Domain not allowed', errorCode: 'UNSUPPORTED_DOMAIN' },
    });

    await cms.open();
    await page.getByRole('button', { name: /^Sign In with .*GitHub/ }).click();

    await expect(
      page.getByText('Your domain is not allowed to use the authenticator.'),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Show Account Menu' })).toHaveCount(0);
  });

  test('says sign-in was aborted when the popup is closed', async ({ cms, page }) => {
    await mockAuthenticator(page, { state: 'close' });

    await cms.open();
    await page.getByRole('button', { name: /^Sign In with .*GitHub/ }).click();

    await expect(page.getByText('Authentication aborted. Please try again.')).toBeVisible();
  });

  test('signs in with an access token', async ({ cms, github, page }) => {
    await cms.open();
    await signInWithToken(page, github.token);

    await expect(page.getByRole('row', { name: /First Post/ })).toBeVisible();
  });

  test('refuses an invalid access token', async ({ cms, page }) => {
    await cms.open();
    await signInWithToken(page, 'not-the-token');

    await expect(
      page.getByText('The provided token is invalid. Please check and try again.'),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Show Account Menu' })).toHaveCount(0);
  });
});

test.describe('GitLab', () => {
  test.use({ config: GITLAB_CONFIG });

  test.beforeEach(({ gitlab }) => {
    gitlab.commit(FIRST_POST);
  });

  test('signs in through the authenticator in a popup', async ({ cms, gitlab, page }) => {
    const requests = await mockAuthenticator(page, {
      state: 'success',
      content: { provider: 'gitlab', token: gitlab.token },
    });

    await cms.open();
    await page.getByRole('button', { name: /^Sign In with .*GitLab/ }).click();

    await expect(page.getByRole('row', { name: /First Post/ })).toBeVisible();
    expect(requests[0].get('provider')).toBe('gitlab');
  });

  test('signs in with an access token', async ({ cms, gitlab, page }) => {
    await cms.open();
    await signInWithToken(page, gitlab.token);

    await expect(page.getByRole('row', { name: /First Post/ })).toBeVisible();
  });
});

test.describe('GitLab with PKCE', () => {
  test.use({
    config: {
      ...GITLAB_CONFIG,
      backend: { ...GITLAB_CONFIG.backend, auth_type: 'pkce', app_id: 'e2e-client' },
    },
  });

  test.beforeEach(({ gitlab }) => {
    gitlab.commit(FIRST_POST);
  });

  test('signs in with an authorization code exchanged in the popup', async ({
    cms,
    gitlab,
    page,
  }) => {
    const requests = await mockOAuthProvider(page, {
      authorizeURL: 'https://gitlab.com/oauth/authorize',
      tokenURL: 'https://gitlab.com/oauth/token',
      mock: gitlab,
    });

    await cms.open();
    await page.getByRole('button', { name: /^Sign In with .*GitLab/ }).click();

    await expect(page.getByRole('row', { name: /First Post/ })).toBeVisible();
    expect(Object.fromEntries(requests.authorize[0])).toMatchObject({
      client_id: 'e2e-client',
      response_type: 'code',
      scope: 'api',
      code_challenge_method: 'S256',
    });
    expect(requests.token).toEqual([
      expect.objectContaining({
        grant_type: 'authorization_code',
        client_id: 'e2e-client',
        code: 'e2e-code',
      }),
    ]);
  });
});

test.describe('Gitea', () => {
  test.use({
    config: { ...GITEA_CONFIG, backend: { ...GITEA_CONFIG.backend, app_id: 'e2e-client' } },
  });

  test.beforeEach(({ gitea }) => {
    gitea.commit(FIRST_POST);
  });

  test('signs in with an authorization code exchanged in the popup', async ({
    cms,
    gitea,
    page,
  }) => {
    const requests = await mockOAuthProvider(page, {
      authorizeURL: 'https://gitea.com/login/oauth/authorize',
      tokenURL: 'https://gitea.com/login/oauth/access_token',
      mock: gitea,
    });

    await cms.open();
    await page.getByRole('button', { name: /^Sign In with .*Gitea/ }).click();

    await expect(page.getByRole('row', { name: /First Post/ })).toBeVisible();
    expect(requests.authorize[0].get('redirect_uri')).toBe(new URL(page.url()).href.split('#')[0]);
    expect(requests.token).toHaveLength(1);
  });

  test('refuses a sign-in that comes back with another state', async ({ cms, gitea, page }) => {
    const requests = await mockOAuthProvider(page, {
      authorizeURL: 'https://gitea.com/login/oauth/authorize',
      tokenURL: 'https://gitea.com/login/oauth/access_token',
      mock: gitea,
      state: 'forged',
    });

    await cms.open();
    await page.getByRole('button', { name: /^Sign In with .*Gitea/ }).click();

    await expect(
      page.getByText('Potential CSRF attack detected. Authentication flow aborted.'),
    ).toBeVisible();
    // The code isn’t exchanged for a token
    expect(requests.token).toEqual([]);
  });

  test('signs in with an access token', async ({ cms, gitea, page }) => {
    await cms.open();
    await signInWithToken(page, gitea.token);

    await expect(page.getByRole('row', { name: /First Post/ })).toBeVisible();
  });
});
