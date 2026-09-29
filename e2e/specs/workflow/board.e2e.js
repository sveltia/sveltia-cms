import { openEntryPullRequest, post, WORKFLOW_CONFIG } from '../../fixtures/configs/workflow.js';
import { expect, test } from '../../fixtures/test.js';

/**
 * @import { Locator, Page } from '@playwright/test';
 */

test.use({ config: WORKFLOW_CONFIG });

test.beforeEach(async ({ github }) => {
  github.commit({ 'content/posts/first-post.md': post('First Post', 'Hello, world!') });
});

/**
 * Open the Editorial Workflow page.
 * @param {Page} page Page.
 * @returns {Promise<Locator>} Board.
 */
const openBoard = async (page) => {
  await page.getByRole('radio', { name: 'Editorial Workflow' }).click();

  return page.getByRole('group', { name: 'Editorial Workflow' });
};

/**
 * Get the card of an entry on the board.
 * @param {Locator} board Board.
 * @param {string} title Entry title.
 * @returns {Locator} Card.
 */
const getCard = (board, title) =>
  board.getByRole('listitem').filter({ has: board.page().getByRole('button', { name: title }) });

test('moves an entry to another stage by dragging its card', async ({ cms, github, page }) => {
  const pullRequest = openEntryPullRequest(github, {
    slug: 'second-post',
    files: { 'content/posts/second-post.md': post('Second Post', 'Coming soon.') },
  });

  await cms.open();

  const board = await openBoard(page);
  const inReview = board.getByRole('list', { name: 'In Review' });

  await getCard(board, 'Second Post').dragTo(inReview);

  await expect(getCard(inReview, 'Second Post')).toBeVisible();
  await expect
    .poll(() => ({ labels: pullRequest.labels, draft: pullRequest.draft }))
    .toEqual({ labels: ['sveltia-cms/pending_review'], draft: false });

  await getCard(board, 'Second Post').dragTo(board.getByRole('list', { name: 'Ready' }));

  await expect.poll(() => pullRequest.labels).toEqual(['sveltia-cms/pending_publish']);
});

test('publishes an entry from its card', async ({ cms, github, page }) => {
  const pullRequest = openEntryPullRequest(github, {
    slug: 'second-post',
    files: { 'content/posts/second-post.md': post('Second Post', 'Coming soon.') },
    status: 'pending_publish',
  });

  await cms.open();

  const board = await openBoard(page);

  // Only the last stage can be published
  await expect(
    getCard(board, 'Second Post').getByRole('button', { name: 'Publish Entry' }),
  ).toBeVisible();
  await getCard(board, 'Second Post').getByRole('button', { name: 'Publish Entry' }).click();
  await page
    .getByRole('alertdialog', { name: 'Publish Entry' })
    .getByRole('button', { name: 'Publish' })
    .click();

  await expect.poll(() => pullRequest.state).toBe('merged');
  expect(github.readFile('content/posts/second-post.md')).toBe(post('Second Post', 'Coming soon.'));
  await expect.poll(() => github.refs.has('cms/posts/second-post')).toBe(false);
});

test('offers to publish only the entries that are ready', async ({ cms, github, page }) => {
  openEntryPullRequest(github, {
    slug: 'second-post',
    files: { 'content/posts/second-post.md': post('Second Post', 'Coming soon.') },
    status: 'pending_review',
  });

  await cms.open();

  const board = await openBoard(page);

  await expect(getCard(board, 'Second Post')).toBeVisible();
  await expect(
    getCard(board, 'Second Post').getByRole('button', { name: 'Publish Entry' }),
  ).toHaveCount(0);
});

test('discards the changes to a published entry from its card', async ({ cms, github, page }) => {
  const pullRequest = openEntryPullRequest(github, {
    slug: 'first-post',
    files: { 'content/posts/first-post.md': post('First Post', 'Hello again!') },
  });

  await cms.open();

  const board = await openBoard(page);

  await getCard(board, 'First Post').getByRole('button', { name: 'Discard Changes' }).click();
  await page
    .getByRole('alertdialog', { name: 'Discard Changes' })
    .getByRole('button', { name: 'Discard' })
    .click();

  await expect.poll(() => pullRequest.state).toBe('closed');
  expect(github.refs.has('cms/posts/first-post')).toBe(false);
  expect(github.readFile('content/posts/first-post.md')).toBe(post('First Post', 'Hello, world!'));
  await expect(getCard(board, 'First Post')).toHaveCount(0);
});

test('deletes an unpublished entry from its card', async ({ cms, github, page }) => {
  const pullRequest = openEntryPullRequest(github, {
    slug: 'second-post',
    files: { 'content/posts/second-post.md': post('Second Post', 'Coming soon.') },
  });

  await cms.open();

  const board = await openBoard(page);

  await getCard(board, 'Second Post').getByRole('button', { name: 'Delete Entry' }).click();
  await page
    .getByRole('alertdialog', { name: 'Delete Entry' })
    .getByRole('button', { name: 'Delete' })
    .click();

  await expect.poll(() => pullRequest.state).toBe('closed');
  expect(github.refs.has('cms/posts/second-post')).toBe(false);
  expect(github.readFile('content/posts/second-post.md')).toBeUndefined();
  await expect(getCard(board, 'Second Post')).toHaveCount(0);
});

test('opens an entry from its card', async ({ cms, github, page }) => {
  openEntryPullRequest(github, {
    slug: 'second-post',
    files: { 'content/posts/second-post.md': post('Second Post', 'Coming soon.') },
  });

  await cms.open();

  const board = await openBoard(page);

  await board.getByRole('button', { name: 'Second Post' }).click();

  const editor = page.getByRole('group', { name: 'Content Editor' });

  await expect(editor.getByRole('textbox', { name: 'Title' })).toHaveValue('Second Post');
  await expect(editor.getByRole('textbox', { name: 'Body' })).toHaveValue('Coming soon.');
  await expect(page.getByRole('button', { name: /Status: .*Draft/ })).toBeVisible();
});
