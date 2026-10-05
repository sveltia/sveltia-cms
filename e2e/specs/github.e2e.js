import { expect, GITHUB_CONFIG, test } from '../fixtures/test.js';

/**
 * @import { Locator, Page } from '@playwright/test';
 */

const FIRST_POST = '---\ntitle: First Post\n---\n\nHello, world!\n';

test.use({ config: GITHUB_CONFIG });

test.beforeEach(async ({ github }) => {
  github.commit({ 'content/posts/first-post.md': FIRST_POST });
});

/**
 * Open the first post in the entry editor.
 * @param {Page} page Page.
 * @returns {Promise<Locator>} Editor.
 */
const openFirstPost = async (page) => {
  const editor = page.getByRole('group', { name: 'Content Editor' });

  await page.getByRole('row', { name: /First Post/ }).click();
  await expect(editor.getByRole('textbox', { name: 'Body' })).toHaveValue('Hello, world!');

  return editor;
};

test('signs in with the stored session and lists the entries', async ({ cms, page }) => {
  await cms.open();
  await expect(page.getByRole('button', { name: 'Show Account Menu' })).toBeVisible();
  await expect(
    page.getByRole('group', { name: 'Entry List' }).getByRole('row', { name: /First Post/ }),
  ).toBeVisible();
});

test('lists the entries of a repository too big to list at once', async ({ cms, github, page }) => {
  github.commit({
    'README.md': '# Site\n',
    'content/posts/second-post.md': '---\ntitle: Second Post\n---\n',
  });
  // GitHub truncates the recursive listing of the file tree, so the folders are listed one by one
  github.truncateTree = true;

  await cms.open();
  await expect(page.getByRole('row', { name: /Second Post/ })).toBeVisible();
  await expect(page.getByRole('row', { name: /First Post/ })).toBeVisible();
});

test.describe('with the commit date as a sortable field', () => {
  test.use({
    config: {
      ...GITHUB_CONFIG,
      collections: [{ ...GITHUB_CONFIG.collections[0], sortable_fields: ['title', 'commit_date'] }],
    },
  });

  test('sorts the entries by their commits, although a file has no commit', async ({
    cms,
    github,
    page,
  }) => {
    github.commit({ 'content/posts/second-post.md': '---\ntitle: Second Post\n---\n' });
    github.commit({ 'content/posts/third-post.md': '---\ntitle: Third Post\n---\n' });
    // The file was deleted after the CMS fetched the file tree, so no commit is found for it
    github.pathsWithoutHistory.add('content/posts/second-post.md');

    await cms.open();
    await expect(page.getByRole('row')).toHaveCount(3);
    // The commit metadata is fetched after the entries are listed
    await cms.chooseMenuItem(
      page.getByRole('button', { name: 'Sort', exact: true }),
      page.getByRole('menuitemradio', { name: /Updated on.*new to old/ }),
    );
    await expect(page.getByRole('row')).toHaveText([/Third Post/, /First Post/, /Second Post/]);
  });
});

test('offers to sort by the commit date and author with the default sortable fields', async ({
  cms,
  github,
  page,
}) => {
  // The collection has no `date` or `author` field, which the default sort keys include
  github.commit({ 'content/posts/second-post.md': '---\ntitle: Second Post\n---\n' });
  github.commit({ 'content/posts/third-post.md': '---\ntitle: Third Post\n---\n' });

  await cms.open();
  await expect(page.getByRole('row')).toHaveCount(3);
  await cms.chooseMenuItem(
    page.getByRole('button', { name: 'Sort', exact: true }),
    page.getByRole('menuitemradio', { name: /Updated on.*new to old/ }),
  );
  await expect(page.getByRole('row')).toHaveText([/Third Post/, /Second Post/, /First Post/]);
  await page.getByRole('button', { name: 'Sort', exact: true }).click();
  await expect(page.getByRole('menuitemradio', { name: /Updated by/ }).first()).toBeVisible();
});

test('tells the user about an incident on GitHub until it’s over', async ({
  cms,
  github,
  page,
}) => {
  github.statusIndicator = 'major';
  await page.clock.install();
  await cms.open();

  const infobar = page.getByRole('alert').filter({ hasText: /is experiencing/ });

  await expect(infobar).toHaveText(
    /GitHub.* is experiencing a major incident\. You may want to wait until the situation has improved\./,
  );

  // The details are on the GitHub status page
  const [popup] = await Promise.all([
    page.waitForEvent('popup'),
    infobar.getByRole('button', { name: 'Details' }).click(),
  ]);

  expect(new URL(popup.url()).hostname).toBe('www.githubstatus.com');
  await popup.close();

  // The status is checked again every 5 minutes
  github.statusIndicator = 'minor';
  await page.clock.fastForward('05:00');
  await expect(infobar).toHaveText(
    /GitHub.* is experiencing a minor incident\. Your workflow may be affected\./,
  );

  github.statusIndicator = 'none';
  await page.clock.fastForward('05:00');
  await expect(infobar).toBeHidden();
});

test('refuses a user who can only read the repository', async ({ cms, github, page }) => {
  github.canWrite = false;

  await cms.open();
  await expect(page.getByRole('alert')).toContainText(
    /You don’t have access to the .*e2e-site.* repository/,
  );
});

