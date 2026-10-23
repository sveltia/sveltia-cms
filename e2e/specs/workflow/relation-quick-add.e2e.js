import { openEntryPullRequest, WORKFLOW_CONFIG } from '../../fixtures/configs/workflow.js';
import { expect, test } from '../../fixtures/test.js';
import { getEditor, openEntry } from '../../fixtures/ui.js';

/**
 * @import { Locator, Page } from '@playwright/test';
 */

/**
 * Help centre on Editorial Workflow, whose articles belong to a section, which can be added on the
 * fly from an article.
 * @see https://github.com/sveltia/sveltia-cms/issues/1112
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
          name: 'section',
          label: 'Section',
          widget: 'relation',
          collection: 'sections',
          value_field: '{{slug}}',
          search_fields: ['title'],
          display_fields: ['title'],
        },
      ],
    },
    {
      name: 'sections',
      label: 'Sections',
      label_singular: 'Section',
      folder: 'content/sections',
      create: true,
      fields: [{ name: 'title', label: 'Title' }],
    },
  ],
};

test.use({ config: CONFIG });

/**
 * Create the content of a post.
 * @param {string} title Title.
 * @param {string} section Slug of the section.
 * @returns {string} File content.
 */
const post = (title, section) => `---\ntitle: ${title}\nsection: ${section}\n---\n`;
/**
 * Create the content of a section.
 * @param {string} title Title.
 * @returns {string} File content.
 */
const section = (title) => `---\ntitle: ${title}\n---\n`;

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

test('adds a section from a post to the post’s pull request', async ({ cms, github, page }) => {
  const { oid: mainBefore } = github.head;

  await cms.open();
  await page.getByRole('button', { name: 'Create New Entry' }).first().click();

  const editor = getEditor(page);

  await editor.getByRole('textbox', { name: 'Title' }).fill('Hello');
  await editor.getByRole('button', { name: /Add.*Section/ }).click();

  const dialog = page.getByRole('dialog', { name: /Creating.*Section/ });

  await dialog.getByRole('textbox', { name: 'Title' }).fill('Guides');
  await dialog.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(dialog).toBeHidden();
  // With few options, the field is a group of radio buttons
  await expect(
    editor.getByRole('radiogroup', { name: 'Section' }).getByRole('radio', { name: 'Guides' }),
  ).toBeChecked();

  await editor.getByRole('button', { name: 'Save' }).click();
  await page
    .getByRole('alertdialog', { name: 'Send for Review' })
    .getByRole('button', { name: 'Later' })
    .click();

  // Both go into the post’s pull request, and nothing is published yet
  await expect
    .poll(() => github.readFile('content/sections/guides.md', 'cms/posts/hello'))
    .toBe(section('Guides'));
  expect(github.readFile('content/posts/hello.md', 'cms/posts/hello')).toBe(
    post('Hello', 'guides'),
  );
  expect(github.pullRequests).toHaveLength(1);
  expect(github.head.oid).toBe(mainBefore);

  // The section is listed on the post’s card rather than on a card of its own
  const board = await openBoard(page);

  await expect(board.getByRole('listitem')).toHaveCount(1);
  await expect(getCard(board, 'Hello')).toContainText(/Also adds \W*Section\W*: \W*Guides/);
});

test('reviews and publishes a section along with the post it was added from', async ({
  cms,
  github,
  page,
}) => {
  const pullRequest = openEntryPullRequest(github, {
    slug: 'hello',
    files: {
      'content/posts/hello.md': post('Hello', 'guides'),
      'content/sections/guides.md': section('Guides'),
    },
    status: 'pending_publish',
  });

  await cms.open();

  // The post refers to the section by its title, although it’s only in the pull request
  await openEntry(page, 'Hello', { collection: 'Posts' });
  await expect(
    getEditor(page)
      .getByRole('radiogroup', { name: 'Section' })
      .getByRole('radio', { name: 'Guides' }),
  ).toBeChecked();
  await page.getByRole('button', { name: 'Cancel Editing' }).click();

  const board = await openBoard(page);
  const card = getCard(board, 'Hello');

  await expect(card).toContainText(/Also adds \W*Section\W*: \W*Guides/);
  await card.getByRole('button', { name: 'Publish Entry' }).click();
  await page
    .getByRole('alertdialog', { name: 'Publish Entry' })
    .getByRole('button', { name: 'Publish' })
    .click();

  // The merge check lets the section through, as the card lists it
  await expect.poll(() => pullRequest.state).toBe('merged');
  expect(github.readFile('content/sections/guides.md')).toBe(section('Guides'));

  // The section has joined the collection
  await page.getByRole('radio', { name: 'Contents' }).click();
  await openEntry(page, 'Guides', { collection: 'Sections' });
});
