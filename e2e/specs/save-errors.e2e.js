import { expect, GITHUB_CONFIG, GITLAB_CONFIG, test } from '../fixtures/test.js';

/**
 * @import { Locator, Page, Route } from '@playwright/test';
 */

const POST_PATH = 'content/posts/first-post.md';
const FIRST_POST = '---\ntitle: First Post\n---\n\nHello, world!\n';
const SAVED_POST = '---\ntitle: First Post\n---\n\nHello from Mona!\n';

/**
 * Open the first post in the entry editor and change its body.
 * @param {Page} page Page.
 * @returns {Promise<Locator>} Editor.
 */
const editFirstPost = async (page) => {
  const editor = page.getByRole('group', { name: 'Content Editor' });
  const body = editor.getByRole('textbox', { name: 'Body' });

  await page.getByRole('row', { name: /First Post/ }).click();
  await expect(body).toHaveValue('Hello, world!');
  await body.fill('Hello from Mona!');

  return editor;
};

/**
 * Make the requests matching the given URL and test fail, answering each with the given handler,
 * until the returned `recover()` is called. Any other request goes on to the mock.
 * @param {Page} page Page.
 * @param {string} url URL to route.
 * @param {(route: Route) => boolean} isCommit Whether the request is a commit.
 * @param {(route: Route) => Promise<void>} fail Handler for a commit request.
 * @returns {Promise<{ attempts: () => number, recover: () => void }>} Number of commits answered
 * with the handler, and a function to let the commits through again.
 */
const failCommits = async (page, url, isCommit, fail) => {
  let attempts = 0;
  let failing = true;

  await page.route(url, async (route) => {
    if (failing && isCommit(route)) {
      attempts += 1;
      await fail(route);
    } else {
      await route.fallback();
    }
  });

  return {
    /**
     * Count the commits answered with the handler so far.
     * @returns {number} Number of failed attempts.
     */
    attempts: () => attempts,
    /**
     * Let the commits through to the mock from now on, as the service is back.
     */
    recover: () => {
      failing = false;
    },
  };
};

/**
 * Make the `createCommitOnBranch` mutations the CMS sends to GitHub fail. The page route takes
 * precedence over the mock’s context route, so a failed commit never reaches the mock.
 * @param {Page} page Page.
 * @param {(route: Route) => Promise<void>} fail Handler for a commit request.
 * @returns {Promise<{ attempts: () => number, recover: () => void }>} See {@link failCommits}.
 */
const failGitHubCommits = (page, fail) =>
  failCommits(
    page,
    'https://api.github.com/graphql',
    (route) => !!route.request().postData()?.includes('createCommitOnBranch'),
    fail,
  );

/**
 * Check that saving has failed with the error dialog, then close it and check that the editor is
 * still open with the user’s change.
 * @param {Page} page Page.
 * @param {Locator} editor Editor.
 * @param {string} [message] Message from the service shown below the description, if any.
 * Without one, only the description is expected.
 */
const expectSaveError = async (page, editor, message) => {
  const dialog = page.getByRole('alertdialog', { name: 'Error' });

  await expect(dialog).toContainText(
    'There was an error while saving the entry. Please try again later.',
  );

  if (message) {
    await expect(dialog).toContainText(message);
  } else {
    // Not the key of the error, which was shown in place of a missing message
    await expect(dialog).not.toContainText('saving_failed');
  }

  await dialog.getByRole('button', { name: 'OK' }).click();
  await expect(dialog).toBeHidden();
  await expect(editor.getByRole('textbox', { name: 'Body' })).toHaveValue('Hello from Mona!');
};

