import { openEntryPullRequest, post, WORKFLOW_CONFIG } from '../../fixtures/configs/workflow.js';
import { createPNG } from '../../fixtures/files.js';
import { expect, test } from '../../fixtures/test.js';

/**
 * @import { Locator, Page } from '@playwright/test';
 * @import { MockGitHub } from '../../fixtures/github.js';
 */

test.use({ config: WORKFLOW_CONFIG });

test.beforeEach(async ({ github }) => {
  github.commit({ 'content/posts/first-post.md': post('First Post', 'Hello, world!') });
});

/**
 * Get a group of the entry list.
 * @param {Page} page Page.
 * @param {'Unpublished Entries' | 'Published Entries'} name Group name.
 * @returns {Locator} Row group.
 */
const getEntryGroup = (page, name) =>
  page.getByRole('grid', { name: 'Entries' }).getByRole('rowgroup', { name, exact: true });

/**
 * Get the names of the Editorial Workflow branches.
 * @param {MockGitHub} github GitHub mock.
 * @returns {string[]} Branch names.
 */
const getWorkflowBranches = (github) =>
  [...github.refs.keys()].filter((branch) => branch.startsWith('cms/'));

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

test('saves a new entry to a branch and opens a draft pull request', async ({
  cms,
  github,
  page,
}) => {
  const { oid: mainBefore } = github.head;

  await cms.open();
  await page.getByRole('button', { name: 'Create New Entry' }).first().click();

  const editor = page.getByRole('group', { name: 'Content Editor' });

  await editor.getByRole('textbox', { name: 'Title' }).fill('Second Post');
  await editor.getByRole('textbox', { name: 'Body' }).fill('Coming soon.');
  await editor.getByRole('button', { name: 'Save' }).click();
  await page
    .getByRole('alertdialog', { name: 'Send for Review' })
    .getByRole('button', { name: 'Later' })
    .click();

  await expect(getEntryGroup(page, 'Unpublished Entries').getByRole('row')).toHaveText([
    /Unpublished Entries/,
    /Second Post.*Draft/,
  ]);
  expect(github.readFile('content/posts/second-post.md', 'cms/posts/second-post')).toBe(
    post('Second Post', 'Coming soon.'),
  );
  // Nothing is published yet
  expect(github.head.oid).toBe(mainBefore);
  expect(github.pullRequests).toMatchObject([
    {
      title: 'Create Post “second-post”',
      head: 'cms/posts/second-post',
      base: 'main',
      state: 'open',
      draft: true,
      labels: ['sveltia-cms/draft'],
    },
  ]);
});

test('saves a change to a published entry to a pull request', async ({ cms, github, page }) => {
  await cms.open();

  const editor = await openEntry(page, 'First Post');

  await editor.getByRole('textbox', { name: 'Body' }).fill('Hello again!');
  await editor.getByRole('button', { name: 'Save' }).click();
  await page
    .getByRole('alertdialog', { name: 'Send for Review' })
    .getByRole('button', { name: 'Later' })
    .click();

  await expect
    .poll(() => github.readFile('content/posts/first-post.md', 'cms/posts/first-post'))
    .toBe(post('First Post', 'Hello again!'));
  expect(github.readFile('content/posts/first-post.md')).toBe(post('First Post', 'Hello, world!'));
  // The draft stands in for the published entry, rather than being listed twice
  await expect(page.getByRole('grid', { name: 'Entries' }).getByRole('row')).toHaveText([
    /First Post.*Draft/,
  ]);

  // Another save goes to the same branch and pull request
  await openEntry(page, 'First Post');
  await editor.getByRole('textbox', { name: 'Body' }).fill('Hello once more!');
  await editor.getByRole('button', { name: 'Save' }).click();
  await page
    .getByRole('alertdialog', { name: 'Send for Review' })
    .getByRole('button', { name: 'Later' })
    .click();

  await expect
    .poll(() => github.readFile('content/posts/first-post.md', 'cms/posts/first-post'))
    .toBe(post('First Post', 'Hello once more!'));
  expect(github.pullRequests).toHaveLength(1);
});

