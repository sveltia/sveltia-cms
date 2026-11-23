import { OPEN_AUTHORING_CONFIG, post } from '../../fixtures/configs/workflow.js';
import { expect, GITEA_CONFIG, GITLAB_CONFIG, test } from '../../fixtures/test.js';
import { getCard, getEditor, getEntryRows, getOpenedURL, openBoard } from '../../fixtures/ui.js';

/**
 * @import { MockGitea } from '../../fixtures/gitea.js';
 * @import { MockGitHub } from '../../fixtures/github.js';
 * @import { MockGitLab } from '../../fixtures/gitlab.js';
 */

/**
 * Files of the post a contributor suggests from their fork.
 */
const SECOND_POST_FILES = { 'content/posts/second-post.md': post('Second Post', 'Coming soon.') };

/**
 * The services a maintainer can review a contributor’s request on, each with the blog set up for
 * Open Authoring and signed in as a maintainer, who can write to the repository. `test` hands the
 * service’s mock to a test as `mock`, so each test asks for the one fixture it needs.
 */
const SERVICES = [
  {
    name: 'GitHub',
    request: 'pull request',
    config: OPEN_AUTHORING_CONFIG,
    openState: 'open',
    test: test.extend({
      // eslint-disable-next-line jsdoc/require-jsdoc
      mock: async ({ github }, /** @type {(mock: MockGitHub) => Promise<void>} */ use) => {
        await use(github);
      },
    }),
    /**
     * Get the address the request is reviewed at.
     * @param {{ owner: string, repo: string }} mock Mock, for the repository it serves.
     * @returns {string} URL.
     */
    getReviewURL: (mock) => `https://github.com/${mock.owner}/${mock.repo}/pull/1`,
  },
  {
    name: 'GitLab',
    request: 'merge request',
    config: {
      ...GITLAB_CONFIG,
      publish_mode: 'editorial_workflow',
      backend: { ...GITLAB_CONFIG.backend, open_authoring: true },
    },
    openState: 'opened',
    test: test.extend({
      // eslint-disable-next-line jsdoc/require-jsdoc
      mock: async ({ gitlab }, /** @type {(mock: MockGitLab) => Promise<void>} */ use) => {
        await use(gitlab);
      },
    }),
    /**
     * Get the address the request is reviewed at.
     * @param {{ owner: string, repo: string }} mock Mock, for the repository it serves.
     * @returns {string} URL.
     */
    getReviewURL: (mock) => `https://gitlab.com/${mock.owner}/${mock.repo}/-/merge_requests/1`,
  },
  {
    name: 'Gitea',
    request: 'pull request',
    config: {
      ...GITEA_CONFIG,
      publish_mode: 'editorial_workflow',
      backend: { ...GITEA_CONFIG.backend, open_authoring: true },
    },
    openState: 'open',
    test: test.extend({
      // eslint-disable-next-line jsdoc/require-jsdoc
      mock: async ({ gitea }, /** @type {(mock: MockGitea) => Promise<void>} */ use) => {
        await use(gitea);
      },
    }),
    /**
     * Get the address the request is reviewed at.
     * @param {{ owner: string, repo: string }} mock Mock, for the repository it serves.
     * @returns {string} URL.
     */
    getReviewURL: (mock) => `https://gitea.com/${mock.owner}/${mock.repo}/pulls/1`,
  },
];

SERVICES.forEach(({ name, request, config, openState, test: serviceTest, getReviewURL }) => {
  serviceTest.describe(`a maintainer reviewing a contributor’s ${request} on ${name}`, () => {
    serviceTest.use({ config });

    serviceTest.beforeEach(async ({ mock }) => {
      mock.commit({ 'content/posts/first-post.md': post('First Post', 'Hello, world!') });
    });

    serviceTest(
      `finds it on the board only, and reviews it on ${name}`,
      async ({ cms, mock, page }) => {
        const contribution = mock.openContributorRequest({
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
        await expect.poll(() => contribution.labels).toEqual(['sveltia-cms/pending_publish']);

        const readyCard = getCard(board.getByRole('list', { name: 'Ready' }), 'Second Post');
        const reviewURL = getReviewURL(mock);

        // It’s merged on the service rather than published here
        await expect(readyCard.getByRole('button', { name: 'Publish Entry' })).toHaveCount(0);
        // The request opens on the service in a new tab, which isn’t loaded for real
        await page
          .context()
          .route(`${new URL(reviewURL).origin}/**`, (route) => route.fulfill({ body: '' }));
        expect(
          await getOpenedURL(
            page,
            readyCard.getByRole('button', { name: new RegExp(`^Review on .*${name}`) }),
          ),
        ).toBe(reviewURL);
        expect(contribution.state).toBe(openState);
      },
    );

    serviceTest('saves an edit to the contributor’s branch', async ({ cms, mock, page }) => {
      mock.openContributorRequest({ slug: 'second-post', files: SECOND_POST_FILES });

      await cms.open();

      const board = await openBoard(page);

      await getCard(board, 'Second Post').getByRole('button', { name: 'Second Post' }).click();

      const editor = getEditor(page);

      await expect(page.getByText(/Your changes are saved to their branch/)).toBeVisible();
      await editor.getByRole('textbox', { name: 'Body' }).fill('Out next week.');
      await editor.getByRole('button', { name: 'Save' }).click();

      const branch = mock.forkBranch(`cms/${mock.colleague.login}/${mock.repo}/posts/second-post`);

      await expect
        .poll(() => mock.readFile('content/posts/second-post.md', branch))
        .toContain('Out next week.');
      // Nothing went to a branch of the repository itself
      expect(mock.getWorkflowBranches()).toEqual([]);
    });

    serviceTest(
      'only shows one the contributor doesn’t let maintainers edit',
      async ({ cms, mock, page }) => {
        mock.openContributorRequest({
          slug: 'second-post',
          files: SECOND_POST_FILES,
          editable: false,
        });

        await cms.open();

        const board = await openBoard(page);

        await getCard(board, 'Second Post').getByRole('button', { name: 'Second Post' }).click();

        await expect(page.getByText(/so it can only be viewed here/)).toBeVisible();
        await expect(getEditor(page).getByRole('button', { name: 'Save' })).toHaveCount(0);
      },
    );
  });
});
