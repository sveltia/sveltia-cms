import { post } from '../../fixtures/configs/workflow.js';
import { expect, GITEA_CONFIG, test } from '../../fixtures/test.js';

/**
 * @import { Locator, Page } from '@playwright/test';
 * @import { CMS } from '../../fixtures/test.js';
 * @import { MockGitea, MockPullRequest } from '../../fixtures/gitea.js';
 */

/**
 * The Gitea blog with Editorial Workflow: saving an entry commits it to a branch of its own and
 * opens a pull request, which is merged when the entry is published.
 */
const GITEA_WORKFLOW_CONFIG = { ...GITEA_CONFIG, publish_mode: 'editorial_workflow' };

test.use({ config: GITEA_WORKFLOW_CONFIG });

test.beforeEach(async ({ gitea }) => {
  gitea.commit({ 'content/posts/first-post.md': post('First Post', 'Hello, world!') });
});

/**
 * Open a pull request for a post the way the CMS does: on a `cms/posts/{slug}` branch, with a
 * status label, and a `WIP: ` title prefix while the entry is a draft. Unlike GitHub and GitLab,
 * the instance has no draft flag — it reads the prefix.
 * @param {MockGitea} gitea Gitea mock.
 * @param {object} args Arguments.
 * @param {string} args.slug Entry slug.
 * @param {Record<string, string | null>} args.files Files to commit to the branch.
 * @param {string} [args.status] Workflow status.
 * @returns {MockPullRequest} Pull request.
 */
const openEntryPullRequest = (gitea, { slug, files, status = 'draft' }) => {
  const branch = `cms/posts/${slug}`;
  const title = `Update Post “${slug}”`;

  gitea.createBranch(branch, gitea.head.oid);
  gitea.commit(files, { branch, author: gitea.user, message: title });

  return gitea.openPullRequest(
    { title: status === 'draft' ? `WIP: ${title}` : title, headBranch: branch },
    { labels: [`sveltia-cms/${status}`], author: gitea.user },
  );
};

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
 * Save the entry, and keep it a draft rather than sending it for review.
 * @param {Page} page Page.
 * @param {Locator} editor Editor.
 */
const saveDraft = async (page, editor) => {
  await editor.getByRole('button', { name: 'Save' }).click();
  await page
    .getByRole('alertdialog', { name: 'Send for Review' })
    .getByRole('button', { name: 'Later' })
    .click();
};

/**
 * Publish the entry open in the editor.
 * @param {Page} page Page.
 * @param {Locator} editor Editor.
 */