test('moves an entry through the review stages', async ({ cms, github, page }) => {
  const pullRequest = openEntryPullRequest(github, {
    slug: 'second-post',
    files: { 'content/posts/second-post.md': post('Second Post', 'Coming soon.') },
  });

  await cms.open();
  await openEntry(page, 'Second Post');

  /**
   * Change the status with the editor’s status menu.
   * @param {RegExp} current Current status.
   * @param {string} status New status.
   */
  const changeStatus = async (current, status) => {
    await cms.chooseMenuItem(
      page.getByRole('button', { name: current }),
      page.getByRole('menuitemradio', { name: status }),
    );
  };

  await changeStatus(/Status: .*Draft/, 'In Review');
  // The labels are updated first, then the draft state
  await expect
    .poll(() => ({ labels: pullRequest.labels, draft: pullRequest.draft }))
    .toEqual({ labels: ['sveltia-cms/pending_review'], draft: false });

  await changeStatus(/Status: .*In Review/, 'Ready');
  // The labels are updated first, then the draft state
  await expect
    .poll(() => ({ labels: pullRequest.labels, draft: pullRequest.draft }))
    .toEqual({ labels: ['sveltia-cms/pending_publish'], draft: false });

  await changeStatus(/Status: .*Ready/, 'Draft');
  // The labels are updated first, then the draft state
  await expect
    .poll(() => ({ labels: pullRequest.labels, draft: pullRequest.draft }))
    .toEqual({ labels: ['sveltia-cms/draft'], draft: true });
});

test('keeps the other labels of a pull request', async ({ cms, github, page }) => {
  const pullRequest = openEntryPullRequest(github, {
    slug: 'second-post',
    files: { 'content/posts/second-post.md': post('Second Post', 'Coming soon.') },
  });

  pullRequest.labels.push('documentation');

  await cms.open();
  await openEntry(page, 'Second Post');
  await cms.chooseMenuItem(
    page.getByRole('button', { name: /Status: .*Draft/ }),
    page.getByRole('menuitemradio', { name: 'Ready' }),
  );

  await expect
    .poll(() => pullRequest.labels)
    .toEqual(['documentation', 'sveltia-cms/pending_publish']);
});

test('publishes an entry by merging its pull request', async ({ cms, github, page }) => {
  const pullRequest = openEntryPullRequest(github, {
    slug: 'second-post',
    files: { 'content/posts/second-post.md': post('Second Post', 'Coming soon.') },
    status: 'pending_publish',
  });

  await cms.open();

  const editor = await openEntry(page, 'Second Post');

  await editor.getByRole('button', { name: 'Publish Entry' }).click();
  await page
    .getByRole('alertdialog', { name: 'Publish Entry' })
    .getByRole('button', { name: 'Publish' })
    .click();

  await expect.poll(() => pullRequest.state).toBe('merged');
  expect(github.readFile('content/posts/second-post.md')).toBe(post('Second Post', 'Coming soon.'));
  expect(github.head.parents).toHaveLength(2);
  // The branch is deleted after the merge
  await expect.poll(() => github.refs.has('cms/posts/second-post')).toBe(false);
  await expect(page.getByRole('grid', { name: 'Entries' }).getByRole('row')).toHaveText([
    /First Post/,
    /Second Post/,
  ]);
});

test.describe('with `squash_merges`', () => {
  test.use({
    config: { ...WORKFLOW_CONFIG, backend: { ...WORKFLOW_CONFIG.backend, squash_merges: true } },
  });

  test('squashes the pull request into a single commit', async ({ cms, github, page }) => {
    const pullRequest = openEntryPullRequest(github, {
      slug: 'second-post',
      files: { 'content/posts/second-post.md': post('Second Post', 'Coming soon.') },
      status: 'pending_publish',
    });

    const { oid: mainBefore } = github.head;

    await cms.open();

    const editor = await openEntry(page, 'Second Post');

    await editor.getByRole('button', { name: 'Publish Entry' }).click();
    await page
      .getByRole('alertdialog', { name: 'Publish Entry' })
      .getByRole('button', { name: 'Publish' })
      .click();

    await expect.poll(() => pullRequest.state).toBe('merged');
    expect(github.head).toMatchObject({
      parents: [mainBefore],
      message: 'Update Post “second-post”',
    });
    expect(github.readFile('content/posts/second-post.md')).toBe(
      post('Second Post', 'Coming soon.'),
    );
  });
});

