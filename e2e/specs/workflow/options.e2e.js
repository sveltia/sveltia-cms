import { openEntryPullRequest, post, WORKFLOW_CONFIG } from '../../fixtures/configs/workflow.js';
import { expect, GITHUB_CONFIG, test } from '../../fixtures/test.js';

/**
 * @import { Locator, Page } from '@playwright/test';
 */

test.beforeEach(async ({ github }) => {
  github.commit({ 'content/posts/first-post.md': post('First Post', 'Hello, world!') });
});

/**
 * Open an entry in the editor.
 * @param {Page} page Page.
 * @param {string} title Entry title.
 * @returns {Promise<Locator>} Editor.
 */
const openEntry = async (page, title) => {
  const editor = page.getByRole('group', { name: 'Content Editor' });

  await page.getByRole('row', { name: new RegExp(`^${title}`) }).click();
  await expect(editor.getByRole('textbox', { name: 'Title' })).toHaveValue(title);

  return editor;
};

/**
 * Create an entry in the collection shown and save it, leaving it a draft if the collection uses
 * Editorial Workflow.
 * @param {Page} page Page.
 * @param {object} args Arguments.
 * @param {string} args.title Title.
 * @param {string} args.body Body.
 * @param {boolean} [args.workflow] Whether the collection uses Editorial Workflow, which asks
 * whether to send the entry for review once it’s saved.
 */
const createEntry = async (page, { title, body, workflow = true }) => {
  await page.getByRole('button', { name: 'Create New Entry' }).first().click();

  const editor = page.getByRole('group', { name: 'Content Editor' });

  await editor.getByRole('textbox', { name: 'Title' }).fill(title);
  await editor.getByRole('textbox', { name: 'Body' }).fill(body);
  await editor.getByRole('button', { name: 'Save' }).click();

  if (workflow) {
    await page
      .getByRole('alertdialog', { name: 'Send for Review' })
      .getByRole('button', { name: 'Later' })
      .click();
  }
};

test.describe('with `cms_label_prefix`', () => {
  test.use({
    config: {
      ...WORKFLOW_CONFIG,
      backend: { ...WORKFLOW_CONFIG.backend, cms_label_prefix: 'site-cms/' },
    },
  });

  test('labels a pull request with the prefix', async ({ cms, github, page }) => {
    await cms.open();
    await createEntry(page, { title: 'Second Post', body: 'Coming soon.' });

    await expect
      .poll(() => github.pullRequests)
      .toMatchObject([{ head: 'cms/posts/second-post', labels: ['site-cms/draft'] }]);
  });

  test('still reads a pull request labelled with the default prefix', async ({
    cms,
    github,
    page,
  }) => {
    const pullRequest = openEntryPullRequest(github, {
      slug: 'second-post',
      files: { 'content/posts/second-post.md': post('Second Post', 'Coming soon.') },
      status: 'pending_review',
    });

    await cms.open();
    await openEntry(page, 'Second Post');
    await cms.chooseMenuItem(
      page.getByRole('button', { name: /Status: .*In Review/ }),
      page.getByRole('menuitemradio', { name: 'Ready' }),
    );

    // The old label is replaced rather than kept alongside the new one
    await expect.poll(() => pullRequest.labels).toEqual(['site-cms/pending_publish']);
  });
});

test.describe('with a pull request from Decap CMS', () => {
  test.use({ config: WORKFLOW_CONFIG });

  test('lists the entry and relabels it when its status changes', async ({ cms, github, page }) => {
    const pullRequest = openEntryPullRequest(github, {
      slug: 'second-post',
      files: { 'content/posts/second-post.md': post('Second Post', 'Coming soon.') },
      status: 'pending_review',
    });

    pullRequest.labels = ['decap-cms/pending_review'];

    await cms.open();
    await expect(page.getByRole('grid', { name: 'Entries' }).getByRole('row')).toHaveText([
      /Unpublished Entries/,
      /Second Post.*In Review/,
      /Published Entries/,
      /First Post/,
    ]);
    await openEntry(page, 'Second Post');
    await cms.chooseMenuItem(
      page.getByRole('button', { name: /Status: .*In Review/ }),
      page.getByRole('menuitemradio', { name: 'Ready' }),
    );

    await expect.poll(() => pullRequest.labels).toEqual(['sveltia-cms/pending_publish']);
  });
});

