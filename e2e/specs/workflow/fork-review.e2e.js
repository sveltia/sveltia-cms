import {
  OPEN_AUTHORING_CONFIG,
  openContributorPullRequest,
  post,
} from '../../fixtures/configs/workflow.js';
import { expect, test } from '../../fixtures/test.js';
import { getCard, getEditor, getEntryRows, getOpenedURL, openBoard } from '../../fixtures/ui.js';

test.use({ config: OPEN_AUTHORING_CONFIG });

test.beforeEach(async ({ github }) => {
  github.commit({ 'content/posts/first-post.md': post('First Post', 'Hello, world!') });
});

/**
 * Files of the post a contributor suggests from their fork.
 */
const SECOND_POST_FILES = { 'content/posts/second-post.md': post('Second Post', 'Coming soon.') };

test.describe('a maintainer reviewing a contributor’s pull request', () => {
  test('finds it on the board only, and reviews it on GitHub', async ({ cms, github, page }) => {
    const pullRequest = openContributorPullRequest(github, {
      slug: 'second-post',
      files: SECOND_POST_FILES,
    });

    await cms.open();

    // The entry list keeps showing what the repository has
    await expect(getEntryRows(page)).toHaveText([/First Post/]);

    const board = await openBoard(page);
    const card = getCard(board.getByRole('list', { name: 'In Review' }), 'Second Post');

    await expect(card).toContainText('From a fork');

    await card.dragTo(board.getByRole('list', { name: 'Ready' }));
    await expect.poll(() => pullRequest.labels).toEqual(['sveltia-cms/pending_publish']);

    const readyCard = getCard(board.getByRole('list', { name: 'Ready' }), 'Second Post');

    // It’s merged on GitHub rather than published here
    await expect(readyCard.getByRole('button', { name: 'Publish Entry' })).toHaveCount(0);
    // The pull request opens on GitHub in a new tab, which isn’t loaded for real
    await page.context().route('https://github.com/**', (route) => route.fulfill({ body: '' }));
    expect(
      await getOpenedURL(page, readyCard.getByRole('button', { name: /^Review on .*GitHub/ })),
    ).toBe('https://github.com/sveltia/e2e-site/pull/1');
    expect(pullRequest.state).toBe('open');
  });

  test('saves an edit to the contributor’s branch', async ({ cms, github, page }) => {
    const pullRequest = openContributorPullRequest(github, {
      slug: 'second-post',
      files: SECOND_POST_FILES,
    });

    await cms.open();

    const board = await openBoard(page);

    await getCard(board, 'Second Post').getByRole('button', { name: 'Second Post' }).click();

    const editor = getEditor(page);

    await expect(page.getByText(/Your changes are saved to their branch/)).toBeVisible();
    await editor.getByRole('textbox', { name: 'Body' }).fill('Out next week.');
    await editor.getByRole('button', { name: 'Save' }).click();

    await expect
      .poll(() => github.received.at(-1)?.branch)
      .toEqual({
        repositoryNameWithOwner: 'alex/e2e-site',
        branchName: 'cms/alex/e2e-site/posts/second-post',
      });
    expect(github.readFile('content/posts/second-post.md', pullRequest.head)).toContain(
      'Out next week.',
    );
    // Nothing went to a branch of the repository itself
    expect(github.getWorkflowBranches()).toEqual([]);
  });

  test('only shows one the contributor doesn’t let maintainers edit', async ({
    cms,
    github,
    page,
  }) => {
    openContributorPullRequest(github, {
      slug: 'second-post',
      files: SECOND_POST_FILES,
      maintainerCanModify: false,
    });

    await cms.open();

    const board = await openBoard(page);

    await getCard(board, 'Second Post').getByRole('button', { name: 'Second Post' }).click();

    await expect(page.getByText(/so it can only be viewed here/)).toBeVisible();
    await expect(getEditor(page).getByRole('button', { name: 'Save' })).toHaveCount(0);
  });
});
