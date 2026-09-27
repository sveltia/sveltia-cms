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