test.describe('on GitHub', () => {
  test.use({ config: GITHUB_CONFIG });

  test.beforeEach(async ({ github }) => {
    github.commit({ [POST_PATH]: FIRST_POST });
  });

  test('keeps the changes when the commit fails with a server error, and saves them later', async ({
    cms,
    github,
    page,
  }) => {
    await cms.open();

    const editor = await editFirstPost(page);

    // A gateway’s error page, without a JSON body to take a message from
    const { attempts, recover } = await failGitHubCommits(page, (route) =>
      route.fulfill({ status: 500, contentType: 'text/html', body: '<h1>Server Error</h1>' }),
    );

    await editor.getByRole('button', { name: 'Save' }).click();
    await expectSaveError(page, editor);
    expect(attempts()).toBe(1);
    expect(github.received).toHaveLength(0);
    expect(github.readFile(POST_PATH)).toBe(FIRST_POST);

    // The service is back
    recover();
    await editor.getByRole('button', { name: 'Save' }).click();
    await expect.poll(() => github.readFile(POST_PATH)).toBe(SAVED_POST);
    await expect(editor).toBeHidden();
    expect(github.received).toHaveLength(1);
  });

  test('keeps the changes when the connection drops during the commit, and saves them later', async ({
    cms,
    github,
    page,
  }) => {
    await cms.open();

    const editor = await editFirstPost(page);
    const { attempts, recover } = await failGitHubCommits(page, (route) => route.abort('failed'));

    await editor.getByRole('button', { name: 'Save' }).click();
    // The browser’s own message for a request that couldn’t be sent
    await expectSaveError(page, editor, 'Failed to fetch');
    expect(attempts()).toBe(1);
    expect(github.received).toHaveLength(0);
    expect(github.readFile(POST_PATH)).toBe(FIRST_POST);

    recover();
    await editor.getByRole('button', { name: 'Save' }).click();
    await expect.poll(() => github.readFile(POST_PATH)).toBe(SAVED_POST);
    await expect(editor).toBeHidden();
    expect(github.received).toHaveLength(1);
  });

  test('retries a commit once after a 502 Bad Gateway, without bothering the user', async ({
    cms,
    github,
    page,
  }) => {
    await cms.open();

    const editor = await editFirstPost(page);

    // GitHub’s GraphQL API occasionally answers 502, which tends to go away when asked again
    const { attempts } = await failGitHubCommits(page, async (route) => {
      if (attempts() === 1) {
        await route.fulfill({ status: 502, json: { message: 'Server Error' } });
      } else {
        await route.fallback();
      }
    });

    await editor.getByRole('button', { name: 'Save' }).click();
    await expect.poll(() => github.readFile(POST_PATH)).toBe(SAVED_POST);
    await expect(editor).toBeHidden();
    await expect(page.getByRole('alertdialog', { name: 'Error' })).toBeHidden();
    expect(attempts()).toBe(2);
    expect(github.received).toHaveLength(1);
  });

  test('reports a 502 Bad Gateway that persists after the retry', async ({ cms, github, page }) => {
    await cms.open();

    const editor = await editFirstPost(page);

    const { attempts, recover } = await failGitHubCommits(page, (route) =>
      route.fulfill({ status: 502, json: { message: 'Server Error' } }),
    );

    await editor.getByRole('button', { name: 'Save' }).click();
    await expectSaveError(page, editor, 'Server Error');
    expect(attempts()).toBe(2);
    expect(github.received).toHaveLength(0);

    recover();
    await editor.getByRole('button', { name: 'Save' }).click();
    await expect.poll(() => github.readFile(POST_PATH)).toBe(SAVED_POST);
  });

  [
    {
      title: 'a GitHub App can’t write to the repository',
      type: 'FORBIDDEN',
      message: 'Resource not accessible by integration',
    },
    {
      title: 'the rate limit is exhausted',
      type: 'RATE_LIMITED',
      message: 'API rate limit exceeded for user ID 1.',
    },
  ].forEach(({ title, type, message }) => {
    test(`shows GitHub’s message when ${title}`, async ({ cms, github, page }) => {
      await cms.open();

      const editor = await editFirstPost(page);

      // GraphQL reports an error with 200 OK
      const { attempts } = await failGitHubCommits(page, (route) =>
        route.fulfill({
          json: { data: { createCommitOnBranch: null }, errors: [{ type, message }] },
        }),
      );

      await editor.getByRole('button', { name: 'Save' }).click();
      await expectSaveError(page, editor, message);
      expect(attempts()).toBe(1);
      expect(github.received).toHaveLength(0);
      expect(github.readFile(POST_PATH)).toBe(FIRST_POST);
    });
  });

  test('shows GitHub’s message for a token revoked while editing (known issue)', async ({
    cms,
    github,
    page,
  }) => {
    await cms.open();

    const editor = await editFirstPost(page);
    // The token stops working, e.g. revoked on GitHub. A GitHub token has no refresh token, so
    // nothing can renew it
    const { token } = github;

    github.token = 'revoked-token';
    await editor.getByRole('button', { name: 'Save' }).click();
    // Known issue: the CMS shows GitHub’s “Bad credentials” under “Please try again later”, though
    // trying again can’t help, and the user stays signed in. Once fixed, the CMS should tell the
    // user to sign in again, keeping the changes to save afterwards
    await expectSaveError(page, editor, 'Bad credentials');
    await expect(page.getByRole('button', { name: 'Show Account Menu' })).toBeVisible();
    expect(github.received).toHaveLength(0);

    // The token works again
    github.token = token;
    await editor.getByRole('button', { name: 'Save' }).click();
    await expect.poll(() => github.readFile(POST_PATH)).toBe(SAVED_POST);
  });
});

test.describe('on GitLab', () => {
  test.use({ config: GITLAB_CONFIG });

  test.beforeEach(async ({ gitlab }) => {
    gitlab.commit({ [POST_PATH]: FIRST_POST });
  });

  test('shows GitLab’s message for a refused commit when the branch hasn’t moved', async ({
    cms,
    gitlab,
    page,
  }) => {
    await cms.open();

    const editor = await editFirstPost(page);
    // GitLab refuses a commit with 400 Bad Request both for a file changed by someone else and for
    // other reasons, like a push rule. The CMS looks up the head to tell them apart
    const message = 'Commit message does not follow the pattern';

    const { attempts, recover } = await failCommits(
      page,
      `${gitlab.apiRoot}/**`,
      (route) =>
        route.request().method() === 'POST' &&
        route.request().url().endsWith('/repository/commits'),
      (route) => route.fulfill({ status: 400, json: { message } }),
    );

    await editor.getByRole('button', { name: 'Save' }).click();
    await expectSaveError(page, editor, message);
    await expect(page.getByText('The repository has been updated by someone else')).toHaveCount(0);
    expect(attempts()).toBe(1);
    expect(gitlab.received).toHaveLength(0);

    recover();
    await editor.getByRole('button', { name: 'Save' }).click();
    await expect.poll(() => gitlab.readFile(POST_PATH)).toBe(SAVED_POST);
    expect(gitlab.received).toHaveLength(1);
  });
});
