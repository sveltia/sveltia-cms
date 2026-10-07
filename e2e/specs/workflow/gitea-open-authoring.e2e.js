import { post } from '../../fixtures/configs/workflow.js';
import { createPNG } from '../../fixtures/files.js';
import { FORK_REPO_ID } from '../../fixtures/gitea.js';
import { expect, GITEA_CONFIG, test } from '../../fixtures/test.js';

/**
 * @import { Locator, Page } from '@playwright/test';
 * @import { CMS } from '../../fixtures/test.js';
 * @import { MockGitea, MockPullRequest } from '../../fixtures/gitea.js';
 */

/**
 * The Gitea blog with Editorial Workflow and Open Authoring: a user who can’t write to the
 * repository works on a fork of it instead. Set `gitea.canWrite` to `false` to sign in as such a
 * contributor.
 */
const GITEA_OPEN_AUTHORING_CONFIG = {
  ...GITEA_CONFIG,
  publish_mode: 'editorial_workflow',
  backend: { ...GITEA_CONFIG.backend, open_authoring: true },
};

/**
 * The branch the CMS saves the second post to in the contributor’s fork.
 */
const SECOND_POST_BRANCH = 'cms/mona/e2e-site/posts/second-post';

test.use({ config: GITEA_OPEN_AUTHORING_CONFIG });

test.beforeEach(async ({ gitea }) => {
  gitea.commit({ 'content/posts/first-post.md': post('First Post', 'Hello, world!') });
});

/**
 * Open an entry in the editor.
 * @param {Page} page Page.
 * @param {string} title Entry title.
 * @returns {Promise<Locator>} Editor.
 */
