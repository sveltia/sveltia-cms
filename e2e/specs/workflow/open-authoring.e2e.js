import { OPEN_AUTHORING_CONFIG, post, saveForkDraft } from '../../fixtures/configs/workflow.js';
import { expect, test } from '../../fixtures/test.js';

/**
 * @import { Locator, Page } from '@playwright/test';
 * @import { MockGitHub } from '../../fixtures/github.js';
 */

test.use({ config: OPEN_AUTHORING_CONFIG });

test.beforeEach(async ({ github }) => {
  github.commit({ 'content/posts/first-post.md': post('First Post', 'Hello, world!') });
});

/**
 * The branch the CMS saves the second post to in the contributor’s fork.
 */
const SECOND_POST_BRANCH = 'cms/mona/e2e-site/posts/second-post';

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
 * Create the second post and save it, leaving it a draft.
 * @param {Page} page Page.
 */
const saveSecondPost = async (page) => {
  await page.getByRole('button', { name: 'Create New Entry' }).first().click();

  const editor = page.getByRole('group', { name: 'Content Editor' });

  await editor.getByRole('textbox', { name: 'Title' }).fill('Second Post');
  await editor.getByRole('textbox', { name: 'Body' }).fill('Coming soon.');
  await editor.getByRole('button', { name: 'Save' }).click();
  await page
    .getByRole('alertdialog', { name: 'Send for Review' })
    .getByRole('button', { name: 'Later' })
    .click();
};

/**
 * Get the names of the branches in the repository or in the fork that hold Editorial Workflow
 * entries.
 * @param {MockGitHub} github GitHub mock.
 * @returns {string[]} Branch keys, as {@link MockGitHub.refs} has them.
 */