test('deletes an unpublished entry by closing its pull request', async ({ cms, github, page }) => {
  const { oid: mainBefore } = github.head;

  const pullRequest = openEntryPullRequest(github, {
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
  expect(github.refs.has('cms/posts/second-post')).toBe(false);
  expect(github.head.oid).toBe(mainBefore);
  await expect(page.getByRole('grid', { name: 'Entries' }).getByRole('row')).toHaveText([
    /First Post/,
  ]);
});

test('marks a published entry for deletion with a pull request', async ({ cms, github, page }) => {
  await cms.open();
  await openEntry(page, 'First Post');
  await cms.chooseMenuItem(
    page.getByRole('button', { name: 'Show Editor Options' }),
    page.getByRole('menuitem', { name: 'Delete Entry' }),
  );
  await page
    .getByRole('alertdialog', { name: 'Delete Entry' })
    .getByRole('button', { name: 'Delete' })
    .click();

  await expect
    .poll(() => github.pullRequests)
    .toMatchObject([
      { head: 'cms/posts/first-post', state: 'open', labels: ['sveltia-cms/pending_deletion'] },
    ]);
  expect(github.readFile('content/posts/first-post.md', 'cms/posts/first-post')).toBeUndefined();
  // Still published until the deletion is
  expect(github.readFile('content/posts/first-post.md')).toBe(post('First Post', 'Hello, world!'));
});

test.describe('on the Editorial Workflow page', () => {
  test.beforeEach(({ github }) => {
    openEntryPullRequest(github, {
      slug: 'first-post',
      files: { 'content/posts/first-post.md': null },
      status: 'pending_deletion',
    });
  });

  /**
   * Get the card of an entry on the board.
   * @param {Page} page Page.
   * @param {string} title Entry title.
   * @returns {Locator} Card.
   */
  const getCard = (page, title) =>
    page
      .getByRole('group', { name: 'Editorial Workflow' })
      .getByRole('listitem')
      .filter({ has: page.getByRole('button', { name: title }) });

  test('carries out a pending deletion', async ({ cms, github, page }) => {
    await cms.open();
    await page.getByRole('radio', { name: 'Editorial Workflow' }).click();
    await getCard(page, 'First Post').getByRole('button', { name: 'Delete Entry' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();

    await expect.poll(() => github.pullRequests[0].state).toBe('merged');
    expect(github.readFile('content/posts/first-post.md')).toBeUndefined();
    // The column is gone along with its only card
    await expect(page.getByRole('group', { name: 'Pending Deletion' })).toHaveCount(0);
  });

  test('cancels a pending deletion', async ({ cms, github, page }) => {
    await cms.open();
    await page.getByRole('radio', { name: 'Editorial Workflow' }).click();
    await getCard(page, 'First Post').getByRole('button', { name: 'Cancel Deletion' }).click();
    await page
      .getByRole('alertdialog', { name: 'Cancel Deletion' })
      .getByRole('button', { name: 'Cancel Deletion' })
      .click();

    await expect.poll(() => github.pullRequests[0].state).toBe('closed');
    expect(github.refs.has('cms/posts/first-post')).toBe(false);
    expect(github.readFile('content/posts/first-post.md')).toBe(
      post('First Post', 'Hello, world!'),
    );
    // The column is gone along with its only card
    await expect(page.getByRole('group', { name: 'Pending Deletion' })).toHaveCount(0);
  });
});

test('discards the changes to a published entry', async ({ cms, github, page }) => {
  const pullRequest = openEntryPullRequest(github, {
    slug: 'first-post',
    files: { 'content/posts/first-post.md': post('First Post', 'Hello again!') },
  });

  await cms.open();
  await openEntry(page, 'First Post');
  await cms.chooseMenuItem(
    page.getByRole('button', { name: 'Show Editor Options' }),
    page.getByRole('menuitem', { name: 'Discard Changes' }),
  );
  await page
    .getByRole('alertdialog', { name: 'Discard Changes' })
    .getByRole('button', { name: 'Discard' })
    .click();

  await expect.poll(() => pullRequest.state).toBe('closed');
  expect(github.refs.has('cms/posts/first-post')).toBe(false);
  expect(github.readFile('content/posts/first-post.md')).toBe(post('First Post', 'Hello, world!'));
  // The published version is shown again
  await expect(page.getByRole('grid', { name: 'Entries' }).getByRole('row')).toHaveText([
    /^\s*First Post\s*$/,
  ]);
});

test('saves a draft with a required field left empty, but keeps it from review', async ({
  cms,
  github,
  page,
}) => {
  await cms.open();
  await page.getByRole('button', { name: 'Create New Entry' }).first().click();

  const editor = page.getByRole('group', { name: 'Content Editor' });

  await editor.getByRole('textbox', { name: 'Title' }).fill('Second Post');
  await editor.getByRole('button', { name: 'Save' }).click();

  await expect
    .poll(() => github.pullRequests)
    .toMatchObject([{ head: 'cms/posts/second-post', labels: ['sveltia-cms/draft'] }]);
  // The entry isn’t offered for review, as it isn’t complete
  await expect(page.getByRole('alertdialog', { name: 'Send for Review' })).toHaveCount(0);

  await openEntry(page, 'Second Post');
  await cms.chooseMenuItem(
    page.getByRole('button', { name: /Status: .*Draft/ }),
    page.getByRole('menuitemradio', { name: 'In Review' }),
  );

  await expect(page.getByRole('alert').filter({ hasText: 'The entry has errors.' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Status: .*Draft/ })).toBeVisible();
  expect(github.pullRequests[0]).toMatchObject({ labels: ['sveltia-cms/draft'], draft: true });
});

test('refuses to publish an entry with a required field left empty', async ({
  cms,
  github,
  page,
}) => {
  const pullRequest = openEntryPullRequest(github, {
    slug: 'second-post',
    files: { 'content/posts/second-post.md': '---\ntitle: Second Post\n---\n' },
    status: 'pending_publish',
  });

  const { oid: mainBefore } = github.head;

  await cms.open();

  const editor = await openEntry(page, 'Second Post');

  await editor.getByRole('button', { name: 'Publish Entry' }).click();
  await page
    .getByRole('alertdialog', { name: 'Publish Entry' })
    .getByRole('button', { name: 'Publish' })
    .click();

  await expect(
    page.getByRole('alert').filter({ hasText: 'Please correct them before publishing it.' }),
  ).toBeVisible();
  expect(pullRequest.state).toBe('open');
  expect(github.head.oid).toBe(mainBefore);
});

test('resets a branch left over from an earlier pull request', async ({ cms, github, page }) => {
  // A pull request closed on GitHub, which left its branch behind
  const leftover = openEntryPullRequest(github, {
    slug: 'second-post',
    files: {
      'content/posts/second-post.md': post('Second Post', 'An old idea.'),
      'content/posts/stale.md': post('Stale', 'Thrown away.'),
    },
  });

  Object.assign(leftover, { state: 'closed', lastHead: github.refs.get('cms/posts/second-post') });

  await cms.open();
  await page.getByRole('button', { name: 'Create New Entry' }).first().click();

  const editor = page.getByRole('group', { name: 'Content Editor' });

  await editor.getByRole('textbox', { name: 'Title' }).fill('Second Post');
  await editor.getByRole('textbox', { name: 'Body' }).fill('A new idea.');
  await editor.getByRole('button', { name: 'Save' }).click();
  await page
    .getByRole('alertdialog', { name: 'Send for Review' })
    .getByRole('button', { name: 'Later' })
    .click();

  await expect
    .poll(() => github.pullRequests.map(({ state }) => state))
    .toEqual(['closed', 'open']);
  expect(github.readFile('content/posts/second-post.md', 'cms/posts/second-post')).toBe(
    post('Second Post', 'A new idea.'),
  );
  // What was thrown away doesn’t come back with the new pull request
  expect(github.readFile('content/posts/stale.md', 'cms/posts/second-post')).toBeUndefined();
});

test('takes back a pull request that has lost its status label', async ({ cms, github, page }) => {
  const pullRequest = openEntryPullRequest(github, {
    slug: 'first-post',
    files: { 'content/posts/first-post.md': post('First Post', 'Hello again!') },
  });

  pullRequest.labels = ['documentation'];

  await cms.open();

  // Without its label, the pull request isn’t one the CMS lists
  const editor = await openEntry(page, 'First Post');

  await expect(editor.getByRole('textbox', { name: 'Body' })).toHaveValue('Hello, world!');
  await editor.getByRole('textbox', { name: 'Body' }).fill('Hello once more!');
  await editor.getByRole('button', { name: 'Save' }).click();
  await page
    .getByRole('alertdialog', { name: 'Send for Review' })
    .getByRole('button', { name: 'Later' })
    .click();

  // The save goes into the pull request, which gets its label back, rather than a new one
  await expect.poll(() => pullRequest.labels).toEqual(['documentation', 'sveltia-cms/draft']);
  expect(github.pullRequests).toHaveLength(1);
  expect(github.readFile('content/posts/first-post.md', 'cms/posts/first-post')).toBe(
    post('First Post', 'Hello once more!'),
  );
});

test('deletes several unpublished entries at once', async ({ cms, github, page }) => {
  const pullRequests = ['second-post', 'third-post'].map((slug) =>
    openEntryPullRequest(github, {
      slug,
      files: { [`content/posts/${slug}.md`]: post(slug, 'Coming soon.') },
    }),
  );

  await cms.open();
  await page.getByRole('checkbox', { name: /Select .*second-post/ }).check();
  await page.getByRole('checkbox', { name: /Select .*third-post/ }).check();
  await page.getByRole('button', { name: 'Delete Selected Entries' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();

  await expect.poll(() => pullRequests.map(({ state }) => state)).toEqual(['closed', 'closed']);
  expect(getWorkflowBranches(github)).toEqual([]);
  await expect(page.getByRole('grid', { name: 'Entries' }).getByRole('row')).toHaveText([
    /First Post/,
  ]);
});

test.describe('with an image field', () => {
  test.use({
    config: {
      ...WORKFLOW_CONFIG,
      collections: [
        {
          ...WORKFLOW_CONFIG.collections[0],
          fields: [
            ...WORKFLOW_CONFIG.collections[0].fields,
            { name: 'cover', label: 'Cover', widget: 'image', required: false },
          ],
        },
      ],
    },
  });

  test('saves an uploaded image to the branch, and publishes it with the entry', async ({
    cms,
    github,
    page,
  }) => {
    const image = createPNG({ color: [255, 128, 0] });

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

    await expect
      .poll(() => github.readFile('content/posts/second-post.md', 'cms/posts/second-post'))
      .toMatch(/cover: \/images\/sunrise\.png/);

    const branchHead = github.getHead('cms/posts/second-post');

    expect(github.blobs.get(branchHead.tree.get('static/images/sunrise.png') ?? '')).toEqual(image);
    // Nothing is on the site until the entry is published
    expect(github.head.tree.has('static/images/sunrise.png')).toBe(false);

    const [pullRequest] = github.pullRequests;

    await openEntry(page, 'Second Post');
    await cms.chooseMenuItem(
      page.getByRole('button', { name: /Status: .*Draft/ }),
      page.getByRole('menuitemradio', { name: 'Ready' }),
    );
    await expect.poll(() => pullRequest.labels).toEqual(['sveltia-cms/pending_publish']);
    await editor.getByRole('button', { name: 'Publish Entry' }).click();
    await page
      .getByRole('alertdialog', { name: 'Publish Entry' })
      .getByRole('button', { name: 'Publish' })
      .click();

    await expect.poll(() => pullRequest.state).toBe('merged');
    expect(github.blobs.get(github.head.tree.get('static/images/sunrise.png') ?? '')).toEqual(
      image,
    );

    // The image is listed in the Asset Library once it’s published
    await page.getByRole('radio', { name: 'Assets' }).click();
    await expect(
      page.getByRole('grid', { name: 'Assets' }).getByRole('row', { name: 'sunrise.png' }),
    ).toBeVisible();
  });
});