test.describe('with Editorial Workflow on a single collection', () => {
  test.use({
    config: {
      ...GITHUB_CONFIG,
      collections: [
        { ...GITHUB_CONFIG.collections[0], publish_mode: 'editorial_workflow' },
        {
          ...GITHUB_CONFIG.collections[0],
          name: 'notes',
          label: 'Notes',
          label_singular: 'Note',
          folder: 'content/notes',
        },
      ],
    },
  });

  test('commits an entry of another collection directly', async ({ cms, github, page }) => {
    await cms.open();
    await createEntry(page, { title: 'Second Post', body: 'Coming soon.' });

    await expect
      .poll(() => github.pullRequests)
      .toMatchObject([{ head: 'cms/posts/second-post', labels: ['sveltia-cms/draft'] }]);

    await page.getByRole('treeitem', { name: 'Notes' }).click();
    await createEntry(page, { title: 'Reminder', body: 'Water the plants.', workflow: false });

    await expect
      .poll(() => github.readFile('content/notes/reminder.md'))
      .toBe(post('Reminder', 'Water the plants.'));
    expect(github.pullRequests).toHaveLength(1);
    expect(github.readFile('content/posts/second-post.md')).toBeUndefined();
  });
});

test.describe('with `publish: false` on the collection', () => {
  test.use({
    config: {
      ...WORKFLOW_CONFIG,
      collections: [{ ...WORKFLOW_CONFIG.collections[0], publish: false }],
    },
  });

  test('moves an entry to Ready without offering to publish it', async ({ cms, github, page }) => {
    const pullRequest = openEntryPullRequest(github, {
      slug: 'second-post',
      files: { 'content/posts/second-post.md': post('Second Post', 'Coming soon.') },
      status: 'pending_review',
    });

    await cms.open();

    const editor = await openEntry(page, 'Second Post');

    await cms.chooseMenuItem(
      page.getByRole('button', { name: /Status: .*In Review/ }),
      page.getByRole('menuitemradio', { name: 'Ready' }),
    );

    await expect.poll(() => pullRequest.labels).toEqual(['sveltia-cms/pending_publish']);
    await expect(page.getByRole('button', { name: /Status: .*Ready/ })).toBeVisible();
    await expect(editor.getByRole('button', { name: 'Publish Entry' })).toHaveCount(0);

    await page.getByRole('button', { name: 'Cancel Editing' }).click();
    await page.getByRole('radio', { name: 'Editorial Workflow' }).click();

    const card = page
      .getByRole('list', { name: 'Ready' })
      .getByRole('listitem')
      .filter({ has: page.getByRole('button', { name: 'Second Post' }) });

    await expect(card).toBeVisible();
    await expect(card.getByRole('button', { name: 'Publish Entry' })).toHaveCount(0);
  });
});

test.describe('with a `limit` on the collection', () => {
  test.use({
    config: {
      ...WORKFLOW_CONFIG,
      collections: [{ ...WORKFLOW_CONFIG.collections[0], limit: 2 }],
    },
  });

  test('counts a draft that was never published toward the limit', async ({
    cms,
    github,
    page,
  }) => {
    openEntryPullRequest(github, {
      slug: 'second-post',
      files: { 'content/posts/second-post.md': post('Second Post', 'Coming soon.') },
    });

    await cms.open();

    const collection = page.getByRole('main', { name: /Posts.*Collection/ });

    await expect(collection.getByRole('row', { name: /^Second Post/ })).toBeVisible();
    await expect(collection.getByRole('button', { name: 'Create New Entry' })).toBeDisabled();
    await expect(collection.getByRole('status')).toHaveText(
      /You cannot add new entries to this collection because it has reached its limit of 2 entries\./,
    );

    const menu = page.getByRole('menu', { name: 'Create Entry or Assets' });

    await cms.openPopup(page.getByRole('button', { name: 'Create Entry or Assets' }), menu);
    await expect(menu.getByRole('menuitem', { name: 'Post' })).toBeDisabled();
  });
});