const openEntry = async (page, title) => {
  const editor = page.getByRole('group', { name: 'Content Editor' });

  await page.getByRole('row', { name: new RegExp(title) }).click();
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
 * Change the status of the entry open in the editor with its status menu.
 * @param {CMS} cms CMS.
 * @param {Page} page Page.
 * @param {RegExp} current Current status.
 * @param {string} status New status.
 */
const changeStatus = async (cms, page, current, status) => {
  await cms.chooseMenuItem(
    page.getByRole('button', { name: current }),
    page.getByRole('menuitemradio', { name: status }),
  );
};

/**
 * Save a post to a branch in the contributor’s fork the way the CMS does. The fork has to exist.
 * Like the CMS, this opens no pull request: the entry is a draft until it’s sent for review.
 * @param {MockGitea} gitea Gitea mock.
 * @param {object} args Arguments.
 * @param {string} args.slug Entry slug.
 * @param {Record<string, string | null>} args.files Files to commit to the branch.
 * @returns {string} Branch name, which {@link MockGitea.forkBranch} turns into its key.
 */
const saveForkDraft = (gitea, { slug, files }) => {
  const branch = `cms/${gitea.user.login}/${gitea.repo}/posts/${slug}`;
  const key = gitea.forkBranch(branch);

  gitea.createBranch(key, gitea.head.oid);
  gitea.commit(files, { branch: key, author: gitea.user, message: `Create Post “${slug}”` });

  return branch;
};

/**
 * Open a pull request from a fork branch the way the CMS does: across repositories, authored by
 * the contributor and without a label, which they can’t set on the configured repository.
 * @param {MockGitea} gitea Gitea mock.
 * @param {object} args Arguments.
 * @param {string} args.slug Entry slug.
 * @param {string} args.branch Head branch name in the fork.
 * @returns {MockPullRequest} Pull request.
 */
const openForkPullRequest = (gitea, { slug, branch }) =>
  gitea.openPullRequest(
    { title: `Create Post “${slug}”`, headBranch: branch },
    { headRepoId: FORK_REPO_ID, author: gitea.user },
  );

/**
 * Get the names of the branches in the repository or in the fork that hold Editorial Workflow
 * entries.
 * @param {MockGitea} gitea Gitea mock.
 * @returns {string[]} Branch keys, as {@link MockGitea.refs} has them.
 */
const getWorkflowBranches = (gitea) =>
  [...gitea.refs.keys()].filter((key) => /^(\w+:)?cms\//.test(key));

test('keeps a maintainer working on the repository', async ({ cms, gitea, page }) => {
  await cms.open();
  await saveSecondPost(page);

  await expect
    .poll(() => gitea.pullRequests)
    .toMatchObject([
      {
        title: 'WIP: Create Post “second-post”',
        headBranch: 'cms/posts/second-post',
        labels: ['sveltia-cms/draft'],
      },
    ]);
  expect(gitea.fork).toBeUndefined();
  expect(getWorkflowBranches(gitea)).toEqual(['cms/posts/second-post']);
  await expect(page.getByText(/Your changes are saved to your fork/)).toHaveCount(0);
});

test.describe('as a contributor', () => {
  test.beforeEach(({ gitea }) => {
    gitea.canWrite = false;
  });

  test('forks the repository once the contributor agrees to it', async ({ cms, gitea, page }) => {
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
    expect(gitea.fork).toEqual({ owner: 'mona', repo: 'e2e-site' });
  });

  test('asks for the fork under another name when the first is taken', async ({
    cms,
    gitea,
    page,
  }) => {
    // Unlike GitHub, the instance doesn’t pick another name when the contributor already has an
    // unrelated repository of the name the fork would get; the CMS gives it one
    gitea.forkNameTaken = true;

    await cms.open();
    await page
      .getByRole('alertdialog', { name: 'Fork Repository' })
      .getByRole('button', { name: 'Fork' })
      .click();

    await expect(
      page.getByText(/Your changes are saved to your fork .*mona\/sveltia-e2e-site/),
    ).toBeVisible();
    expect(gitea.fork).toEqual({ owner: 'mona', repo: 'sveltia-e2e-site' });
  });

  test('stops when the contributor declines to fork the repository', async ({
    cms,
    gitea,
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
    expect(gitea.fork).toBeUndefined();
  });

  test('finds a fork under another name', async ({ cms, gitea, page }) => {
    // The fork isn’t where the CMS looks first, so it’s found through the repository search
    gitea.createFork({ repo: 'e2e-site-fork' });

    await cms.open();
    await expect(
      page.getByText(/Your changes are saved to your fork .*mona\/e2e-site-fork/),
    ).toBeVisible();
    await saveSecondPost(page);

    await expect
      .poll(() => getWorkflowBranches(gitea))
      .toEqual([gitea.forkBranch('cms/mona/e2e-site-fork/posts/second-post')]);
    await expect(page.getByRole('alertdialog', { name: 'Fork Repository' })).toHaveCount(0);
  });

  test('says the fork is missing the configured branch', async ({ cms, gitea, page }) => {
    gitea.createFork();
    // A fork that predates a rename of the default branch has no copy of it to start from
    gitea.refs.delete(gitea.forkBranch('main'));

    await cms.open();

    await expect(
      page.getByText(/Your .*mona\/e2e-site.* fork doesn’t have the .*main.* branch/),
    ).toBeVisible();
    await expect(
      page.getByText(/Update the fork from the .*sveltia\/e2e-site.* repository/),
    ).toBeVisible();
  });

  test.describe('with a fork', () => {
    test.beforeEach(({ gitea }) => {
      gitea.createFork();
    });

    test('brings the fork up to date with the repository on Gitea', async ({
      cms,
      gitea,
      page,
    }) => {
      gitea.commit({ 'content/posts/third-post.md': post('Third Post', 'From Alex.') });

      await cms.open();

      await expect(page.getByRole('grid', { name: 'Entries' }).getByRole('row')).toHaveText([
        /First Post/,
        /Third Post/,
      ]);
      await expect.poll(() => gitea.refs.get(gitea.forkBranch('main'))).toBe(gitea.head.oid);
    });

    test('brings the fork up to date with the repository on Forgejo', async ({
      cms,
      gitea,
      page,
    }) => {
      // Forgejo has an API of its own for this, which names the branch in the path rather than in
      // the body, so the Gitea endpoint is never reached there
      gitea.version = '13.0.3+gitea-1.22.0';
      gitea.commit({ 'content/posts/third-post.md': post('Third Post', 'From Alex.') });

      await cms.open();

      await expect(page.getByRole('grid', { name: 'Entries' }).getByRole('row')).toHaveText([
        /First Post/,
        /Third Post/,
      ]);
      await expect.poll(() => gitea.refs.get(gitea.forkBranch('main'))).toBe(gitea.head.oid);
    });

    test('merges the repository into a fork that has moved on, on Gitea', async ({
      cms,
      gitea,
      page,
    }) => {
      // The fork has a commit of its own, so it can’t be fast-forwarded. Gitea falls back to a
      // merge, which brings the repository in without losing the contributor’s commit
      gitea.commit(
        { 'notes.md': 'Mine.' },
        { branch: gitea.forkBranch('main'), author: gitea.user },
      );
      gitea.commit({ 'content/posts/third-post.md': post('Third Post', 'From Alex.') });

      await cms.open();
      await expect(page.getByRole('grid', { name: 'Entries' }).getByRole('row')).toHaveText([
        /First Post/,
        /Third Post/,
      ]);
      await saveSecondPost(page);

      const branch = gitea.forkBranch(SECOND_POST_BRANCH);

      await expect
        .poll(() => gitea.readFile('content/posts/second-post.md', branch))
        .toBe(post('Second Post', 'Coming soon.'));
      // The branch starts from the fork, which now holds both sides
      expect(gitea.readFile('notes.md', branch)).toBe('Mine.');
      expect(gitea.readFile('content/posts/third-post.md', branch)).toBe(
        post('Third Post', 'From Alex.'),
      );
    });

    test('leaves a fork that has moved on as it is, on Forgejo', async ({ cms, gitea, page }) => {
      // Forgejo only fast-forwards, and turns down a fork carrying commits of its own with a 400.
      // The CMS carries on with the fork as it is: the branch it starts is behind the repository,
      // which makes for a noisier pull request but loses nothing
      gitea.version = '13.0.3+gitea-1.22.0';
      gitea.commit(
        { 'notes.md': 'Mine.' },
        { branch: gitea.forkBranch('main'), author: gitea.user },
      );

      const { oid: forkMainBefore } = gitea.getHead(gitea.forkBranch('main'));

      gitea.commit({ 'content/posts/third-post.md': post('Third Post', 'From Alex.') });

      await cms.open();

      // The entries still come from the repository, not from the fork
      await expect(page.getByRole('grid', { name: 'Entries' }).getByRole('row')).toHaveText([
        /First Post/,
        /Third Post/,
      ]);
      expect(gitea.refs.get(gitea.forkBranch('main'))).toBe(forkMainBefore);

      await saveSecondPost(page);

      const branch = gitea.forkBranch(SECOND_POST_BRANCH);

      await expect
        .poll(() => gitea.readFile('content/posts/second-post.md', branch))
        .toBe(post('Second Post', 'Coming soon.'));
      expect(gitea.readFile('notes.md', branch)).toBe('Mine.');
      expect(gitea.readFile('content/posts/third-post.md', branch)).toBeUndefined();
    });

    test.describe('with an image field', () => {
      test.use({
        config: {
          ...GITEA_OPEN_AUTHORING_CONFIG,
          collections: [
            {
              ...GITEA_OPEN_AUTHORING_CONFIG.collections[0],
              fields: [
                ...GITEA_OPEN_AUTHORING_CONFIG.collections[0].fields,
                { name: 'cover', label: 'Cover', widget: 'image', required: false },
              ],
            },
          ],
        },
      });

      test('saves an image attached to an entry to the fork', async ({ cms, gitea, page }) => {
        const image = createPNG({ color: [0, 128, 255] });

        await cms.open();
        await page.getByRole('button', { name: 'Create New Entry' }).first().click();

        const editor = page.getByRole('group', { name: 'Content Editor' });

        await editor.getByRole('textbox', { name: 'Title' }).fill('Second Post');
        await editor.getByRole('textbox', { name: 'Body' }).fill('Coming soon.');
        await editor
          .getByRole('group', { name: '“\u2068Cover\u2069” Field' })
          .locator('input[type="file"]')
          .first()
          .setInputFiles({ name: 'sunrise.png', mimeType: 'image/png', buffer: image });
        await expect(editor.getByRole('button', { name: 'Remove Image' })).toBeVisible();
        await editor.getByRole('button', { name: 'Save' }).click();
        await page
          .getByRole('alertdialog', { name: 'Send for Review' })
          .getByRole('button', { name: 'Later' })
          .click();

        const branch = gitea.forkBranch(SECOND_POST_BRANCH);

        await expect
          .poll(() => gitea.readFile('content/posts/second-post.md', branch))
          .toMatch(/cover: \/images\/sunrise\.png/);
        expect(
          gitea.blobs.get(gitea.getHead(branch).tree.get('static/images/sunrise.png') ?? ''),
        ).toEqual(image);
        expect(gitea.head.tree.has('static/images/sunrise.png')).toBe(false);
      });
    });

    test('saves a new entry to a branch in the fork without a pull request', async ({
      cms,
      gitea,
      page,
    }) => {
      const { oid: mainBefore } = gitea.head;

      await cms.open();
      await saveSecondPost(page);

      const branch = gitea.forkBranch(SECOND_POST_BRANCH);

      await expect
        .poll(() => gitea.readFile('content/posts/second-post.md', branch))
        .toBe(post('Second Post', 'Coming soon.'));
      // The commit creates the branch in the fork from the fork’s copy of the configured branch
      expect(gitea.received[0]).toMatchObject({
        branch: 'main',
        new_branch: SECOND_POST_BRANCH,
      });
      // Nothing reaches the repository, and the maintainers aren’t bothered with a draft
      expect(getWorkflowBranches(gitea)).toEqual([branch]);
      expect(gitea.head.oid).toBe(mainBefore);
      expect(gitea.pullRequests).toEqual([]);
      await expect(page.getByRole('grid', { name: 'Entries' }).getByRole('row')).toHaveText([
        /Unpublished Entries/,
        /Second Post.*Draft/,
        /Published Entries/,
        /First Post/,
      ]);
    });

    test('saves again to the same branch in the fork', async ({ cms, gitea, page }) => {
      await cms.open();
      await saveSecondPost(page);

      const branch = gitea.forkBranch(SECOND_POST_BRANCH);

      await expect
        .poll(() => gitea.readFile('content/posts/second-post.md', branch))
        .toBe(post('Second Post', 'Coming soon.'));

      const editor = await openEntry(page, 'Second Post');

      await editor.getByRole('textbox', { name: 'Body' }).fill('Almost there.');
      await editor.getByRole('button', { name: 'Save' }).click();
      await page
        .getByRole('alertdialog', { name: 'Send for Review' })
        .getByRole('button', { name: 'Later' })
        .click();

      await expect
        .poll(() => gitea.readFile('content/posts/second-post.md', branch))
        .toBe(post('Second Post', 'Almost there.'));
      expect(getWorkflowBranches(gitea)).toEqual([branch]);
      expect(gitea.pullRequests).toEqual([]);
    });

    test('lists the entries in progress on the fork', async ({ cms, gitea, page }) => {
      saveForkDraft(gitea, {
        slug: 'second-post',
        files: { 'content/posts/second-post.md': post('Second Post', 'Coming soon.') },
      });

      const inReview = saveForkDraft(gitea, {
        slug: 'third-post',
        files: { 'content/posts/third-post.md': post('Third Post', 'Almost done.') },
      });

      openForkPullRequest(gitea, { slug: 'third-post', branch: inReview });

      await cms.open();
      await page.getByRole('radio', { name: 'Editorial Workflow' }).click();

      const board = page.getByRole('group', { name: 'Editorial Workflow' });

      await expect(board.getByRole('group', { name: 'Drafts' })).toContainText('Second Post');
      await expect(board.getByRole('group', { name: 'In Review' })).toContainText('Third Post');
      await expect(board.getByRole('group', { name: 'Ready' })).toHaveCount(0);
    });

    test('sends a draft for review with a pull request from the fork', async ({
      cms,
      gitea,
      page,
    }) => {
      saveForkDraft(gitea, {
        slug: 'second-post',
        files: { 'content/posts/second-post.md': post('Second Post', 'Coming soon.') },
      });

      await cms.open();

      const editor = await openEntry(page, 'Second Post');
      const statusButton = page.getByRole('button', { name: /Status: .*Draft/ });

      await statusButton.click();
      // A contributor can’t mark an entry ready to be published
      await expect(page.getByRole('menuitemradio')).toHaveText([/Draft/, /In Review/]);
      await page.getByRole('menuitemradio', { name: 'In Review' }).click();

      await expect
        .poll(() => gitea.pullRequests)
        .toMatchObject([
          {
            title: 'Create Post “second-post”',
            headBranch: SECOND_POST_BRANCH,
            headRepoId: FORK_REPO_ID,
            baseBranch: 'main',
            state: 'open',
            // A contributor can’t label a pull request on the repository
            labels: [],
            author: gitea.user,
          },
        ]);

      await changeStatus(cms, page, /Status: .*In Review/, 'Draft');

      // The pull request is kept, as a work in progress
      await expect
        .poll(() => gitea.pullRequests[0])
        .toMatchObject({ title: 'WIP: Create Post “second-post”', state: 'open' });

      // After a reload the title comes from the pull request rather than the head commit, and the
      // prefix has to be dropped on the way in. Keeping it would have the entry written back with
      // the same title, leaving the pull request a work in progress
      await page.reload();
      // The reload comes back to the editor, with the entry read from the branch and its pull
      // request rather than from the draft in memory
      await expect(editor.getByRole('textbox', { name: 'Title' })).toHaveValue('Second Post');
      await changeStatus(cms, page, /Status: .*Draft/, 'In Review');

      await expect
        .poll(() => gitea.pullRequests[0])
        .toMatchObject({ title: 'Create Post “second-post”', state: 'open' });
      expect(gitea.pullRequests).toHaveLength(1);
    });

    test('reopens a pull request closed on the instance', async ({ cms, gitea, page }) => {
      const branch = saveForkDraft(gitea, {
        slug: 'second-post',
        files: { 'content/posts/second-post.md': post('Second Post', 'Coming soon.') },
      });

      const pullRequest = openForkPullRequest(gitea, { slug: 'second-post', branch });

      pullRequest.state = 'closed';

      await cms.open();
      // A closed pull request leaves the entry a draft
      await openEntry(page, 'Second Post');
      await changeStatus(cms, page, /Status: .*Draft/, 'In Review');

      await expect.poll(() => pullRequest.state).toBe('open');
      expect(gitea.pullRequests).toHaveLength(1);
    });

    [
      ['Gitea', '1.24.0'],
      ['Forgejo', '13.0.3+gitea-1.22.0'],
    ].forEach(([service, version]) => {
      test(`treats a branch changed since its merge as a new draft on ${service}`, async ({
        cms,
        gitea,
        page,
      }) => {
        // Forgejo reports the branch’s current head on a merged pull request, which says nothing
        // about what was merged, so the branch mustn’t be taken for a leftover and deleted
        gitea.version = version;

        const branch = saveForkDraft(gitea, {
          slug: 'second-post',
          files: { 'content/posts/second-post.md': post('Second Post', 'Coming soon.') },
        });

        gitea.mergePullRequest(openForkPullRequest(gitea, { slug: 'second-post', branch }));
        gitea.commit(
          { 'content/posts/second-post.md': post('Second Post', 'Now with more.') },
          { branch: gitea.forkBranch(branch), author: gitea.user },
        );

        await cms.open();

        // The published entry has a draft again, which stands in for it
        await expect(page.getByRole('grid', { name: 'Entries' }).getByRole('row')).toHaveText([
          /First Post/,
          /Second Post.*Draft/,
        ]);
        await openEntry(page, 'Second Post');
        await changeStatus(cms, page, /Status: .*Draft/, 'In Review');

        // A new pull request, rather than an attempt to reopen the merged one, which the instance
        // refuses with a 412
        await expect
          .poll(() => gitea.pullRequests.map(({ state, merged }) => (merged ? 'merged' : state)))
          .toEqual(['merged', 'open']);
        expect(gitea.refs.has(gitea.forkBranch(branch))).toBe(true);
      });
    });

    test('reports an entry published since the board was loaded instead of sending it for review', async ({
      cms,
      gitea,
      page,
    }) => {
      const branch = saveForkDraft(gitea, {
        slug: 'second-post',
        files: { 'content/posts/second-post.md': post('Second Post', 'Coming soon.') },
      });

      const pullRequest = openForkPullRequest(gitea, { slug: 'second-post', branch });

      // The entry is a draft, because its pull request is still a work in progress
      pullRequest.title = `WIP: ${pullRequest.title}`;

      await cms.open();
      await openEntry(page, 'Second Post');

      // A maintainer takes it out of the drafting stage and merges it after the board was loaded,
      // and the contributor commits nothing to the branch since
      pullRequest.title = 'Create Post “second-post”';
      gitea.mergePullRequest(pullRequest);

      await changeStatus(cms, page, /Status: .*Draft/, 'In Review');

      await expect(page.getByRole('alert')).toContainText(
        'A maintainer has already published this entry, so there’s nothing left to review.',
      );
      // No pull request with nothing in it is opened, and the leftover branch is deleted the way
      // the next load would
      expect(gitea.pullRequests.map(({ merged }) => merged)).toEqual([true]);
      await expect.poll(() => gitea.refs.has(gitea.forkBranch(branch))).toBe(false);
      // The editor closes onto the entry list, where the entry is published rather than a draft
      await expect(page.getByRole('group', { name: 'Content Editor' })).toBeHidden();
      await expect(page.getByRole('grid', { name: 'Entries' }).getByRole('row')).toHaveText([
        /First Post/,
        /^\s*Second Post\s*$/,
      ]);
    });

    test('opens a new pull request when the known one was aimed elsewhere since', async ({
      cms,
      gitea,
      page,
    }) => {
      const branch = saveForkDraft(gitea, {
        slug: 'second-post',
        files: { 'content/posts/second-post.md': post('Second Post', 'Coming soon.') },
      });

      const pullRequest = openForkPullRequest(gitea, { slug: 'second-post', branch });

      pullRequest.title = `WIP: ${pullRequest.title}`;

      await cms.open();
      await openEntry(page, 'Second Post');

      // The pull request is moved to another base branch after the board was loaded. Taking it out
      // of the work-in-progress state would put a request for that branch in front of the
      // maintainers
      // @see https://github.com/sveltia/sveltia-cms/security/advisories/GHSA-8h97-74c4-g246
      pullRequest.baseBranch = 'develop';

      await changeStatus(cms, page, /Status: .*Draft/, 'In Review');

      await expect.poll(() => gitea.pullRequests).toHaveLength(2);
      expect(pullRequest.title).toBe('WIP: Create Post “second-post”');
      expect(gitea.pullRequests[1]).toMatchObject({
        title: 'Create Post “second-post”',
        headBranch: branch,
        headRepoId: FORK_REPO_ID,
        baseBranch: 'main',
      });
    });

    test('ignores a pull request the contributor opened to another branch', async ({
      cms,
      gitea,
      page,
    }) => {
      const branch = saveForkDraft(gitea, {
        slug: 'second-post',
        files: { 'content/posts/second-post.md': post('Second Post', 'Coming soon.') },
      });

      gitea.openPullRequest(
        { title: 'Something else', headBranch: branch },
        { headRepoId: FORK_REPO_ID, author: gitea.user, baseBranch: 'develop' },
      );

      await cms.open();

      // The entry is a draft without a pull request, rather than one in review under the title of
      // a request the CMS doesn’t manage
      await expect(page.getByRole('grid', { name: 'Entries' }).getByRole('row')).toHaveText([
        /Unpublished Entries/,
        /Second Post.*Draft/,
        /Published Entries/,
        /First Post/,
      ]);
    });

    test('warns before saving over a commit made to the fork branch', async ({
      cms,
      gitea,
      page,
    }) => {
      const branch = saveForkDraft(gitea, {
        slug: 'second-post',
        files: { 'content/posts/second-post.md': post('Second Post', 'Coming soon.') },
      });

      await cms.open();

      const editor = await openEntry(page, 'Second Post');

      // Another tab, or the contributor working on the instance, commits to the branch meanwhile
      gitea.commit(
        { 'content/posts/second-post.md': post('Second Post', 'From another tab.') },
        { branch: gitea.forkBranch(branch), author: gitea.user },
      );

      await editor.getByRole('textbox', { name: 'Body' }).fill('From this tab.');
      await editor.getByRole('button', { name: 'Save' }).click();

      const dialog = page.getByRole('alertdialog', { name: 'Entry Changed by Someone Else' });

      await expect(dialog).toContainText('If you save now, their changes will be lost.');
      expect(gitea.readFile('content/posts/second-post.md', gitea.forkBranch(branch))).toBe(
        post('Second Post', 'From another tab.'),
      );

      // Saving anyway goes on top of the commit just read back, whose files the save is checked
      // against
      await dialog.getByRole('button', { name: 'Save Anyway' }).click();
      await page
        .getByRole('alertdialog', { name: 'Send for Review' })
        .getByRole('button', { name: 'Later' })
        .click();

      await expect
        .poll(() => gitea.readFile('content/posts/second-post.md', gitea.forkBranch(branch)))
        .toBe(post('Second Post', 'From this tab.'));
    });

    test('deletes the branch of a pull request a maintainer has merged', async ({
      cms,
      gitea,
      page,
    }) => {
      const branch = saveForkDraft(gitea, {
        slug: 'second-post',
        files: { 'content/posts/second-post.md': post('Second Post', 'Coming soon.') },
      });

      gitea.mergePullRequest(openForkPullRequest(gitea, { slug: 'second-post', branch }));

      await cms.open();

      await expect(page.getByRole('grid', { name: 'Entries' }).getByRole('row')).toHaveText([
        /First Post/,
        /Second Post/,
      ]);
      await expect.poll(() => gitea.refs.has(gitea.forkBranch(branch))).toBe(false);
    });

    test('discards an entry by closing its pull request and deleting the branch', async ({
      cms,
      gitea,
      page,
    }) => {
      const branch = saveForkDraft(gitea, {
        slug: 'second-post',
        files: { 'content/posts/second-post.md': post('Second Post', 'Coming soon.') },
      });

      const pullRequest = openForkPullRequest(gitea, { slug: 'second-post', branch });
      const { oid: mainBefore } = gitea.head;

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
      await expect.poll(() => gitea.refs.has(gitea.forkBranch(branch))).toBe(false);
      expect(gitea.head.oid).toBe(mainBefore);
      await expect(page.getByRole('grid', { name: 'Entries' }).getByRole('row')).toHaveText([
        /First Post/,
      ]);
    });

    test('doesn’t let a contributor publish or delete a published entry', async ({
      cms,
      gitea,
      page,
    }) => {
      const branch = saveForkDraft(gitea, {
        slug: 'first-post',
        files: { 'content/posts/first-post.md': post('First Post', 'Hello again!') },
      });

      openForkPullRequest(gitea, { slug: 'first-post', branch });

      await cms.open();

      const editor = await openEntry(page, 'First Post');

      await expect(editor.getByRole('button', { name: 'Publish Entry' })).toHaveCount(0);
      await editor.getByRole('button', { name: 'Show Editor Options' }).click();
      // Only the pending changes can be thrown away, not the published entry
      await expect(page.getByRole('menuitem', { name: 'Discard Changes' })).toBeVisible();
      await expect(page.getByRole('menuitem', { name: 'Delete', exact: true })).toHaveCount(0);
    });

    test('doesn’t let a contributor upload to the media library', async ({ cms, page }) => {
      await cms.open();
      await page.getByRole('button', { name: 'Create Entry or Assets' }).click();
      await expect(page.getByRole('menuitem', { name: 'Assets' })).toBeDisabled();
      await page.keyboard.press('Escape');
      await page.getByRole('radio', { name: 'Assets' }).click();
      await expect(page.getByRole('button', { name: 'Upload New Assets' }).first()).toBeDisabled();
    });
  });
});
