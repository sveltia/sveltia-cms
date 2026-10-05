import { openEntryPullRequest, post, WORKFLOW_CONFIG } from '../../fixtures/configs/workflow.js';
import { expect, GITLAB_CONFIG, test } from '../../fixtures/test.js';

/**
 * @import { Locator, Page } from '@playwright/test';
 * @import { MockGitHub } from '../../fixtures/github.js';
 */

/**
 * The GitHub blog with Editorial Workflow, published at its live site, where a post’s page is at
 * `/posts/{slug}`. A CI/CD provider builds a deploy preview of each pull request.
 */
const CONFIG = {
  ...WORKFLOW_CONFIG,
  site_url: 'https://www.example.com',
  collections: [{ ...WORKFLOW_CONFIG.collections[0], preview_path: 'posts/{{slug}}' }],
};

test.use({ config: CONFIG });

test.beforeEach(async ({ page }) => {
  // Never reach the live site or a deploy preview
  await page.context().route('https://*.example.com/**', (route) => route.fulfill({ body: '' }));
});

/**
 * Open a pull request for a new post, and get the SHA of its head commit, which a provider builds.
 * @param {MockGitHub} github GitHub mock.
 * @returns {string} Commit SHA.
 */
const openSecondPostPullRequest = (github) => {
  const pullRequest = openEntryPullRequest(github, {
    slug: 'second-post',
    files: { 'content/posts/second-post.md': post('Second Post', 'Coming soon.') },
    status: 'pending_review',
  });

  return github.getHead(pullRequest.head).oid;
};

/**
 * Open the second post in the editor.
 * @param {Page} page Page.
 * @returns {Promise<Locator>} Editor.
 */
const openSecondPost = async (page) => {
  const editor = page.getByRole('group', { name: 'Content Editor' });

  await page.getByRole('row', { name: /Second Post/ }).click();
  await expect(editor.getByRole('textbox', { name: 'Title' })).toHaveValue('Second Post');

  return editor;
};

/**
 * Click a control and get the URL of the tab it opens.
 * @param {Page} page Page.
 * @param {Locator} control Control.
 * @returns {Promise<string>} URL.
 */
const getOpenedURL = async (page, control) => {
  const [popup] = await Promise.all([page.waitForEvent('popup'), control.click()]);
  const url = popup.url();

  await popup.close();

  return url;
};

test('opens the entry on the deploy preview of its pull request', async ({ cms, github, page }) => {
  github.reportBuild(openSecondPostPullRequest(github), {
    deployments: [
      {
        environment: 'Preview',
        state: 'SUCCESS',
        environmentUrl: 'https://pr-1.preview.example.com',
      },
    ],
  });

  await cms.open();

  const editor = await openSecondPost(page);

  expect(await getOpenedURL(page, editor.getByRole('button', { name: 'View Preview' }))).toBe(
    'https://pr-1.preview.example.com/posts/second-post',
  );
});

test('waits for a deploy preview still being built', async ({ cms, github, page }) => {
  const sha = openSecondPostPullRequest(github);

  github.reportBuild(sha, { deployments: [{ environment: 'Preview', state: 'IN_PROGRESS' }] });
  await page.clock.install();
  await cms.open();

  const editor = await openSecondPost(page);
  // The live site has the published version, or nothing, so the control waits instead
  const waiting = editor.getByRole('button', { name: 'Checking for Preview' });

  await expect(waiting).toBeDisabled();
  await expect(waiting).toHaveAccessibleDescription('The preview is still being built.');

  // The provider finishes the build, which the CMS finds on its next check
  github.reportBuild(sha, {
    deployments: [
      {
        environment: 'Preview',
        state: 'SUCCESS',
        environmentUrl: 'https://pr-1.preview.example.com',
      },
    ],
  });
  await page.clock.fastForward('00:06');

  await expect(editor.getByRole('button', { name: 'View Preview' })).toBeEnabled();
});

