import { OPEN_AUTHORING_CONFIG, post, saveForkDraft } from '../../fixtures/configs/workflow.js';
import { createPNG } from '../../fixtures/files.js';
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

  test('waits for a new fork to be ready before using it', async ({ cms, github, page }) => {
    // GitHub copies the repository in the background, so the fork isn’t there right away
    github.forkDelay = 2;

    await cms.open();
    await page
      .getByRole('alertdialog', { name: 'Fork Repository' })
      .getByRole('button', { name: 'Fork' })
      .click();

    await expect(page.getByText(/Your changes are saved to your fork/)).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByRole('grid', { name: 'Entries' }).getByRole('row')).toHaveText([
      /First Post/,
    ]);
    expect(github.forkPendingRequests).toBe(0);
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

  test('finds a fork under another name', async ({ cms, github, page }) => {
    github.createFork({ repo: 'e2e-site-fork' });

    await cms.open();
    await expect(
      page.getByText(/Your changes are saved to your fork .*mona\/e2e-site-fork/),
    ).toBeVisible();
    await saveSecondPost(page);

    await expect
      .poll(() => getWorkflowBranches(github))
      .toEqual([github.forkBranch('cms/mona/e2e-site-fork/posts/second-post')]);
    await expect(page.getByRole('alertdialog', { name: 'Fork Repository' })).toHaveCount(0);
  });

  test('doesn’t let a contributor upload to the media library', async ({ cms, github, page }) => {
    github.createFork();

    await cms.open();
    await page.getByRole('button', { name: 'Create Entry or Assets' }).click();
    await expect(page.getByRole('menuitem', { name: 'Assets' })).toBeDisabled();
    await page.keyboard.press('Escape');
    await page.getByRole('radio', { name: 'Assets' }).click();
    await expect(page.getByRole('button', { name: 'Upload New Assets' }).first()).toBeDisabled();
  });

  test.describe('who can’t read the repository', () => {
    test.beforeEach(({ github }) => {
      github.canRead = false;
    });

    test('says they have no access', async ({ cms, github, page }) => {
      await cms.open();

      await expect(
        page.getByText(/You don’t have access to the .*sveltia\/e2e-site.* repository/),
      ).toBeVisible();
      expect(github.fork).toBeUndefined();
    });

    test('points out a pending invitation', async ({ cms, github, page }) => {
      github.invitations = ['sveltia/e2e-site'];

      await cms.open();

      await expect(
        page.getByText(/You have a pending invitation to the .*sveltia\/e2e-site.* repository/),
      ).toBeVisible();
    });

    test('points out a sign-in without access to private repositories', async ({
      cms,
      github,
      page,
    }) => {
      github.scopes = 'public_repo, read:user';

      await cms.open();

      await expect(
        page.getByText(/Your sign-in doesn’t include access to private repositories/),
      ).toBeVisible();
    });
  });

  test('doesn’t take a rate limit for a lack of write access', async ({ cms, github, page }) => {
    github.rateLimited = true;

    await cms.open();

    await expect(
      page.getByText(/Couldn’t check your access to the .*sveltia\/e2e-site.* repository/),
    ).toBeVisible();
    await expect(page.getByRole('alertdialog', { name: 'Fork Repository' })).toHaveCount(0);
    expect(github.fork).toBeUndefined();
  });

  test.describe('with a fork', () => {
    test.beforeEach(({ github }) => {
      github.createFork();
    });

    test.describe('with an image field', () => {
      test.use({
        config: {
          ...OPEN_AUTHORING_CONFIG,
          collections: [
            {
              ...OPEN_AUTHORING_CONFIG.collections[0],
              fields: [
                ...OPEN_AUTHORING_CONFIG.collections[0].fields,
                { name: 'cover', label: 'Cover', widget: 'image', required: false },
              ],
            },
          ],
        },
      });

      test('saves an image attached to an entry to the fork', async ({ cms, github, page }) => {
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

        const branch = github.forkBranch(SECOND_POST_BRANCH);

        await expect
          .poll(() => github.readFile('content/posts/second-post.md', branch))
          .toMatch(/cover: \/images\/sunrise\.png/);
        expect(
          github.blobs.get(github.getHead(branch).tree.get('static/images/sunrise.png') ?? ''),
        ).toEqual(image);
        expect(github.head.tree.has('static/images/sunrise.png')).toBe(false);

        // The image is read back from the fork when the entry is opened again
        await openEntry(page, 'Second Post');
        await expect(editor.getByRole('button', { name: 'Remove Image' })).toBeVisible();
      });
    });

    test.describe('with an `openAuthoring` commit message', () => {
      test.use({
        config: {
          ...OPEN_AUTHORING_CONFIG,
          backend: {
            ...OPEN_AUTHORING_CONFIG.backend,
            commit_messages: { openAuthoring: '{{message}} (from @{{author-login}})' },
          },
        },
      });

      test('wraps the message of a commit to the fork', async ({ cms, github, page }) => {
        await cms.open();
        await saveSecondPost(page);

        await expect
          .poll(() => github.getHead(github.forkBranch(SECOND_POST_BRANCH)).message)
          .toBe('Create Post “second-post” (from @mona)');
      });
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

    test('starts a branch from the repository rather than a fork that has moved on', async ({
      cms,
      github,
      page,
    }) => {
      // The fork has a commit of its own, so it can’t be brought up to date
      github.commit({ 'notes.md': 'Mine.' }, { branch: github.forkBranch('main') });
      github.commit({ 'content/posts/third-post.md': post('Third Post', 'From Alex.') });

      await cms.open();

      await expect(page.getByRole('grid', { name: 'Entries' }).getByRole('row')).toHaveText([
        /First Post/,
        /Third Post/,
      ]);
      expect(github.readFile('content/posts/third-post.md', github.forkBranch('main'))).toBe(
        undefined,
      );

      await saveSecondPost(page);

      const branch = github.forkBranch(SECOND_POST_BRANCH);

      await expect
        .poll(() => github.readFile('content/posts/second-post.md', branch))
        .toBe(post('Second Post', 'Coming soon.'));
      expect(github.readFile('content/posts/third-post.md', branch)).toBe(
        post('Third Post', 'From Alex.'),
      );
      expect(github.readFile('notes.md', branch)).toBeUndefined();
    });

    test('saves again to the same branch in the fork', async ({ cms, github, page }) => {
      await cms.open();
      await saveSecondPost(page);

      const branch = github.forkBranch(SECOND_POST_BRANCH);

      await expect
        .poll(() => github.readFile('content/posts/second-post.md', branch))
        .toBe(post('Second Post', 'Coming soon.'));

      const editor = await openEntry(page, 'Second Post');

      await editor.getByRole('textbox', { name: 'Body' }).fill('Almost there.');
      await editor.getByRole('button', { name: 'Save' }).click();
      await page
        .getByRole('alertdialog', { name: 'Send for Review' })
        .getByRole('button', { name: 'Later' })
        .click();

      await expect
        .poll(() => github.readFile('content/posts/second-post.md', branch))
        .toBe(post('Second Post', 'Almost there.'));
      expect(getWorkflowBranches(github)).toEqual([branch]);
      expect(github.pullRequests).toEqual([]);
    });

    test('warns before saving over a commit made to the fork branch', async ({
      cms,
      github,
      page,
    }) => {
      // A contributor’s branch is theirs alone, but a maintainer can be allowed to push to it, and
      // the contributor can have the entry open in another tab. The branch head is on record even
      // for a draft with no pull request, so the save notices
      const branch = saveForkDraft(github, {
        slug: 'second-post',
        files: { 'content/posts/second-post.md': post('Second Post', 'Coming soon.') },
      });

      await cms.open();

      const editor = await openEntry(page, 'Second Post');

      github.commit(
        { 'content/posts/second-post.md': post('Second Post', 'Edited elsewhere.') },
        { branch, author: github.colleague },
      );

      await editor.getByRole('textbox', { name: 'Body' }).fill('Almost there.');
      await editor.getByRole('button', { name: 'Save' }).click();

      const dialog = page.getByRole('alertdialog', { name: 'Entry Changed by Someone Else' });

      await expect(dialog).toContainText('If you save now, their changes will be lost.');
      expect(github.readFile('content/posts/second-post.md', branch)).toBe(
        post('Second Post', 'Edited elsewhere.'),
      );

      await dialog.getByRole('button', { name: 'Save Anyway' }).click();
      await page
        .getByRole('alertdialog', { name: 'Send for Review' })
        .getByRole('button', { name: 'Later' })
        .click();

      await expect
        .poll(() => github.readFile('content/posts/second-post.md', branch))
        .toBe(post('Second Post', 'Almost there.'));
    });

    test('sends a new entry for review right after saving it', async ({ cms, github, page }) => {
      await cms.open();
      await page.getByRole('button', { name: 'Create New Entry' }).first().click();

      const editor = page.getByRole('group', { name: 'Content Editor' });

      await editor.getByRole('textbox', { name: 'Title' }).fill('Second Post');
      await editor.getByRole('textbox', { name: 'Body' }).fill('Coming soon.');
      await editor.getByRole('button', { name: 'Save' }).click();
      await page
        .getByRole('alertdialog', { name: 'Send for Review' })
        .getByRole('button', { name: 'Send for Review' })
        .click();

      await expect
        .poll(() => github.pullRequests)
        .toMatchObject([
          { head: github.forkBranch(SECOND_POST_BRANCH), state: 'open', draft: false, labels: [] },
        ]);
      await expect(page.getByRole('grid', { name: 'Entries' }).getByRole('row')).toHaveText([
        /Unpublished Entries/,
        /Second Post.*In Review/,
        /Published Entries/,
        /First Post/,
      ]);
    });

    test('reopens a pull request closed on GitHub when the entry is sent for review again', async ({
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

      Object.assign(pullRequest, { state: 'closed', lastHead: github.refs.get(branch) });

      await cms.open();
      // A closed pull request leaves the entry a draft
      await openEntry(page, 'Second Post');
      await cms.chooseMenuItem(
        page.getByRole('button', { name: /Status: .*Draft/ }),
        page.getByRole('menuitemradio', { name: 'In Review' }),
      );

      await expect.poll(() => pullRequest.state).toBe('open');
      expect(pullRequest.draft).toBe(false);
      expect(github.pullRequests).toHaveLength(1);
    });

    test('opens a new pull request when the known one was aimed elsewhere since', async ({
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

      Object.assign(pullRequest, { state: 'closed', lastHead: github.refs.get(branch) });

      await cms.open();
      await openEntry(page, 'Second Post');

      // Aimed at another branch on GitHub after the board was loaded. Reopening it would hand a
      // request for that branch to the maintainers as the entry’s review
      // @see https://github.com/sveltia/sveltia-cms/security/advisories/GHSA-8h97-74c4-g246
      github.createBranch('develop', github.head.oid);
      pullRequest.base = 'develop';

      await cms.chooseMenuItem(
        page.getByRole('button', { name: /Status: .*Draft/ }),
        page.getByRole('menuitemradio', { name: 'In Review' }),
      );

      await expect.poll(() => github.pullRequests).toHaveLength(2);
      expect(github.pullRequests[1]).toMatchObject({
        head: branch,
        base: 'main',
        state: 'open',
        draft: false,
        author: github.user,
      });
      expect(pullRequest).toMatchObject({ base: 'develop', state: 'closed' });
    });

    test('treats a branch changed after its pull request was merged as a new draft', async ({
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
      github.commit(
        { 'content/posts/second-post.md': post('Second Post', 'Now with more.') },
        { branch, author: github.user },
      );

      await cms.open();

      // The published entry has a draft again, which stands in for it
      await expect(page.getByRole('grid', { name: 'Entries' }).getByRole('row')).toHaveText([
        /First Post/,
        /Second Post.*Draft/,
      ]);
      await openEntry(page, 'Second Post');
      await cms.chooseMenuItem(
        page.getByRole('button', { name: /Status: .*Draft/ }),
        page.getByRole('menuitemradio', { name: 'In Review' }),
      );

      // A new pull request, rather than an attempt to reopen the merged one
      await expect
        .poll(() => github.pullRequests.map(({ state }) => state))
        .toEqual(['merged', 'open']);
      expect(github.refs.has(branch)).toBe(true);
    });

    test('reports an entry published since the board was loaded instead of sending it for review', async ({
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
        draft: true,
        author: github.user,
      });

      await cms.open();
      // A draft pull request leaves the entry a draft
      await openEntry(page, 'Second Post');

      // A maintainer marks the pull request ready and merges it after the board was loaded, and
      // the contributor commits nothing to the branch since
      pullRequest.draft = false;
      github.mergePullRequest(pullRequest);

      await cms.chooseMenuItem(
        page.getByRole('button', { name: /Status: .*Draft/ }),
        page.getByRole('menuitemradio', { name: 'In Review' }),
      );

      await expect(page.getByRole('alert')).toContainText(
        'A maintainer has already published this entry, so there’s nothing left to review.',
      );
      // No pull request with nothing in it is opened, and the leftover branch is deleted the way
      // the next load would
      expect(github.pullRequests.map(({ state }) => state)).toEqual(['merged']);
      await expect.poll(() => github.refs.has(branch)).toBe(false);
      // The editor closes onto the entry list, where the entry is published rather than a draft
      await expect(page.getByRole('group', { name: 'Content Editor' })).toBeHidden();
      await expect(page.getByRole('grid', { name: 'Entries' }).getByRole('row')).toHaveText([
        /First Post/,
        /^\s*Second Post\s*$/,
      ]);
    });

    test('keeps unsaved changes to an entry published since the board was loaded', async ({
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
        draft: true,
        author: github.user,
      });

      await cms.open();

      const editor = await openEntry(page, 'Second Post');

      pullRequest.draft = false;
      github.mergePullRequest(pullRequest);

      // Changed but not saved: the status menu doesn’t wait for a save
      await editor.getByRole('textbox', { name: 'Body' }).fill('Now with more.');
      await cms.chooseMenuItem(
        page.getByRole('button', { name: /Status: .*Draft/ }),
        page.getByRole('menuitemradio', { name: 'In Review' }),
      );

      await expect(page.getByRole('alert')).toContainText(
        'A maintainer has already published this entry, so there’s nothing left to review.',
      );
      // The editor stays open with the change, which then saves as a new draft of the entry
      await expect(editor.getByRole('textbox', { name: 'Body' })).toHaveValue('Now with more.');
      await expect.poll(() => github.refs.has(branch)).toBe(false);
      await editor.getByRole('button', { name: 'Save' }).click();
      await page
        .getByRole('alertdialog', { name: 'Send for Review' })
        .getByRole('button', { name: 'Later' })
        .click();

      await expect.poll(() => github.refs.has(branch)).toBe(true);
      expect(github.pullRequests.map(({ state }) => state)).toEqual(['merged']);
      expect(github.readFile('content/posts/second-post.md', branch)).toContain('Now with more.');
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

    test('ignores a pull request the contributor opened to another branch', async ({
      cms,
      github,
      page,
    }) => {
      const branch = saveForkDraft(github, {
        slug: 'second-post',
        files: { 'content/posts/second-post.md': post('Second Post', 'Coming soon.') },
      });

      github.createBranch('develop', github.head.oid);

      // A pull request the contributor opened from the same fork branch to a branch the CMS doesn’t
      // manage. It isn’t the entry’s, so the CMS must leave it alone
      const decoy = github.openPullRequest({
        title: 'Tidy up the posts',
        head: branch,
        base: 'develop',
        author: github.user,
      });

      await cms.open();

      // The entry is still a draft, rather than being taken for one in review
      await expect(page.getByRole('grid', { name: 'Entries' }).getByRole('row')).toHaveText([
        /Unpublished Entries/,
        /Second Post.*Draft/,
        /Published Entries/,
        /First Post/,
      ]);

      await openEntry(page, 'Second Post');
      await cms.chooseMenuItem(
        page.getByRole('button', { name: /Status: .*Draft/ }),
        page.getByRole('menuitemradio', { name: 'In Review' }),
      );

      // Sending the entry for review opens a pull request of its own to the configured branch,
      // rather than reusing the decoy
      await expect.poll(() => github.pullRequests).toHaveLength(2);
      expect(github.pullRequests[1]).toMatchObject({
        title: 'Create Post “second-post”',
        head: branch,
        base: 'main',
        state: 'open',
        draft: false,
      });
      expect(decoy).toMatchObject({ title: 'Tidy up the posts', state: 'open', draft: false });
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
