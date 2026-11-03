import { openEntryPullRequest, WORKFLOW_CONFIG } from '../../fixtures/configs/workflow.js';
import { expect, test } from '../../fixtures/test.js';
import { openEntry } from '../../fixtures/ui.js';

/**
 * @import { Locator, Page } from '@playwright/test';
 */

/**
 * Blog on Editorial Workflow whose posts refer to an author, who can be edited on the fly from a
 * post, the changes going into the post’s pull request.
 * @see https://github.com/sveltia/sveltia-cms/issues/1129
 */
const CONFIG = {
  ...WORKFLOW_CONFIG,
  collections: [
    {
      name: 'posts',
      label: 'Posts',
      label_singular: 'Post',
      folder: 'content/posts',
      create: true,
      fields: [
        { name: 'title', label: 'Title' },
        {
          name: 'author',
          label: 'Author',
          widget: 'relation',
          collection: 'authors',
          value_field: '{{slug}}',
          search_fields: ['name'],
          display_fields: ['name'],
        },
      ],
    },
    {
      name: 'authors',
      label: 'Authors',
      label_singular: 'Author',
      folder: 'content/authors',
      create: true,
      identifier_field: 'name',
      fields: [
        { name: 'name', label: 'Name' },
        { name: 'bio', label: 'Bio', required: false },
      ],
    },
  ],
};

test.use({ config: CONFIG });

/**
 * Create the content of a post.
 * @param {string} title Title.
 * @returns {string} File content.
 */
const post = (title) => `---\ntitle: ${title}\nauthor: ada\n---\n`;
/**
 * Create the content of an author.
 * @param {string} bio Biography.
 * @returns {string} File content.
 */
const author = (bio) => `---\nname: Ada\nbio: ${bio}\n---\n`;

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

test.beforeEach(({ github }) => {
  github.commit({
    'content/posts/hello.md': post('Hello'),
    'content/authors/ada.md': author('Mathematician'),
  });
});

test('edits an author from a post in the post’s pull request', async ({ cms, github, page }) => {
  const { oid: mainBefore } = github.head;

  await cms.open();

  const editor = await openEntry(page, 'Hello', { collection: 'Posts' });

  await editor.getByRole('textbox', { name: 'Title' }).fill('Hello World');
  await editor.getByRole('button', { name: /Edit.*Ada/ }).click();

  const dialog = page.getByRole('dialog', { name: /Editing.*Author/ });

  await dialog.getByRole('textbox', { name: 'Bio' }).fill('Mathematician and writer');
  await dialog.getByRole('button', { name: 'Update' }).click();
  await expect(dialog).toBeHidden();

  await editor.getByRole('button', { name: 'Save' }).click();
  await page
    .getByRole('alertdialog', { name: 'Send for Review' })
    .getByRole('button', { name: 'Later' })
    .click();

  // Both go into the post’s pull request, and nothing is published yet
  await expect
    .poll(() => github.readFile('content/authors/ada.md', 'cms/posts/hello'))
    .toBe(author('Mathematician and writer'));
  expect(github.readFile('content/posts/hello.md', 'cms/posts/hello')).toBe(post('Hello World'));
  expect(github.readFile('content/authors/ada.md')).toBe(author('Mathematician'));
  expect(github.pullRequests).toHaveLength(1);
  expect(github.head.oid).toBe(mainBefore);

  // The author is listed on the post’s card rather than on a card of its own
  const board = await openBoard(page);

  await expect(board.getByRole('listitem')).toHaveCount(1);
  await expect(getCard(board, 'Hello World')).toContainText(/Also changes \W*Author\W*: \W*Ada/);
});

test('reviews and publishes an author’s changes along with the post', async ({
  cms,
  github,
  page,
}) => {
  const pullRequest = openEntryPullRequest(github, {
    slug: 'hello',
    files: {
      'content/posts/hello.md': post('Hello World'),
      'content/authors/ada.md': author('Mathematician and writer'),
    },
    status: 'pending_publish',
  });

  await cms.open();

  // The author shows a notice while the changes wait in the post’s pull request
  await openEntry(page, 'Ada', { collection: 'Authors', checkTitle: false });
  await expect(
    page.getByRole('alert').filter({ hasText: 'waiting to be published' }),
  ).toContainText(/Hello World/);
  await page.getByRole('button', { name: 'Cancel Editing' }).click();

  // The post’s field edits the author as the pull request has it
  const editor = await openEntry(page, 'Hello World', { collection: 'Posts' });

  await editor.getByRole('button', { name: /Edit.*Ada/ }).click();

  const dialog = page.getByRole('dialog', { name: /Editing.*Author/ });

  await expect(dialog.getByRole('textbox', { name: 'Bio' })).toHaveValue(
    'Mathematician and writer',
  );
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(dialog).toBeHidden();
  await page.getByRole('button', { name: 'Cancel Editing' }).click();

  const board = await openBoard(page);
  const card = getCard(board, 'Hello World');

  await expect(card).toContainText(/Also changes \W*Author\W*: \W*Ada/);
  await card.getByRole('button', { name: 'Publish Entry' }).click();
  await page
    .getByRole('alertdialog', { name: 'Publish Entry' })
    .getByRole('button', { name: 'Publish' })
    .click();

  // The merge check lets the author through, as the card lists it
  await expect.poll(() => pullRequest.state).toBe('merged');
  expect(github.readFile('content/authors/ada.md')).toBe(author('Mathematician and writer'));
});

test('edits a new author an earlier save put in the post’s pull request', async ({
  cms,
  github,
  page,
}) => {
  /**
   * Create the content of the new author.
   * @param {string} bio Biography.
   * @returns {string} File content.
   */
  const grace = (bio) => `---\nname: Grace\nbio: ${bio}\n---\n`;

  openEntryPullRequest(github, {
    slug: 'hello',
    files: {
      'content/posts/hello.md': '---\ntitle: Hello World\nauthor: grace\n---\n',
      'content/authors/grace.md': grace('Admiral'),
    },
  });

  await cms.open();

  const editor = await openEntry(page, 'Hello World', { collection: 'Posts' });

  await editor.getByRole('button', { name: /Edit.*Grace/ }).click();

  const dialog = page.getByRole('dialog', { name: /Editing.*Author/ });

  await expect(dialog.getByRole('textbox', { name: 'Bio' })).toHaveValue('Admiral');
  await dialog.getByRole('textbox', { name: 'Bio' }).fill('Computer scientist');
  await dialog.getByRole('button', { name: 'Update' }).click();
  await expect(dialog).toBeHidden();
  await editor.getByRole('button', { name: 'Save' }).click();
  await page
    .getByRole('alertdialog', { name: 'Send for Review' })
    .getByRole('button', { name: 'Later' })
    .click();

  // It’s saved to the pull request again, and still listed as a new entry
  await expect
    .poll(() => github.readFile('content/authors/grace.md', 'cms/posts/hello'))
    .toBe(grace('Computer scientist'));
  expect(github.readFile('content/authors/grace.md')).toBeUndefined();

  const board = await openBoard(page);

  await expect(getCard(board, 'Hello World')).toContainText(/Also adds \W*Author\W*: \W*Grace/);
});