test('says the deploy preview couldn’t be built', async ({ cms, github, page }) => {
  github.reportBuild(openSecondPostPullRequest(github), {
    deployments: [{ environment: 'Preview', state: 'FAILURE' }],
  });

  await cms.open();

  const editor = await openSecondPost(page);
  // The live site is still offered, with the failure spelled out
  const control = editor.getByRole('button', { name: 'View on Live Site' });

  await expect(control).toHaveAccessibleDescription('The preview couldn’t be built.');
  expect(await getOpenedURL(page, control)).toBe('https://www.example.com/posts/second-post');
});

test('finds the deploy preview a check run gives in its summary', async ({ cms, github, page }) => {
  // Like Netlify, which reports a deploy preview as a check rather than a deployment
  github.reportBuild(openSecondPostPullRequest(github), {
    checkRuns: [
      {
        name: 'netlify/e2e-site/deploy-preview',
        status: 'COMPLETED',
        conclusion: 'SUCCESS',
        detailsUrl: 'https://app.netlify.com/sites/e2e-site/deploys/1',
        summary: 'Deploy Preview ready! https://deploy-preview-1--e2e.preview.example.com',
      },
    ],
  });

  await cms.open();

  const editor = await openSecondPost(page);

  // The URL of the build page is passed over for the site
  expect(await getOpenedURL(page, editor.getByRole('button', { name: 'View Preview' }))).toBe(
    'https://deploy-preview-1--e2e.preview.example.com/posts/second-post',
  );
});

test.describe('with `preview_context`', () => {
  test.use({ config: { ...CONFIG, backend: { ...CONFIG.backend, preview_context: 'staging' } } });

  test('opens the deploy preview of the configured environment', async ({ cms, github, page }) => {
    github.reportBuild(openSecondPostPullRequest(github), {
      deployments: [
        { environment: 'staging', state: 'SUCCESS', environmentUrl: 'https://staging.example.com' },
        {
          environment: 'Preview',
          state: 'SUCCESS',
          environmentUrl: 'https://pr-1.preview.example.com',
        },
      ],
    });

    await cms.open();

    const editor = await openSecondPost(page);

    expect(await getOpenedURL(page, editor.getByRole('button', { name: 'View Preview' }))).toBe(
      'https://staging.example.com/posts/second-post',
    );
  });
});

test('opens the deploy preview from the card on the Editorial Workflow page', async ({
  cms,
  github,
  page,
}) => {
  github.reportBuild(openSecondPostPullRequest(github), {
    deployments: [
      {
        environment: 'Preview',
        state: 'SUCCESS',
        environmentUrl: 'https://pr-1.preview.example.com',
      },
    ],
  });

  await cms.open();
  await page.getByRole('radio', { name: 'Editorial Workflow' }).click();

  const card = page.getByRole('listitem').filter({ hasText: 'Second Post' });

  expect(await getOpenedURL(page, card.getByRole('button', { name: 'View Preview' }))).toBe(
    'https://pr-1.preview.example.com/posts/second-post',
  );
});

test.describe('on GitLab', () => {
  test.use({
    config: {
      ...CONFIG,
      backend: GITLAB_CONFIG.backend,
    },
  });

  test('opens the entry on the Review App of its merge request', async ({ cms, gitlab, page }) => {
    gitlab.createBranch('cms/posts/second-post', gitlab.head.oid);

    const { oid: sha } = gitlab.commit(
      { 'content/posts/second-post.md': post('Second Post', 'Coming soon.') },
      { branch: 'cms/posts/second-post', author: gitlab.user },
    );

    gitlab.openMergeRequest({
      title: 'Create Post “second-post”',
      sourceBranch: 'cms/posts/second-post',
      labels: ['sveltia-cms/pending_review'],
      author: gitlab.user,
    });
    // A Review App, deployed to an environment of the merge request’s own
    gitlab.reportBuild(sha, {
      deployments: [
        {
          environment: 'review/second-post',
          status: 'success',
          url: 'https://second-post.review.example.com',
        },
      ],
    });

    await cms.open();

    const editor = await openSecondPost(page);

    expect(await getOpenedURL(page, editor.getByRole('button', { name: 'View Preview' }))).toBe(
      'https://second-post.review.example.com/posts/second-post',
    );
  });
});