const getWorkflowBranches = (github) =>
  [...github.refs.keys()].filter((key) => /^(\w+:)?cms\//.test(key));

test('keeps a maintainer working on the repository', async ({ cms, github, page }) => {
  await cms.open();
  await saveSecondPost(page);

  await expect
    .poll(() => github.pullRequests)
    .toMatchObject([{ head: 'cms/posts/second-post', draft: true, labels: ['sveltia-cms/draft'] }]);
  expect(github.fork).toBeUndefined();
  expect(getWorkflowBranches(github)).toEqual(['cms/posts/second-post']);
  await expect(page.getByText(/Your changes are saved to your fork/)).toHaveCount(0);
});

test.describe('as a contributor', () => {
  test.beforeEach(({ github }) => {
    github.canWrite = false;
  });

  test('forks the repository once the contributor agrees to it', async ({ cms, github, page }) => {
    await cms.open();

    const dialog = page.getByRole('alertdialog', { name: 'Fork Repository' });

    await expect(dialog).toContainText(/To suggest changes to .*sveltia\/e2e-site/);
    await dialog.getByRole('button', { name: 'Fork' }).click();

    await expect(
      page.getByText(/Your changes are saved to your fork .*mona\/e2e-site/),
    ).toBeVisible();
    await expect(page.getByRole('grid', { name: 'Entries' }).getByRole('row')).toHaveText([
      /First Post/,
    ]);
    expect(github.fork).toEqual({ owner: 'mona', repo: 'e2e-site' });
  });

  test('stops when the contributor declines to fork the repository', async ({
    cms,
    github,
    page,
  }) => {
    await cms.open();
    await page
      .getByRole('alertdialog', { name: 'Fork Repository' })
      .getByRole('button', { name: 'Cancel' })
      .click();

    await expect(
      page.getByText('You need a fork of the repository on your account to suggest changes.'),
    ).toBeVisible();
    expect(github.fork).toBeUndefined();
  });

  test('explains that the repository doesn’t allow forks', async ({ cms, github, page }) => {
    github.allowForking = false;

    await cms.open();

    await expect(
      page.getByText(/The .*sveltia\/e2e-site.* repository doesn’t allow forks/),
    ).toBeVisible();
    await expect(page.getByRole('alertdialog', { name: 'Fork Repository' })).toHaveCount(0);
    expect(github.fork).toBeUndefined();
  });

  test.describe('with a fork', () => {
    test.beforeEach(({ github }) => {
      github.createFork();
    });

    test('brings the fork up to date with the repository', async ({ cms, github, page }) => {
      github.commit({ 'content/posts/third-post.md': post('Third Post', 'From Alex.') });

      await cms.open();

      await expect(page.getByRole('grid', { name: 'Entries' }).getByRole('row')).toHaveText([
        /First Post/,
        /Third Post/,
      ]);
      await expect.poll(() => github.refs.get('mona:main')).toBe(github.head.oid);
      await expect(page.getByRole('alertdialog', { name: 'Fork Repository' })).toHaveCount(0);
    });

    test('saves a new entry to a branch in the fork without a pull request', async ({
      cms,
      github,
      page,
    }) => {
      const { oid: mainBefore } = github.head;

      await cms.open();
      await saveSecondPost(page);

      await expect
        .poll(() =>
          github.readFile('content/posts/second-post.md', github.forkBranch(SECOND_POST_BRANCH)),
        )
        .toBe(post('Second Post', 'Coming soon.'));
      // Nothing reaches the repository, and the maintainers aren’t bothered with a draft
      expect(getWorkflowBranches(github)).toEqual([github.forkBranch(SECOND_POST_BRANCH)]);
      expect(github.head.oid).toBe(mainBefore);
      expect(github.pullRequests).toEqual([]);
      await expect(page.getByRole('grid', { name: 'Entries' }).getByRole('row')).toHaveText([
        /Unpublished Entries/,
        /Second Post.*Draft/,
        /Published Entries/,
        /First Post/,
      ]);
    });

    test('sends a draft for review with a pull request from the fork', async ({
      cms,
      github,
      page,
    }) => {
      saveForkDraft(github, {
        slug: 'second-post',
        files: { 'content/posts/second-post.md': post('Second Post', 'Coming soon.') },
      });

      await cms.open();
      await openEntry(page, 'Second Post');

      const statusButton = page.getByRole('button', { name: /Status: .*Draft/ });

      await statusButton.click();
      // A contributor can’t mark an entry ready to be published
      await expect(page.getByRole('menuitemradio')).toHaveText([/Draft/, /In Review/]);
      await page.getByRole('menuitemradio', { name: 'In Review' }).click();

      await expect
        .poll(() => github.pullRequests)
        .toMatchObject([
          {
            head: github.forkBranch(SECOND_POST_BRANCH),
            base: 'main',
            state: 'open',
            draft: false,
            // A contributor can’t label a pull request on the repository
            labels: [],
            author: github.user,
          },
        ]);

      await cms.chooseMenuItem(
        page.getByRole('button', { name: /Status: .*In Review/ }),
        page.getByRole('menuitemradio', { name: 'Draft' }),
      );

      // The pull request is kept, as a draft
      await expect.poll(() => github.pullRequests[0]).toMatchObject({ state: 'open', draft: true });
    });

    test('lists the entries in progress on the fork', async ({ cms, github, page }) => {
      saveForkDraft(github, {
        slug: 'second-post',
        files: { 'content/posts/second-post.md': post('Second Post', 'Coming soon.') },
      });

      const inReview = saveForkDraft(github, {
        slug: 'third-post',
        files: { 'content/posts/third-post.md': post('Third Post', 'Almost done.') },
      });

      github.openPullRequest({
        title: 'Create Post “third-post”',
        head: inReview,
        author: github.user,
      });

      await cms.open();
      await page.getByRole('radio', { name: 'Editorial Workflow' }).click();

      const board = page.getByRole('group', { name: 'Editorial Workflow' });

      await expect(board.getByRole('group', { name: 'Drafts' })).toContainText('Second Post');
      await expect(board.getByRole('group', { name: 'In Review' })).toContainText('Third Post');
      await expect(board.getByRole('group', { name: 'Ready' })).toHaveCount(0);
    });

    test('doesn’t let a contributor delete a published entry', async ({ cms, github, page }) => {
      const branch = saveForkDraft(github, {
        slug: 'first-post',
        files: { 'content/posts/first-post.md': post('First Post', 'Hello again!') },
      });

      github.openPullRequest({
        title: 'Update Post “first-post”',
        head: branch,
        author: github.user,
      });

      await cms.open();

      const editor = await openEntry(page, 'First Post');

      await editor.getByRole('button', { name: 'Show Editor Options' }).click();
      // Only the pending changes can be thrown away, not the published entry
      await expect(page.getByRole('menuitem', { name: 'Discard Changes' })).toBeVisible();
      await expect(page.getByRole('menuitem', { name: 'Delete', exact: true })).toHaveCount(0);
    });

    test('discards an entry by closing its pull request and deleting the branch', async ({
      cms,
      github,
      page,
    }) => {
      const branch = saveForkDraft(github, {
        slug: 'second-post',
        files: { 'content/posts/second-post.md': post('Second Post', 'Coming soon.') },
      });

      const pullRequest = github.openPullRequest({
        title: 'Create Post “second-post”',
        head: branch,
        author: github.user,
      });

      const { oid: mainBefore } = github.head;

      await cms.open();
      await openEntry(page, 'Second Post');
      await cms.chooseMenuItem(
        page.getByRole('button', { name: 'Show Editor Options' }),
        page.getByRole('menuitem', { name: 'Delete Entry' }),
      );
      await page
        .getByRole('alertdialog', { name: 'Delete Entry' })
        .getByRole('button', { name: 'Delete' })
        .click();

      await expect.poll(() => pullRequest.state).toBe('closed');
      await expect.poll(() => github.refs.has(branch)).toBe(false);
      expect(github.head.oid).toBe(mainBefore);
      await expect(page.getByRole('grid', { name: 'Entries' }).getByRole('row')).toHaveText([
        /First Post/,
      ]);
    });

    test('deletes the branch of a pull request a maintainer has merged', async ({
      cms,
      github,
      page,
    }) => {
      const branch = saveForkDraft(github, {
        slug: 'second-post',
        files: { 'content/posts/second-post.md': post('Second Post', 'Coming soon.') },
      });

      github.mergePullRequest(
        github.openPullRequest({
          title: 'Create Post “second-post”',
          head: branch,
          author: github.user,
        }),
      );

      await cms.open();

      await expect(page.getByRole('grid', { name: 'Entries' }).getByRole('row')).toHaveText([
        /First Post/,
        /Second Post/,
      ]);
      await expect.poll(() => github.refs.has(branch)).toBe(false);
    });
  });
});
