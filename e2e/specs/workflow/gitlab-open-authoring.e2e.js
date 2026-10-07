import { post } from '../../fixtures/configs/workflow.js';
import { createPNG } from '../../fixtures/files.js';
import { expect, GITLAB_CONFIG, test } from '../../fixtures/test.js';

/**
 * @import { Locator, Page } from '@playwright/test';
 * @import { CMS } from '../../fixtures/test.js';
 * @import { MockGitLab } from '../../fixtures/gitlab.js';
 */

/**
 * The GitLab blog with Open Authoring turned on: a user who can’t push to the project works on a
 * fork of it instead. Set `gitlab.canWrite` to `false` to sign in as such a contributor.
 */
const OPEN_AUTHORING_CONFIG = {
  ...GITLAB_CONFIG,
  publish_mode: 'editorial_workflow',
  backend: { ...GITLAB_CONFIG.backend, open_authoring: true },
};

test.use({ config: OPEN_AUTHORING_CONFIG });

test.beforeEach(async ({ gitlab }) => {
  gitlab.commit({ 'content/posts/first-post.md': post('First Post', 'Hello, world!') });
});

/**
 * The branch the CMS saves the second post to in the contributor’s fork, without the owner prefix
 * {@link MockGitLab.refs} keys it with.
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
 * Save a post to a branch in the contributor’s fork the way the CMS does, on a
 * `cms/{owner}/{repo}/posts/{slug}` branch. The fork has to exist. Like the CMS, this opens no
 * merge request: the entry is a draft until the contributor sends it for review.
 * @param {MockGitLab} gitlab GitLab mock.
 * @param {object} args Arguments.
 * @param {string} args.slug Entry slug.
 * @param {Record<string, string | null>} args.files Files to commit to the branch.
 * @returns {string} Branch key in the mock, e.g. `mona:cms/mona/e2e-site/posts/{slug}`.
 */
const saveForkDraft = (gitlab, { slug, files }) => {
  const { login } = gitlab.user;
  const { repo } = /** @type {{ repo: string }} */ (gitlab.fork);
  const branch = gitlab.forkBranch(`cms/${login}/${repo}/posts/${slug}`);

  gitlab.createBranch(branch, gitlab.head.oid);
  gitlab.commit(files, { branch, author: gitlab.user, message: `Create Post “${slug}”` });

  return branch;
};

/**
 * Get the names of the branches in the project or in the fork that hold Editorial Workflow entries.
 * @param {MockGitLab} gitlab GitLab mock.
 * @returns {string[]} Branch keys, as {@link MockGitLab.refs} has them.
 */