const publish = async (page, editor) => {
  await editor.getByRole('button', { name: 'Publish Entry' }).click();
  await page
    .getByRole('alertdialog', { name: 'Publish Entry' })
    .getByRole('button', { name: 'Publish' })
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

test('saves a new entry to a branch and opens a work-in-progress pull request', async ({
  cms,
  gitea,
  page,
}) => {
  const { oid: mainBefore } = gitea.head;

  await cms.open();
  await page.getByRole('button', { name: 'Create New Entry' }).first().click();

  const editor = page.getByRole('group', { name: 'Content Editor' });

  await editor.getByRole('textbox', { name: 'Title' }).fill('Second Post');
  await editor.getByRole('textbox', { name: 'Body' }).fill('Coming soon.');
  await saveDraft(page, editor);

  await expect
    .poll(() => gitea.pullRequests)
    .toMatchObject([
      {
        // There’s no draft flag, so the stage is marked in the title
        title: 'WIP: Create Post “second-post”',
        headBranch: 'cms/posts/second-post',
        baseBranch: 'main',
        state: 'open',
        labels: ['sveltia-cms/draft'],
      },
    ]);
  // The commit creates the branch from the configured one, rather than asking for it separately
  expect(gitea.received[0]).toMatchObject({
    branch: 'main',
    new_branch: 'cms/posts/second-post',
  });
  expect(gitea.readFile('content/posts/second-post.md', 'cms/posts/second-post')).toBe(
    post('Second Post', 'Coming soon.'),
  );
  // Nothing is published yet
  expect(gitea.head.oid).toBe(mainBefore);
  await expect(page.getByRole('grid', { name: 'Entries' }).getByRole('row')).toContainText([
    /Second Post.*Draft/,
  ]);
});

test('creates the status label the instance doesn’t have yet', async ({ cms, gitea, page }) => {
  // Unlike GitHub and GitLab, the instance silently drops a label name it doesn’t know rather than
  // creating it, so the CMS has to define it before it sticks
  expect(gitea.labels).toEqual([]);

  await cms.open();
  await page.getByRole('button', { name: 'Create New Entry' }).first().click();

  const editor = page.getByRole('group', { name: 'Content Editor' });

  await editor.getByRole('textbox', { name: 'Title' }).fill('Second Post');
  await editor.getByRole('textbox', { name: 'Body' }).fill('Coming soon.');
  await saveDraft(page, editor);

  await expect.poll(() => gitea.pullRequests[0]?.labels).toEqual(['sveltia-cms/draft']);
  expect(gitea.labels.map(({ name }) => name)).toContain('sveltia-cms/draft');
});

test('saves changes to a published entry to one pull request', async ({ cms, gitea, page }) => {
  await cms.open();

  const editor = await openEntry(page, 'First Post');

  await editor.getByRole('textbox', { name: 'Body' }).fill('Hello again!');
  await saveDraft(page, editor);
  await expect
    .poll(() => gitea.readFile('content/posts/first-post.md', 'cms/posts/first-post'))
    .toBe(post('First Post', 'Hello again!'));

  // Another save goes to the same branch and pull request
  await openEntry(page, 'First Post');
  await editor.getByRole('textbox', { name: 'Body' }).fill('Hello once more!');
  await saveDraft(page, editor);

  await expect
    .poll(() => gitea.readFile('content/posts/first-post.md', 'cms/posts/first-post'))
    .toBe(post('First Post', 'Hello once more!'));
  // The branch is there now, so the commit lands on it rather than creating it
  expect(gitea.received[1]).not.toHaveProperty('new_branch');
  expect(gitea.pullRequests).toHaveLength(1);
  // Still published as it was
  expect(gitea.readFile('content/posts/first-post.md')).toBe(post('First Post', 'Hello, world!'));
});

test('moves an entry through the review stages', async ({ cms, gitea, page }) => {
  const pullRequest = openEntryPullRequest(gitea, {
    slug: 'second-post',
    files: { 'content/posts/second-post.md': post('Second Post', 'Coming soon.') },
  });

  await cms.open();
  await openEntry(page, 'Second Post');

  // A draft is marked in the title, which the CMS strips when it reads it
  await changeStatus(cms, page, /Status: .*Draft/, 'In Review');
  await expect
    .poll(() => ({ labels: pullRequest.labels, title: pullRequest.title }))
    .toEqual({ labels: ['sveltia-cms/pending_review'], title: 'Update Post “second-post”' });

  await changeStatus(cms, page, /Status: .*In Review/, 'Ready');
  await expect.poll(() => pullRequest.labels).toEqual(['sveltia-cms/pending_publish']);

  await changeStatus(cms, page, /Status: .*Ready/, 'Draft');
  await expect
    .poll(() => ({ labels: pullRequest.labels, title: pullRequest.title }))
    .toEqual({ labels: ['sveltia-cms/draft'], title: 'WIP: Update Post “second-post”' });
});

test('keeps the other labels of a pull request', async ({ cms, gitea, page }) => {
  const pullRequest = openEntryPullRequest(gitea, {
    slug: 'second-post',
    files: { 'content/posts/second-post.md': post('Second Post', 'Coming soon.') },
  });

  gitea.createLabel('documentation');
  pullRequest.labels.push('documentation');

  await cms.open();
  await openEntry(page, 'Second Post');
  await changeStatus(cms, page, /Status: .*Draft/, 'In Review');

  await expect
    .poll(() => pullRequest.labels)
    .toEqual(['documentation', 'sveltia-cms/pending_review']);
});

test('lists entries in every status on the board', async ({ cms, gitea, page }) => {
  // Each status has a label of its own, and a pull request carries one of them. The instance’s
  // issue filter would only match an item carrying all the labels it’s given, which none does
  openEntryPullRequest(gitea, {
    slug: 'second-post',
    files: { 'content/posts/second-post.md': post('Second Post', 'Coming soon.') },
  });
  openEntryPullRequest(gitea, {
    slug: 'third-post',
    files: { 'content/posts/third-post.md': post('Third Post', 'Coming later.') },
    status: 'pending_review',
  });
  openEntryPullRequest(gitea, {
    slug: 'fourth-post',
    files: { 'content/posts/fourth-post.md': post('Fourth Post', 'Coming last.') },
    status: 'pending_publish',
  });

  await cms.open();

  await expect(page.getByRole('grid', { name: 'Entries' }).getByRole('row')).toHaveText([
    /Unpublished Entries/,
    /Fourth Post.*Ready/,
    /Second Post.*Draft/,
    /Third Post.*In Review/,
    /Published Entries/,
    /First Post/,
  ]);
});

test('shows the content of the commit a publish is pinned to', async ({ cms, gitea, page }) => {
  const pullRequest = openEntryPullRequest(gitea, {
    slug: 'second-post',
    files: { 'content/posts/second-post.md': post('Second Post', 'Unreviewed text.') },
    status: 'pending_publish',
  });

  const unreviewed = /** @type {string} */ (gitea.refs.get('cms/posts/second-post'));
  const handleREST = gitea.handleREST.bind(gitea);

  /**
   * Answer a request, then push to the branch once the CMS has read the pull request’s head
   * commit, while the board is still loading.
   * @type {typeof gitea.handleREST}
   */
  const handleWithPush = (method, pathname, ...args) => {
    const response = handleREST(method, pathname, ...args);

    if (method === 'GET' && pathname.endsWith(`/pulls/${pullRequest.number}`)) {
      gitea.handleREST = handleREST;
      gitea.commit(
        { 'content/posts/second-post.md': post('Second Post', 'Benign text.') },
        { branch: 'cms/posts/second-post' },
      );
    }

    return response;
  };

  // Someone with push access swaps the branch between two commits, hoping the board shows the
  // benign one while the commit on record, which a publish is pinned to, is the other
  gitea.handleREST = handleWithPush;

  await cms.open();

  const editor = await openEntry(page, 'Second Post');

  await expect(editor.getByRole('textbox', { name: 'Body' })).toHaveValue('Benign text.');

  // The branch is pushed back to the commit nobody saw. Publishing is refused, because the commit
  // on record is the one shown
  gitea.refs.set('cms/posts/second-post', unreviewed);
  await publish(page, editor);
  await expect(page.getByRole('alert')).toContainText(
    'The entry has been changed since you opened it.',
  );
  expect(pullRequest.merged).toBe(false);
  expect(gitea.readFile('content/posts/second-post.md')).toBeUndefined();
});

test('shows a pull request as of the commit its file list describes', async ({
  cms,
  gitea,
  page,
}) => {
  const pullRequest = openEntryPullRequest(gitea, {
    slug: 'second-post',
    files: { 'content/posts/second-post.md': post('Second Post', 'Reviewed text.') },
    status: 'pending_publish',
  });

  // A push that also replaces an image, which the instance hasn’t caught up with: the file list
  // still describes the commit before it. Showing that list with the content of the new commit,
  // and publishing the new commit, would merge an image nobody saw
  pullRequest.laggingRefSHA = gitea.refs.get('cms/posts/second-post');
  gitea.commit(
    {
      'content/posts/second-post.md': post('Second Post', 'Unreviewed text.'),
      'static/images/logo.svg': '<svg onload="alert(1)"/>',
    },
    { branch: 'cms/posts/second-post' },
  );

  await cms.open();

  const editor = await openEntry(page, 'Second Post');

  // The board shows the commit the list describes, throughout
  await expect(editor.getByRole('textbox', { name: 'Body' })).toHaveValue('Reviewed text.');

  // Which isn’t the one the branch points at, so it can’t be published until the board is reloaded
  await publish(page, editor);
  await expect(page.getByRole('alert')).toContainText(
    'The entry has been changed since you opened it.',
  );
  expect(pullRequest.merged).toBe(false);
  expect(gitea.readFile('static/images/logo.svg')).toBeUndefined();
});

test('refuses to save onto a branch whose file list trails it', async ({ cms, gitea, page }) => {
  const pullRequest = openEntryPullRequest(gitea, {
    slug: 'second-post',
    files: { 'content/posts/second-post.md': post('Second Post', 'Reviewed text.') },
    status: 'pending_publish',
  });

  // A push that also replaces an image, which the instance hasn’t caught up with, so the board
  // shows the commit before it. Saving on top of the branch would vouch for the image unseen,
  // and a publish afterwards would merge it
  pullRequest.laggingRefSHA = gitea.refs.get('cms/posts/second-post');
  gitea.commit(
    { 'static/images/logo.svg': '<svg onload="alert(1)"/>' },
    { branch: 'cms/posts/second-post' },
  );

  const branchHead = gitea.refs.get('cms/posts/second-post');

  await cms.open();

  const editor = await openEntry(page, 'Second Post');

  await editor.getByRole('textbox', { name: 'Body' }).fill('Fixed a typo.');
  await editor.getByRole('button', { name: 'Save' }).click();

  await expect(page.getByRole('alertdialog', { name: 'Error' })).toContainText(
    'The repository has been updated by someone else while saving. Please try again.',
  );
  expect(gitea.refs.get('cms/posts/second-post')).toBe(branchHead);
  expect(pullRequest.merged).toBe(false);
});

test('publishes an entry by merging its pull request and deleting the branch', async ({
  cms,
  gitea,
  page,
}) => {
  const pullRequest = openEntryPullRequest(gitea, {
    slug: 'second-post',
    files: { 'content/posts/second-post.md': post('Second Post', 'Coming soon.') },
    status: 'pending_publish',
  });

  await cms.open();

  const editor = await openEntry(page, 'Second Post');

  await publish(page, editor);

  await expect.poll(() => pullRequest.merged).toBe(true);
  expect(gitea.readFile('content/posts/second-post.md')).toBe(post('Second Post', 'Coming soon.'));
  // The branch is tidied up once the merge has landed
  await expect.poll(() => gitea.refs.has('cms/posts/second-post')).toBe(false);
});

test('takes a pull request merged on the instance as published', async ({ cms, gitea, page }) => {
  const pullRequest = openEntryPullRequest(gitea, {
    slug: 'second-post',
    files: { 'content/posts/second-post.md': post('Second Post', 'Coming soon.') },
    status: 'pending_publish',
  });

  await cms.open();

  const editor = await openEntry(page, 'Second Post');

  // A maintainer merges it on the instance while this board is open
  gitea.mergePullRequest(pullRequest);

  await publish(page, editor);

  // The entry is live, so publishing carries on rather than reporting a failure: the branch is
  // tidied up and the entry is listed as published rather than kept on the board
  await expect.poll(() => gitea.refs.has('cms/posts/second-post')).toBe(false);
  await expect(page.getByRole('grid', { name: 'Entries' }).getByRole('row')).toHaveText([
    /First Post/,
    /Second Post/,
  ]);
  await expect(page.getByRole('radio', { name: 'Editorial Workflow' })).toBeVisible();
  await page.getByRole('radio', { name: 'Editorial Workflow' }).click();
  await expect(page.getByRole('button', { name: /Second Post/ })).toHaveCount(0);
});

test('deletes an unpublished entry by closing its pull request', async ({ cms, gitea, page }) => {
  const pullRequest = openEntryPullRequest(gitea, {
    slug: 'second-post',
    files: { 'content/posts/second-post.md': post('Second Post', 'Coming soon.') },
  });

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
  expect(pullRequest.merged).toBe(false);
  await expect.poll(() => gitea.refs.has('cms/posts/second-post')).toBe(false);
  // Nothing was published
  expect(gitea.readFile('content/posts/second-post.md')).toBe(undefined);
});

test('starts over from a branch left over from an earlier pull request', async ({
  cms,
  gitea,
  page,
}) => {
  // A pull request closed on the instance rather than discarded in the CMS leaves its branch
  // behind, carrying work a reviewer turned down
  const branch = 'cms/posts/first-post';

  gitea.createBranch(branch, gitea.head.oid);
  gitea.commit(
    {
      'content/posts/first-post.md': post('First Post', 'Rejected draft.'),
      'content/posts/sneaky.md': post('Sneaky', 'Never reviewed.'),
    },
    { branch, author: gitea.user, message: 'Rejected' },
  );

  await cms.open();

  const editor = await openEntry(page, 'First Post');

  await editor.getByRole('textbox', { name: 'Body' }).fill('A fresh start.');
  await saveDraft(page, editor);

  await expect
    .poll(() => gitea.readFile('content/posts/first-post.md', branch))
    .toBe(post('First Post', 'A fresh start.'));
  // The branch was recreated from the configured one, so the rejected file is gone from it
  expect(gitea.readFile('content/posts/sneaky.md', branch)).toBe(undefined);
});

test('keeps a leftover branch alive only for its own open pull request', async ({
  cms,
  gitea,
  page,
}) => {
  // A pull request from a fork can have a head branch of the same name, but it isn’t this branch.
  // Taking it for work in progress would keep the leftover branch, so the rejected file would ride
  // along in the pull request the maintainer publishes
  const branch = 'cms/posts/first-post';

  gitea.createBranch(branch, gitea.head.oid);
  gitea.commit(
    { 'content/posts/sneaky.md': post('Sneaky', 'Never reviewed.') },
    { branch, author: gitea.user, message: 'Rejected' },
  );
  gitea.createFork();
  gitea.createBranch(gitea.forkBranch(branch), gitea.head.oid);
  gitea.openPullRequest(
    { title: 'Unrelated', headBranch: branch },
    { headRepoId: 2, author: gitea.colleague },
  );

  await cms.open();

  const editor = await openEntry(page, 'First Post');

  await editor.getByRole('textbox', { name: 'Body' }).fill('A fresh start.');
  await saveDraft(page, editor);

  await expect
    .poll(() => gitea.readFile('content/posts/first-post.md', branch))
    .toBe(post('First Post', 'A fresh start.'));
  // The commit landed on a branch created afresh, so the rejected file isn’t in the pull request
  expect(gitea.received[1]).toMatchObject({ new_branch: branch });
  expect(gitea.readFile('content/posts/sneaky.md', branch)).toBe(undefined);
});

test('leaves a pull request from a fork off the board', async ({ cms, gitea, page }) => {
  // Its branch is in a repository this flow can’t read, so the board would show the configured
  // repository’s branch of the same name while publishing merged the fork’s commits
  const branch = 'cms/posts/second-post';

  gitea.createFork();
  gitea.createBranch(gitea.forkBranch(branch), gitea.head.oid);
  gitea.commit(
    { 'content/posts/second-post.md': post('Second Post', 'From a fork.') },
    { branch: gitea.forkBranch(branch), author: gitea.colleague, message: 'From a fork' },
  );
  gitea.openPullRequest(
    { title: 'Update Post “second-post”', headBranch: branch },
    { headRepoId: 2, labels: ['sveltia-cms/pending_publish'], author: gitea.colleague },
  );

  await cms.open();

  await expect(page.getByRole('grid', { name: 'Entries' }).getByRole('row')).toHaveText([
    /First Post/,
  ]);
  await expect(page.getByRole('radio', { name: 'Editorial Workflow' })).toBeVisible();
  await page.getByRole('radio', { name: 'Editorial Workflow' }).click();
  await expect(page.getByText('Second Post')).toHaveCount(0);
});

test('drops a labelled pull request moved to another base branch from the board', async ({
  cms,
  gitea,
  page,
}) => {
  // A pull request the CMS opened and labelled, whose base branch a maintainer then changed on the
  // instance. It goes somewhere the CMS doesn’t manage, so publishing the entry from the board
  // would merge it into that branch instead
  const moved = openEntryPullRequest(gitea, {
    slug: 'second-post',
    files: { 'content/posts/second-post.md': post('Second Post', 'Coming soon.') },
  });

  gitea.createBranch('develop', gitea.head.oid);
  moved.baseBranch = 'develop';

  await cms.open();

  // The entry isn’t listed as unpublished, and the board has nothing on it
  await expect(page.getByRole('grid', { name: 'Entries' }).getByRole('row')).toHaveText([
    /First Post/,
  ]);
  await page.getByRole('radio', { name: 'Editorial Workflow' }).click();

  const board = page.getByRole('group', { name: 'Editorial Workflow' });

  // Wait for the board itself, or an empty column would read as one that hasn’t rendered yet
  await expect(board.getByRole('list', { name: 'Drafts' })).toBeVisible();
  await expect(board.getByRole('listitem')).toHaveCount(0);
  // Its label is left as it stands, rather than moved as the entry changes status
  expect(moved).toMatchObject({
    baseBranch: 'develop',
    state: 'open',
    labels: ['sveltia-cms/draft'],
  });
});

test('refuses to save onto a workflow branch with a pull request to another branch', async ({
  cms,
  gitea,
  page,
}) => {
  // A workflow branch someone else is working on
  gitea.createBranch('cms/posts/first-post', gitea.head.oid);
  gitea.commit(
    { 'content/posts/draft-notes.md': post('Draft Notes', 'Someone else’s work.') },
    { branch: 'cms/posts/first-post' },
  );
  gitea.createBranch('develop', gitea.head.oid);

  // A pull request they opened from that branch to a branch the CMS doesn’t manage. It isn’t the
  // entry’s, so the CMS must neither act on it, delete the branch it’s built on, nor commit onto
  // it: their work would then go out with the entry
  const decoy = gitea.openPullRequest(
    { title: 'Tidy up the posts', headBranch: 'cms/posts/first-post' },
    { baseBranch: 'develop', author: gitea.colleague },
  );

  const branchHead = gitea.refs.get('cms/posts/first-post');

  await cms.open();

  const editor = await openEntry(page, 'First Post');

  await editor.getByRole('textbox', { name: 'Body' }).fill('Fresh draft.');
  await editor.getByRole('button', { name: 'Save' }).click();

  await expect(page.getByRole('alertdialog', { name: 'Error' })).toContainText(
    'Another request (\u2068#1\u2069) is already open for this entry outside the CMS.',
  );
  expect(gitea.pullRequests).toHaveLength(1);
  expect(decoy).toMatchObject({
    title: 'Tidy up the posts',
    baseBranch: 'develop',
    state: 'open',
    labels: [],
  });
  expect(gitea.refs.get('cms/posts/first-post')).toBe(branchHead);
});

test('refuses to publish an entry whose pull request changes other files', async ({
  cms,
  gitea,
  page,
}) => {
  // A collaborator who can push a branch but not merge into the configured branch, which a branch
  // protection rule allows. A change to the site’s code slipped into what looks like an ordinary
  // entry on the board would otherwise go live when a maintainer publishes it
  const pullRequest = openEntryPullRequest(gitea, {
    slug: 'second-post',
    files: {
      'content/posts/second-post.md': post('Second Post', 'Coming soon.'),
      '.gitea/workflows/deploy.yml':
        'on: push\njobs:\n  x:\n    steps:\n      - run: curl x | sh\n',
    },
    status: 'pending_publish',
  });

  await cms.open();
  await publish(page, await openEntry(page, 'Second Post'));

  await expect(page.getByRole('alert')).toContainText(
    'This entry can’t be published here, because it comes with other changes the CMS can’t show you.',
  );
  expect(pullRequest.merged).toBe(false);
  expect(gitea.readFile('.gitea/workflows/deploy.yml')).toBeUndefined();
});

test('refuses to publish an entry whose branch has moved on since it was opened', async ({
  cms,
  gitea,
  page,
}) => {
  const pullRequest = openEntryPullRequest(gitea, {
    slug: 'second-post',
    files: { 'content/posts/second-post.md': post('Second Post', 'Coming soon.') },
    status: 'pending_publish',
  });

  await cms.open();

  const editor = await openEntry(page, 'Second Post');

  // Pushed after the entry has been reviewed, so publishing would merge what nobody has seen
  gitea.commit(
    { 'content/posts/second-post.md': post('Second Post', 'Something else entirely.') },
    { branch: 'cms/posts/second-post' },
  );
  await publish(page, editor);

  await expect(page.getByRole('alert')).toContainText(
    'The entry has been changed since you opened it.',
  );
  expect(pullRequest.merged).toBe(false);
  expect(gitea.readFile('content/posts/second-post.md')).toBeUndefined();
});

test('warns before saving over a colleague’s commit to the workflow branch', async ({
  cms,
  gitea,
  page,
}) => {
  // An entry’s branch is named after the entry, not the editor, so a colleague working on the same
  // entry writes to it too. The save compares the branch head with the one it last committed and
  // reads the entry back when they differ
  openEntryPullRequest(gitea, {
    slug: 'first-post',
    files: { 'content/posts/first-post.md': post('First Post', 'Hello from Mona!') },
  });

  await cms.open();

  const editor = await openEntry(page, 'First Post');

  gitea.commit(
    { 'content/posts/first-post.md': post('First Post', 'Hello from Alex!') },
    { branch: 'cms/posts/first-post', author: gitea.colleague },
  );

  await editor.getByRole('textbox', { name: 'Body' }).fill('Hello again from Mona!');
  await editor.getByRole('button', { name: 'Save' }).click();

  const dialog = page.getByRole('alertdialog', { name: 'Entry Changed by Someone Else' });

  await expect(dialog).toContainText('If you save now, their changes will be lost.');
  // Nothing is written while the question is open
  expect(gitea.readFile('content/posts/first-post.md', 'cms/posts/first-post')).toBe(
    post('First Post', 'Hello from Alex!'),
  );

  // The editor can still go ahead, which is what the warning is for
  await dialog.getByRole('button', { name: 'Save Anyway' }).click();
  await page
    .getByRole('alertdialog', { name: 'Send for Review' })
    .getByRole('button', { name: 'Later' })
    .click();

  await expect
    .poll(() => gitea.readFile('content/posts/first-post.md', 'cms/posts/first-post'))
    .toBe(post('First Post', 'Hello again from Mona!'));
});
