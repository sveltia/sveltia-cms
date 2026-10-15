import { openEntryPullRequest, post } from '../../fixtures/configs/workflow.js';
import { expect, GITHUB_CONFIG, test } from '../../fixtures/test.js';
import { getEditor, getEntryRows, openEntry } from '../../fixtures/ui.js';

/**
 * @import { Page } from '@playwright/test';
 */

test.beforeEach(async ({ github }) => {
  github.commit({ 'content/posts/first-post.md': post('First Post', 'Hello, world!') });
});

/**
 * Create an entry in the collection shown and fill it in, without saving it.
 * @param {Page} page Page.
 * @param {object} args Arguments.
 * @param {string} args.title Title.
 * @param {string} args.body Body.
 */
const fillNewEntry = async (page, { title, body }) => {
  await page.getByRole('button', { name: 'Create New Entry' }).first().click();

  const editor = getEditor(page);

  await editor.getByRole('textbox', { name: 'Title' }).fill(title);
  await editor.getByRole('textbox', { name: 'Body' }).fill(body);
};

test.describe('with Preview Workflow', () => {
  test.use({ config: { ...GITHUB_CONFIG, publish_mode: 'preview' } });

  test('saves a draft to a pull request and publishes it without a review', async ({
    cms,
    github,
    page,
  }) => {
    await cms.open();
    await fillNewEntry(page, { title: 'Second Post', body: 'Coming soon.' });
    await getEditor(page).getByRole('button', { name: 'Save' }).click();

    // There’s no stage to hand the draft over to, so nothing is asked
    await expect
      .poll(() => github.pullRequests)
      .toMatchObject([{ head: 'cms/posts/second-post', labels: ['sveltia-cms/draft'] }]);
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    expect(github.readFile('content/posts/second-post.md')).toBeUndefined();

    // The draft can be published right away, from the editor
    const editor = await openEntry(page, 'Second Post');

    await expect(editor.getByRole('button', { name: /^Status:/ })).toHaveCount(0);
    await editor.getByRole('button', { name: 'Publish Entry' }).click();
    await page
      .getByRole('alertdialog', { name: 'Publish Entry' })
      .getByRole('button', { name: 'Publish' })
      .click();

    await expect.poll(() => github.pullRequests[0].state).toBe('merged');
    expect(github.readFile('content/posts/second-post.md')).toBe(
      post('Second Post', 'Coming soon.'),
    );
  });

  test('lists the drafts on a page of their own', async ({ cms, github, page }) => {
    // A pull request labelled for review elsewhere is a draft all the same
    openEntryPullRequest(github, {
      slug: 'second-post',
      files: { 'content/posts/second-post.md': post('Second Post', 'Coming soon.') },
      status: 'pending_review',
    });

    await cms.open();
    await page.getByRole('radio', { name: 'Drafts' }).click();

    const column = page.getByRole('list', { name: 'Drafts' });

    await expect(column.getByRole('listitem')).toHaveCount(1);
    await expect(column.getByRole('button', { name: 'Publish Entry' })).toBeVisible();
    await expect(page.getByRole('list', { name: 'In Review' })).toHaveCount(0);
  });
});

test.describe('with the review stage left out', () => {
  test.use({
    config: {
      ...GITHUB_CONFIG,
      publish_mode: { type: 'editorial_workflow', stages: ['draft', 'pending_publish'] },
    },
  });

  test('offers to mark a saved draft ready', async ({ cms, github, page }) => {
    await cms.open();
    await fillNewEntry(page, { title: 'Second Post', body: 'Coming soon.' });
    await getEditor(page).getByRole('button', { name: 'Save' }).click();
    await page
      .getByRole('alertdialog', { name: 'Mark as Ready' })
      .getByRole('button', { name: 'Mark as Ready' })
      .click();

    await expect
      .poll(() => github.pullRequests)
      .toMatchObject([{ labels: ['sveltia-cms/pending_publish'] }]);
  });
});

test.describe('with direct publishing', () => {
  test.use({
    config: {
      ...GITHUB_CONFIG,
      publish_mode: { type: 'editorial_workflow', direct_publish: true },
    },
  });

  test('commits a new entry straight to the branch', async ({ cms, github, page }) => {
    await cms.open();
    await fillNewEntry(page, { title: 'Second Post', body: 'Coming soon.' });
    await cms.chooseMenuItem(
      getEditor(page).getByRole('button', { name: 'More Options' }).first(),
      page.getByRole('menuitem', { name: 'Save and Publish' }),
    );

    await expect
      .poll(() => github.readFile('content/posts/second-post.md'))
      .toBe(post('Second Post', 'Coming soon.'));
    expect(github.pullRequests).toEqual([]);
    await expect(getEntryRows(page)).toHaveText([/First Post/, /Second Post/]);
  });

  test('merges the pull request of an entry that has one', async ({ cms, github, page }) => {
    const pullRequest = openEntryPullRequest(github, {
      slug: 'second-post',
      files: { 'content/posts/second-post.md': post('Second Post', 'Coming soon.') },
    });

    await cms.open();

    const editor = await openEntry(page, 'Second Post');

    await editor.getByRole('textbox', { name: 'Body' }).fill('Here it is.');
    await cms.chooseMenuItem(
      editor.getByRole('button', { name: 'More Options' }).first(),
      page.getByRole('menuitem', { name: 'Save and Publish' }),
    );

    // The change is saved to the pull request, which is then merged
    await expect.poll(() => pullRequest.state).toBe('merged');
    expect(github.readFile('content/posts/second-post.md')).toBe(
      post('Second Post', 'Here it is.'),
    );
    await expect(getEntryRows(page)).toHaveText([/First Post/, /Second Post/]);
  });

  test('refuses to publish an incomplete entry', async ({ cms, github, page }) => {
    await cms.open();
    await fillNewEntry(page, { title: '', body: 'Coming soon.' });
    await cms.chooseMenuItem(
      getEditor(page).getByRole('button', { name: 'More Options' }).first(),
      page.getByRole('menuitem', { name: 'Save and Publish' }),
    );

    // Required fields can be left empty in a draft, but not in an entry going live
    await expect(
      page.getByRole('alert').filter({ hasText: /One field has an error/ }),
    ).toBeVisible();
    expect(github.pullRequests).toEqual([]);
  });
});