const getWorkflowBranches = (gitlab) =>
  [...gitlab.refs.keys()].filter((key) => /^(\w+:)?cms\//.test(key));

test('keeps a maintainer working on the project', async ({ cms, gitlab, page }) => {
  await cms.open();
  await saveSecondPost(page);

  // A maintainer’s merge request is opened on the project, labelled and marked a draft in its title
  await expect
    .poll(() => gitlab.mergeRequests)
    .toMatchObject([
      {
        title: 'Draft: Create Post “second-post”',
        sourceBranch: 'cms/posts/second-post',
        sourceProjectId: gitlab.projectId,
        labels: ['sveltia-cms/draft'],
      },
    ]);
  expect(gitlab.fork).toBeUndefined();
  expect(getWorkflowBranches(gitlab)).toEqual(['cms/posts/second-post']);
  await expect(page.getByText(/Your changes are saved to your fork/)).toHaveCount(0);
});

test.describe('as a contributor', () => {
  test.beforeEach(({ gitlab }) => {
    gitlab.canWrite = false;
  });

  test('forks the project once the contributor agrees to it', async ({ cms, gitlab, page }) => {
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
    expect(gitlab.fork).toEqual({ owner: 'mona', repo: 'e2e-site' });
  });

  test('waits for a new fork to finish importing', async ({ cms, gitlab, page }) => {
    // GitLab copies the repository in the background and reports the progress as an import status
    gitlab.forkImportDelay = 2;

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
    expect(gitlab.forkPendingRequests).toBe(0);
  });

  test('stops when the contributor declines to fork the project', async ({ cms, gitlab, page }) => {
    await cms.open();
    await page
      .getByRole('alertdialog', { name: 'Fork Repository' })
      .getByRole('button', { name: 'Cancel' })
      .click();

    await expect(
      page.getByText('You need a fork of the repository on your account to suggest changes.'),
    ).toBeVisible();
    expect(gitlab.fork).toBeUndefined();
  });

  test('explains that the project doesn’t allow forks', async ({ cms, gitlab, page }) => {
    gitlab.allowForking = false;

    await cms.open();

    await expect(
      page.getByText(/The .*sveltia\/e2e-site.* repository doesn’t allow forks/),
    ).toBeVisible();
    await expect(page.getByRole('alertdialog', { name: 'Fork Repository' })).toHaveCount(0);
    expect(gitlab.fork).toBeUndefined();
  });

  test('finds a fork under another name', async ({ cms, gitlab, page }) => {
    gitlab.createFork({ repo: 'e2e-site-fork' });

    await cms.open();
    await expect(
      page.getByText(/Your changes are saved to your fork .*mona\/e2e-site-fork/),
    ).toBeVisible();
    await saveSecondPost(page);

    await expect
      .poll(() => getWorkflowBranches(gitlab))
      .toEqual([gitlab.forkBranch('cms/mona/e2e-site-fork/posts/second-post')]);
    await expect(page.getByRole('alertdialog', { name: 'Fork Repository' })).toHaveCount(0);
  });

  test('doesn’t let a contributor upload to the media library', async ({ cms, gitlab, page }) => {
    gitlab.createFork();

    await cms.open();
    await page.getByRole('button', { name: 'Create Entry or Assets' }).click();
    await expect(page.getByRole('menuitem', { name: 'Assets' })).toBeDisabled();
    await page.keyboard.press('Escape');
    await page.getByRole('radio', { name: 'Assets' }).click();
    await expect(page.getByRole('button', { name: 'Upload New Assets' }).first()).toBeDisabled();
  });

  test.describe('with a collection committing to the configured branch', () => {
    test.use({
      config: {
        ...OPEN_AUTHORING_CONFIG,
        collections: [{ ...OPEN_AUTHORING_CONFIG.collections[0], publish_mode: 'simple' }],
      },
    });

    test('saves an entry to the fork all the same', async ({ cms, gitlab, page }) => {
      gitlab.createFork();

      await cms.open();
      await page.getByRole('button', { name: 'Create Entry or Assets' }).click();
      await page.getByRole('menuitem', { name: 'Post', exact: true }).click();

      // A contributor can’t commit to the configured branch, so their change goes through a merge
      // request whatever the collection’s publish mode says
      const editor = page.getByRole('group', { name: 'Content Editor' });

      await editor.getByRole('textbox', { name: 'Title' }).fill('Second Post');
      await editor.getByRole('textbox', { name: 'Body' }).fill('Coming soon.');
      await editor.getByRole('button', { name: 'Save' }).click();
      await page
        .getByRole('alertdialog', { name: 'Send for Review' })
        .getByRole('button', { name: 'Later' })
        .click();

      await expect
        .poll(() =>
          gitlab.readFile('content/posts/second-post.md', gitlab.forkBranch(SECOND_POST_BRANCH)),
        )
        .toBe(post('Second Post', 'Coming soon.'));
      expect(gitlab.readFile('content/posts/second-post.md')).toBeUndefined();
    });
  });

  test.describe('with a fork', () => {
    test.beforeEach(({ gitlab }) => {
      gitlab.createFork();
    });

    test('saves a new entry to a branch in the fork without a merge request', async ({
      cms,
      gitlab,
      page,
    }) => {
      const { oid: mainBefore } = gitlab.head;

      await cms.open();
      await saveSecondPost(page);

      const branch = gitlab.forkBranch(SECOND_POST_BRANCH);

      await expect
        .poll(() => gitlab.readFile('content/posts/second-post.md', branch))
        .toBe(post('Second Post', 'Coming soon.'));
      // The branch is created in the fork, but from the configured project’s branch. The project
      // goes by its ID, as GitLab takes a path in the body as is: an encoded one names no project
      expect(gitlab.received[0]).toMatchObject({
        branch: SECOND_POST_BRANCH,
        start_branch: 'main',
        start_project: gitlab.projectId,
      });
      // Nothing reaches the project, and the maintainers aren’t bothered with a draft
      expect(getWorkflowBranches(gitlab)).toEqual([branch]);
      expect(gitlab.head.oid).toBe(mainBefore);
      expect(gitlab.mergeRequests).toEqual([]);
      await expect(page.getByRole('grid', { name: 'Entries' }).getByRole('row')).toHaveText([
        /Unpublished Entries/,
        /Second Post.*Draft/,
        /Published Entries/,
        /First Post/,
      ]);
    });

    test('starts a branch from the project rather than a fork that has moved on', async ({
      cms,
      gitlab,
      page,
    }) => {
      // GitLab has no way to bring a fork up to date, so the CMS leaves one that has drifted alone
      gitlab.commit({ 'notes.md': 'Mine.' }, { branch: gitlab.forkBranch('main') });
      gitlab.commit({ 'content/posts/third-post.md': post('Third Post', 'From Alex.') });

      await cms.open();

      await expect(page.getByRole('grid', { name: 'Entries' }).getByRole('row')).toHaveText([
        /First Post/,
        /Third Post/,
      ]);

      await saveSecondPost(page);

      const branch = gitlab.forkBranch(SECOND_POST_BRANCH);

      await expect
        .poll(() => gitlab.readFile('content/posts/second-post.md', branch))
        .toBe(post('Second Post', 'Coming soon.'));
      // The merge request holds the edited entry only, not the fork’s own commit
      expect(gitlab.readFile('content/posts/third-post.md', branch)).toBe(
        post('Third Post', 'From Alex.'),
      );
      expect(gitlab.readFile('notes.md', branch)).toBeUndefined();
    });

    test('saves again to the same branch in the fork', async ({ cms, gitlab, page }) => {
      await cms.open();
      await saveSecondPost(page);

      const branch = gitlab.forkBranch(SECOND_POST_BRANCH);

      await expect
        .poll(() => gitlab.readFile('content/posts/second-post.md', branch))
        .toBe(post('Second Post', 'Coming soon.'));

      const editor = await openEntry(page, 'Second Post');

      await editor.getByRole('textbox', { name: 'Body' }).fill('Almost there.');
      await editor.getByRole('button', { name: 'Save' }).click();
      await page
        .getByRole('alertdialog', { name: 'Send for Review' })
        .getByRole('button', { name: 'Later' })
        .click();

      await expect
        .poll(() => gitlab.readFile('content/posts/second-post.md', branch))
        .toBe(post('Second Post', 'Almost there.'));
      // The second commit goes onto the branch as it stands
      expect(gitlab.received[1]).not.toHaveProperty('start_branch');
      expect(getWorkflowBranches(gitlab)).toEqual([branch]);
      expect(gitlab.mergeRequests).toEqual([]);
    });

    test('warns before saving over a commit made to the fork branch', async ({
      cms,
      gitlab,
      page,
    }) => {
      // A contributor’s branch is theirs alone, but a maintainer can be allowed to push to it, and
      // the contributor can have the entry open in another tab. The branch head is on record even
      // for a draft with no merge request, and it’s read from the fork, where the branch lives
      const branch = saveForkDraft(gitlab, {
        slug: 'second-post',
        files: { 'content/posts/second-post.md': post('Second Post', 'Coming soon.') },
      });

      await cms.open();

      const editor = await openEntry(page, 'Second Post');

      gitlab.commit(
        { 'content/posts/second-post.md': post('Second Post', 'Edited elsewhere.') },
        { branch, author: gitlab.colleague },
      );

      await editor.getByRole('textbox', { name: 'Body' }).fill('Almost there.');
      await editor.getByRole('button', { name: 'Save' }).click();

      const dialog = page.getByRole('alertdialog', { name: 'Entry Changed by Someone Else' });

      await expect(dialog).toContainText('If you save now, their changes will be lost.');
      expect(gitlab.readFile('content/posts/second-post.md', branch)).toBe(
        post('Second Post', 'Edited elsewhere.'),
      );

      await dialog.getByRole('button', { name: 'Save Anyway' }).click();
      await page
        .getByRole('alertdialog', { name: 'Send for Review' })
        .getByRole('button', { name: 'Later' })
        .click();

      await expect
        .poll(() => gitlab.readFile('content/posts/second-post.md', branch))
        .toBe(post('Second Post', 'Almost there.'));
    });

    test('sends a draft for review with a merge request from the fork', async ({
      cms,
      gitlab,
      page,
    }) => {
      saveForkDraft(gitlab, {
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
        .poll(() => gitlab.mergeRequests)
        .toMatchObject([
          {
            title: 'Create Post “second-post”',
            sourceBranch: gitlab.forkBranch(SECOND_POST_BRANCH),
            // The merge request comes from the fork and targets the configured project
            sourceProjectId: gitlab.forkProjectId,
            targetBranch: 'main',
            state: 'opened',
            // A contributor can’t label a merge request on the configured project
            labels: [],
            author: gitlab.user,
          },
        ]);

      await changeStatus(cms, page, /Status: .*In Review/, 'Draft');

      // GitLab has no draft field, so the merge request is kept open with a `Draft: ` title
      await expect
        .poll(() => gitlab.mergeRequests[0])
        .toMatchObject({ state: 'opened', title: 'Draft: Create Post “second-post”' });
    });

    test('reopens a merge request closed on GitLab when the entry is sent for review again', async ({
      cms,
      gitlab,
      page,
    }) => {
      const branch = saveForkDraft(gitlab, {
        slug: 'second-post',
        files: { 'content/posts/second-post.md': post('Second Post', 'Coming soon.') },
      });

      const mergeRequest = gitlab.openMergeRequest({
        title: 'Create Post “second-post”',
        sourceBranch: branch,
        sourceProjectId: gitlab.forkProjectId,
        author: gitlab.user,
      });

      Object.assign(mergeRequest, { state: 'closed', lastHead: gitlab.refs.get(branch) });

      await cms.open();
      // A closed merge request leaves the entry a draft
      await openEntry(page, 'Second Post');
      await changeStatus(cms, page, /Status: .*Draft/, 'In Review');

      await expect.poll(() => mergeRequest.state).toBe('opened');
      expect(mergeRequest.title).toBe('Create Post “second-post”');
      expect(gitlab.mergeRequests).toHaveLength(1);
    });

    test('opens a new merge request when the known one was aimed elsewhere since', async ({
      cms,
      gitlab,
      page,
    }) => {
      const branch = saveForkDraft(gitlab, {
        slug: 'second-post',
        files: { 'content/posts/second-post.md': post('Second Post', 'Coming soon.') },
      });

      const mergeRequest = gitlab.openMergeRequest({
        title: 'Create Post “second-post”',
        sourceBranch: branch,
        sourceProjectId: gitlab.forkProjectId,
        author: gitlab.user,
      });

      Object.assign(mergeRequest, { state: 'closed', lastHead: gitlab.refs.get(branch) });

      await cms.open();
      await openEntry(page, 'Second Post');

      // Aimed at another branch on GitLab after the board was loaded. Reopening it would hand a
      // request for that branch to the maintainers as the entry’s review
      // @see https://github.com/sveltia/sveltia-cms/security/advisories/GHSA-8h97-74c4-g246
      gitlab.createBranch('develop', gitlab.head.oid);
      mergeRequest.targetBranch = 'develop';

      await changeStatus(cms, page, /Status: .*Draft/, 'In Review');

      await expect.poll(() => gitlab.mergeRequests).toHaveLength(2);
      expect(gitlab.mergeRequests[1]).toMatchObject({
        sourceBranch: branch,
        sourceProjectId: gitlab.forkProjectId,
        targetBranch: 'main',
        state: 'opened',
      });
      expect(mergeRequest).toMatchObject({ targetBranch: 'develop', state: 'closed' });
    });

    test('reports an entry published since the board was loaded instead of sending it for review', async ({
      cms,
      gitlab,
      page,
    }) => {
      const branch = saveForkDraft(gitlab, {
        slug: 'second-post',
        files: { 'content/posts/second-post.md': post('Second Post', 'Coming soon.') },
      });

      const mergeRequest = gitlab.openMergeRequest({
        title: 'Draft: Create Post “second-post”',
        sourceBranch: branch,
        sourceProjectId: gitlab.forkProjectId,
        author: gitlab.user,
      });

      await cms.open();
      // A draft merge request leaves the entry a draft
      await openEntry(page, 'Second Post');

      // A maintainer marks the merge request ready and merges it after the board was loaded, and
      // the contributor commits nothing to the branch since
      mergeRequest.title = 'Create Post “second-post”';
      gitlab.handleMerge(mergeRequest, { squash: false, merge_commit_message: mergeRequest.title });

      await changeStatus(cms, page, /Status: .*Draft/, 'In Review');

      await expect(page.getByRole('alert')).toContainText(
        'A maintainer has already published this entry, so there’s nothing left to review.',
      );
      // No merge request with nothing in it is opened, and the leftover branch is deleted the way
      // the next load would
      expect(gitlab.mergeRequests.map(({ state }) => state)).toEqual(['merged']);
      await expect.poll(() => gitlab.refs.has(branch)).toBe(false);
      // The editor closes onto the entry list, where the entry is published rather than a draft
      await expect(page.getByRole('group', { name: 'Content Editor' })).toBeHidden();
      await expect(page.getByRole('grid', { name: 'Entries' }).getByRole('row')).toHaveText([
        /First Post/,
        /^\s*Second Post\s*$/,
      ]);
    });

    test('lists the entries in progress on the fork', async ({ cms, gitlab, page }) => {
      saveForkDraft(gitlab, {
        slug: 'second-post',
        files: { 'content/posts/second-post.md': post('Second Post', 'Coming soon.') },
      });

      const inReview = saveForkDraft(gitlab, {
        slug: 'third-post',
        files: { 'content/posts/third-post.md': post('Third Post', 'Almost done.') },
      });

      gitlab.openMergeRequest({
        title: 'Create Post “third-post”',
        sourceBranch: inReview,
        sourceProjectId: gitlab.forkProjectId,
        author: gitlab.user,
      });

      await cms.open();
      await page.getByRole('radio', { name: 'Editorial Workflow' }).click();

      const board = page.getByRole('group', { name: 'Editorial Workflow' });

      await expect(board.getByRole('group', { name: 'Drafts' })).toContainText('Second Post');
      await expect(board.getByRole('group', { name: 'In Review' })).toContainText('Third Post');
      // A contributor can’t publish, so there’s no stage for an entry that’s ready to be
      await expect(board.getByRole('group', { name: 'Ready' })).toHaveCount(0);
    });

    test('takes over the merge request a long history pushed off the page', async ({
      cms,
      gitlab,
      page,
    }) => {
      const branch = saveForkDraft(gitlab, {
        slug: 'second-post',
        files: { 'content/posts/second-post.md': post('Second Post', 'Coming soon.') },
      });

      // The entry’s own merge request, taken back to the drafting stage at some point
      const mergeRequest = gitlab.openMergeRequest({
        title: 'Draft: Create Post “second-post”',
        sourceBranch: branch,
        sourceProjectId: gitlab.forkProjectId,
        author: gitlab.user,
      });

      // The page is ordered by creation, newest first, so an older merge request is the one that
      // falls off it
      Object.assign(mergeRequest, { createdAt: new Date('2026-01-01T00:00:00Z') });

      // A newer merge request of theirs, which is all the single page the CMS reads gets to. A
      // contributor with a long history in the project has more merge requests than fit in it
      gitlab.openMergeRequest({
        title: 'Fix a typo',
        sourceBranch: 'contributor:fix-typo',
        sourceProjectId: gitlab.forkProjectId,
        author: gitlab.user,
      });

      gitlab.mergeRequestPageSize = 1;

      await cms.open();

      // Its merge request wasn’t in the page, so the entry looks like a draft with none at all
      await openEntry(page, 'Second Post');
      await changeStatus(cms, page, /Status: .*Draft/, 'In Review');

      // GitLab refuses a second merge request from the branch, so the one already open is taken
      // over and handed to the maintainers instead of the contributor seeing the conflict
      await expect.poll(() => mergeRequest.title).toBe('Create Post “second-post”');
      expect(mergeRequest.state).toBe('opened');
      expect(gitlab.mergeRequests).toHaveLength(2);
    });

    test('ignores a merge request the contributor opened from another project', async ({
      cms,
      gitlab,
      page,
    }) => {
      const branch = saveForkDraft(gitlab, {
        slug: 'second-post',
        files: { 'content/posts/second-post.md': post('Second Post', 'Coming soon.') },
      });

      // A merge request of the contributor’s own, from a project that isn’t the fork, whose source
      // branch happens to carry the same name. Taking it for the fork’s would show the entry as
      // being in review and let the CMS act on a merge request holding someone else’s content
      // @see https://github.com/sveltia/sveltia-cms/security/advisories/GHSA-p8qh-54q9-2qjx
      const other = gitlab.openMergeRequest({
        title: 'Create Post “second-post”',
        // The branch lives in that other project, so it isn’t one of the fork’s refs
        sourceBranch: SECOND_POST_BRANCH,
        sourceProjectId: 99,
        author: gitlab.user,
      });

      await cms.open();

      // Still a draft, as the branch has no merge request of its own
      await expect(page.getByRole('grid', { name: 'Entries' }).getByRole('row')).toHaveText([
        /Unpublished Entries/,
        /Second Post.*Draft/,
        /Published Entries/,
        /First Post/,
      ]);

      await openEntry(page, 'Second Post');
      await changeStatus(cms, page, /Status: .*Draft/, 'In Review');

      // Sending it for review opens the contributor’s own merge request from the fork, rather than
      // reopening or relabelling the unrelated one
      await expect.poll(() => gitlab.mergeRequests.length).toBe(2);
      expect(gitlab.mergeRequests[1]).toMatchObject({
        sourceBranch: branch,
        sourceProjectId: gitlab.forkProjectId,
        state: 'opened',
      });
      // The unrelated one is left exactly as it was
      expect(other).toMatchObject({
        sourceProjectId: 99,
        state: 'opened',
        title: 'Create Post “second-post”',
      });
    });

    test('ignores a merge request the contributor opened to another branch', async ({
      cms,
      gitlab,
      page,
    }) => {
      const branch = saveForkDraft(gitlab, {
        slug: 'second-post',
        files: { 'content/posts/second-post.md': post('Second Post', 'Coming soon.') },
      });

      gitlab.createBranch('develop', gitlab.head.oid);

      // A merge request the contributor opened from the same fork branch to a branch the CMS
      // doesn’t manage. It isn’t the entry’s, so the CMS must leave it alone
      const decoy = gitlab.openMergeRequest({
        title: 'Tidy up the posts',
        sourceBranch: branch,
        sourceProjectId: gitlab.forkProjectId,
        targetBranch: 'develop',
        author: gitlab.user,
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
      await changeStatus(cms, page, /Status: .*Draft/, 'In Review');

      // Sending the entry for review opens a merge request of its own to the configured branch,
      // rather than reusing the decoy
      await expect.poll(() => gitlab.mergeRequests).toHaveLength(2);
      expect(gitlab.mergeRequests[1]).toMatchObject({
        title: 'Create Post “second-post”',
        sourceBranch: branch,
        sourceProjectId: gitlab.forkProjectId,
        targetBranch: 'main',
        state: 'opened',
      });
      expect(decoy).toMatchObject({ title: 'Tidy up the posts', state: 'opened' });
    });

    test('doesn’t take over a merge request someone else opened from the fork branch', async ({
      cms,
      gitlab,
      page,
    }) => {
      const branch = saveForkDraft(gitlab, {
        slug: 'second-post',
        files: { 'content/posts/second-post.md': post('Second Post', 'Coming soon.') },
      });

      // Someone the fork lets push opened a merge request from the contributor’s branch. Taking it
      // over would hand their request to the maintainers in the contributor’s name
      const decoy = gitlab.openMergeRequest({
        title: 'Draft: Tidy up the posts',
        sourceBranch: branch,
        sourceProjectId: gitlab.forkProjectId,
      });

      await cms.open();

      // It’s not the contributor’s, so the entry is still a draft
      await expect(page.getByRole('grid', { name: 'Entries' }).getByRole('row')).toHaveText([
        /Unpublished Entries/,
        /Second Post.*Draft/,
        /Published Entries/,
        /First Post/,
      ]);

      await openEntry(page, 'Second Post');
      await changeStatus(cms, page, /Status: .*Draft/, 'In Review');

      // GitLab refuses a second merge request from the branch, and the one in the way is left as
      // it was. Trying again wouldn’t help, so the contributor is told what’s in the way
      await expect(page.getByRole('alert')).toContainText(
        `Another request (\u2068!${decoy.iid}\u2069) is already open for this entry`,
      );
      expect(gitlab.mergeRequests).toHaveLength(1);
      expect(decoy).toMatchObject({ title: 'Draft: Tidy up the posts', state: 'opened' });
    });

    test('discards an entry by closing its merge request and deleting the branch', async ({
      cms,
      gitlab,
      page,
    }) => {
      const branch = saveForkDraft(gitlab, {
        slug: 'second-post',
        files: { 'content/posts/second-post.md': post('Second Post', 'Coming soon.') },
      });

      const mergeRequest = gitlab.openMergeRequest({
        title: 'Create Post “second-post”',
        sourceBranch: branch,
        sourceProjectId: gitlab.forkProjectId,
        author: gitlab.user,
      });

      const { oid: mainBefore } = gitlab.head;

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

      await expect.poll(() => mergeRequest.state).toBe('closed');
      // The branch goes from the fork, not from the configured project
      await expect.poll(() => gitlab.refs.has(branch)).toBe(false);
      expect(gitlab.head.oid).toBe(mainBefore);
      await expect(page.getByRole('grid', { name: 'Entries' }).getByRole('row')).toHaveText([
        /First Post/,
      ]);
    });

    test('doesn’t let a contributor delete a published entry', async ({ cms, gitlab, page }) => {
      const branch = saveForkDraft(gitlab, {
        slug: 'first-post',
        files: { 'content/posts/first-post.md': post('First Post', 'Hello again!') },
      });

      gitlab.openMergeRequest({
        title: 'Update Post “first-post”',
        sourceBranch: branch,
        sourceProjectId: gitlab.forkProjectId,
        author: gitlab.user,
      });

      await cms.open();

      const editor = await openEntry(page, 'First Post');

      await editor.getByRole('button', { name: 'Show Editor Options' }).click();
      // Only the pending changes can be thrown away, not the published entry
      await expect(page.getByRole('menuitem', { name: 'Discard Changes' })).toBeVisible();
      await expect(page.getByRole('menuitem', { name: 'Delete', exact: true })).toHaveCount(0);
    });

    test('deletes the branch of a merge request a maintainer has merged', async ({
      cms,
      gitlab,
      page,
    }) => {
      const branch = saveForkDraft(gitlab, {
        slug: 'second-post',
        files: { 'content/posts/second-post.md': post('Second Post', 'Coming soon.') },
      });

      const mergeRequest = gitlab.openMergeRequest({
        title: 'Create Post “second-post”',
        sourceBranch: branch,
        sourceProjectId: gitlab.forkProjectId,
        author: gitlab.user,
      });

      gitlab.handleMerge(mergeRequest, { squash: false, merge_commit_message: mergeRequest.title });

      await cms.open();

      await expect(page.getByRole('grid', { name: 'Entries' }).getByRole('row')).toHaveText([
        /First Post/,
        /Second Post/,
      ]);
      await expect.poll(() => gitlab.refs.has(branch)).toBe(false);
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

      test('saves an image attached to an entry to the fork', async ({ cms, gitlab, page }) => {
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

        const branch = gitlab.forkBranch(SECOND_POST_BRANCH);

        await expect
          .poll(() => gitlab.readFile('content/posts/second-post.md', branch))
          .toMatch(/cover: \/images\/sunrise\.png/);
        expect(
          gitlab.blobs.get(gitlab.getHead(branch).tree.get('static/images/sunrise.png') ?? ''),
        ).toEqual(image);
        expect(gitlab.head.tree.has('static/images/sunrise.png')).toBe(false);

        // The image is read back from the fork when the entry is opened again
        await openEntry(page, 'Second Post');
        await expect(editor.getByRole('button', { name: 'Remove Image' })).toBeVisible();
      });
    });
  });
});