test('makes the content read-only when the user can’t push to the branch', async ({
  cms,
  github,
  page,
}) => {
  github.branchRule = { viewerCanPush: false };

  await cms.open();
  await expect(
    page.getByText(/You don’t have permission to push to the .*main.* branch/),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create New Entry' })).toBeDisabled();
});

test('commits a change to the branch', async ({ cms, github, page }) => {
  const { oid: headBefore } = github.head;

  await cms.open();

  const editor = await openFirstPost(page);

  await editor.getByRole('textbox', { name: 'Body' }).fill('Hello from Mona!');
  await editor.getByRole('button', { name: 'Save' }).click();

  await expect
    .poll(() => github.readFile('content/posts/first-post.md'))
    .toBe('---\ntitle: First Post\n---\n\nHello from Mona!\n');
  expect(github.received).toHaveLength(1);
  expect(github.received[0]).toMatchObject({
    expectedHeadOid: headBefore,
    message: { headline: 'Update Post “first-post”' },
  });
  expect(github.head.author.login).toBe(github.user.login);
});

test('lists an entry a colleague has added, on the next scheduled check', async ({
  cms,
  github,
  page,
}) => {
  // The CMS checks the repository for changes every minute
  await page.clock.install();
  await cms.open();
  await expect(page.getByRole('row', { name: /First Post/ })).toBeVisible();

  github.commit({ 'content/posts/second-post.md': '---\ntitle: Second Post\n---\n' });
  await page.clock.fastForward('01:01');

  await expect(page.getByRole('row', { name: /Second Post/ })).toBeVisible();
});

test('fetches a colleague’s change again after failing to fetch it', async ({
  cms,
  github,
  page,
}) => {
  await cms.open();
  await expect(page.getByRole('row', { name: 'First Post' })).toBeVisible();

  const { tree } = github.commit({
    'content/posts/first-post.md': '---\ntitle: Revised Post\n---\n\nHello from Alex!\n',
  });

  const sha = /** @type {string} */ (tree.get('content/posts/first-post.md'));
  let failed = false;

  // The request for the changed file fails once, as the network drops
  await page.route('https://api.github.com/**', async (route) => {
    const request = route.request();

    if (!failed && `${request.url()}${request.postData() ?? ''}`.includes(sha)) {
      failed = true;
      await route.abort('failed');
    } else {
      await route.fallback();
    }
  });
  await page.reload();
  await expect(page.getByText('There was an error while loading site data.')).toBeVisible();

  await page.reload();
  await expect(page.getByRole('row', { name: 'Revised Post' })).toBeVisible();
  await expect(page.getByRole('row', { name: 'First Post' })).toHaveCount(0);
});

test('keeps the entries a colleague has deleted out of the list after reloading', async ({
  cms,
  github,
  page,
}) => {
  await cms.open();
  await expect(page.getByRole('row', { name: 'First Post' })).toBeVisible();

  github.commit({ 'content/posts/first-post.md': null });
  await page.reload();
  await expect(page.getByText('This collection has no entries yet.')).toBeVisible();

  // Reloaded at the same head, the file list is restored from the cache, which must no longer hold
  // the deleted file
  await page.reload();
  await expect(page.getByText('This collection has no entries yet.')).toBeVisible();
  await expect(page.getByRole('row', { name: 'First Post' })).toHaveCount(0);
});

test('reloads an open entry a colleague has changed', async ({ cms, github, page }) => {
  await page.clock.install();
  await cms.open();

  const editor = await openFirstPost(page);

  github.commit({
    'content/posts/first-post.md': '---\ntitle: First Post\n---\n\nHello from Alex!\n',
  });
  // Coming back to the window checks for changes, once some time has passed since the last check
  await page.clock.fastForward('00:11');
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));

  const notice = editor.getByRole('alert');

  await expect(notice).toContainText(/Alex.*changed this entry/);
  await notice.getByRole('button', { name: 'Reload Entry' }).click();
  await expect(editor.getByRole('textbox', { name: 'Body' })).toHaveValue('Hello from Alex!');
});

test('warns before saving over a colleague’s change', async ({ cms, github, page }) => {
  await cms.open();

  const editor = await openFirstPost(page);

  github.commit({
    'content/posts/first-post.md': '---\ntitle: First Post\n---\n\nHello from Alex!\n',
  });
  await editor.getByRole('textbox', { name: 'Body' }).fill('Hello from Mona!');
  await editor.getByRole('button', { name: 'Save' }).click();

  const dialog = page.getByRole('alertdialog', { name: 'Entry Changed by Someone Else' });

  await expect(dialog).toContainText(/Alex.*changed this entry/);
  expect(github.received).toHaveLength(0);
  await dialog.getByRole('button', { name: 'Save Anyway' }).click();

  await expect
    .poll(() => github.readFile('content/posts/first-post.md'))
    .toBe('---\ntitle: First Post\n---\n\nHello from Mona!\n');
});

test('saves again after the branch moved during the commit', async ({ cms, github, page }) => {
  await cms.open();

  const editor = await openFirstPost(page);

  // Someone else commits between the check before saving and the commit itself
  // eslint-disable-next-line jsdoc/require-jsdoc
  github.beforeCommit = () => {
    github.commit({ 'content/posts/second-post.md': '---\ntitle: Second Post\n---\n' });
  };

  await editor.getByRole('textbox', { name: 'Body' }).fill('Hello from Mona!');
  await editor.getByRole('button', { name: 'Save' }).click();

  const dialog = page.getByRole('alertdialog', { name: 'Error' });

  await expect(dialog).toContainText('The repository has been updated by someone else');
  await dialog.getByRole('button', { name: 'OK' }).click();
  await editor.getByRole('button', { name: 'Save' }).click();

  await expect
    .poll(() => github.readFile('content/posts/first-post.md'))
    .toBe('---\ntitle: First Post\n---\n\nHello from Mona!\n');
  // The other change is kept
  expect(github.readFile('content/posts/second-post.md')).toBe('---\ntitle: Second Post\n---\n');
  expect(github.received).toHaveLength(2);
});
