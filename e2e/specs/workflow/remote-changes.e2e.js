import { openEntryPullRequest, post, WORKFLOW_CONFIG } from '../../fixtures/configs/workflow.js';
import { expect, test } from '../../fixtures/test.js';
import { getEntryRows, openEntry } from '../../fixtures/ui.js';

/**
 * @import { Locator, Page } from '@playwright/test';
 */

test.use({ config: WORKFLOW_CONFIG });

test.beforeEach(async ({ github }) => {
  github.commit({ 'content/posts/first-post.md': post('First Post', 'Hello, world!') });
});

/**
 * Publish the entry open in the editor.
 * @param {Page} page Page.
 */
const publishEntry = async (page) => {
  await page.getByRole('button', { name: 'Publish Entry' }).click();
  await page
    .getByRole('alertdialog', { name: 'Publish Entry' })
    .getByRole('button', { name: 'Publish' })
    .click();
};

test('publishes an entry along with a colleague’s change to another file', async ({
  cms,
  github,
  page,
}) => {
  const pullRequest = openEntryPullRequest(github, {
    slug: 'second-post',
    files: { 'content/posts/second-post.md': post('Second Post', 'Coming soon.') },
    status: 'pending_publish',
  });

  await cms.open();
  await openEntry(page, 'Second Post');
  github.commit({ 'content/posts/third-post.md': post('Third Post', 'From Alex.') });
  await publishEntry(page);

  await expect.poll(() => pullRequest.state).toBe('merged');
  expect(github.readFile('content/posts/second-post.md')).toBe(post('Second Post', 'Coming soon.'));
  expect(github.readFile('content/posts/third-post.md')).toBe(post('Third Post', 'From Alex.'));
});

test('refuses to publish an entry a colleague has changed since', async ({ cms, github, page }) => {
  const pullRequest = openEntryPullRequest(github, {
    slug: 'first-post',
    files: { 'content/posts/first-post.md': post('First Post', 'Hello from Mona!') },
    status: 'pending_publish',
  });

  await cms.open();
  await openEntry(page, 'First Post');
  // The pull request now conflicts with the published version, so GitHub can’t merge it
  github.commit({ 'content/posts/first-post.md': post('First Post', 'Hello from Alex!') });
  await publishEntry(page);

  // The message asks to try again, which can’t help until the conflict is resolved on GitHub
  await expect(page.getByRole('alert')).toContainText('Couldn’t publish the entry.');
  expect(pullRequest.state).toBe('open');
  expect(github.readFile('content/posts/first-post.md')).toBe(
    post('First Post', 'Hello from Alex!'),
  );
  await expect(page.getByRole('button', { name: 'Publish Entry' })).toBeEnabled();
});

test('takes a pull request merged on GitHub as published', async ({ cms, github, page }) => {
  const pullRequest = openEntryPullRequest(github, {
    slug: 'second-post',
    files: { 'content/posts/second-post.md': post('Second Post', 'Coming soon.') },
    status: 'pending_publish',
  });

  await cms.open();
  await openEntry(page, 'Second Post');
  // A maintainer merges it on GitHub while this board is open
  github.mergePullRequest(pullRequest);
  await publishEntry(page);

  // The entry is live, so publishing carries on rather than reporting a failure: the branch is
  // tidied up and the entry is listed as published rather than kept on the board
  await expect.poll(() => github.refs.has('cms/posts/second-post')).toBe(false);
  await expect(getEntryRows(page)).toHaveText([/First Post/, /Second Post/]);
  expect(github.readFile('content/posts/second-post.md')).toBe(post('Second Post', 'Coming soon.'));
});

test('warns before saving over a colleague’s commit to the workflow branch', async ({
  cms,
  github,
  page,
}) => {
  // An entry’s branch is named after the entry, not the editor, so a colleague working on the same
  // entry writes to it too. The save compares the branch head with the one it last committed and
  // reads the entry back when they differ
  openEntryPullRequest(github, {
    slug: 'first-post',
    files: { 'content/posts/first-post.md': post('First Post', 'Hello from Mona!') },
  });

  await cms.open();

  const editor = await openEntry(page, 'First Post');

  github.commit(
    { 'content/posts/first-post.md': post('First Post', 'Hello from Alex!') },
    { branch: 'cms/posts/first-post', author: github.colleague },
  );

  await editor.getByRole('textbox', { name: 'Body' }).fill('Hello again from Mona!');
  await editor.getByRole('button', { name: 'Save' }).click();

  const dialog = page.getByRole('alertdialog', { name: 'Entry Changed by Someone Else' });

  await expect(dialog).toContainText('changed this entry on');
  await expect(dialog).toContainText('If you save now, their changes will be lost.');
  // Nothing is written while the question is open
  expect(github.readFile('content/posts/first-post.md', 'cms/posts/first-post')).toBe(
    post('First Post', 'Hello from Alex!'),
  );

  // The editor can still go ahead, which is what the warning is for
  await dialog.getByRole('button', { name: 'Save Anyway' }).click();
  await page
    .getByRole('alertdialog', { name: 'Send for Review' })
    .getByRole('button', { name: 'Later' })
    .click();

  await expect
    .poll(() => github.readFile('content/posts/first-post.md', 'cms/posts/first-post'))
    .toBe(post('First Post', 'Hello again from Mona!'));
});

test('shows GitHub’s error when the workflow branch moves during a save (known issue)', async ({
  cms,
  github,
  page,
}) => {
  // A commit refused because a workflow branch has moved is reported with GitHub’s own message,
  // while the configured branch gets the “updated by someone else” one. Once fixed, this test
  // should expect a message a user can act on
  openEntryPullRequest(github, {
    slug: 'first-post',
    files: { 'content/posts/first-post.md': post('First Post', 'Hello from Mona!') },
  });

  await cms.open();

  const editor = await openEntry(page, 'First Post');

  // eslint-disable-next-line jsdoc/require-jsdoc
  github.beforeCommit = () => {
    github.commit(
      { 'content/posts/first-post.md': post('First Post', 'Hello from Alex!') },
      { branch: 'cms/posts/first-post' },
    );
  };

  await editor.getByRole('textbox', { name: 'Body' }).fill('Hello again from Mona!');
  await editor.getByRole('button', { name: 'Save' }).click();

  await expect(page.getByRole('alertdialog', { name: 'Error' })).toContainText(
    /Expected branch to point to ".+" but it did not/,
  );
  expect(github.readFile('content/posts/first-post.md', 'cms/posts/first-post')).toBe(
    post('First Post', 'Hello from Alex!'),
  );
});

test('lists a colleague’s pull request on a later check', async ({ cms, github, page }) => {
  // Opening a pull request doesn’t move the configured branch, so it’s picked up when the pull
  // requests are next listed, which is less often than the branch is checked
  await page.clock.install();
  await cms.open();
  await expect(page.getByRole('row', { name: /First Post/ })).toBeVisible();

  openEntryPullRequest(github, {
    slug: 'second-post',
    files: { 'content/posts/second-post.md': post('Second Post', 'From Alex.') },
  });
  await page.clock.fastForward('01:01');
  // Give the check time to finish, to show that it doesn’t list the pull requests yet
  await page.waitForTimeout(1000);
  await expect(getEntryRows(page)).toHaveText([/First Post/]);

  await page.clock.fastForward('04:00');
  await expect(getEntryRows(page)).toHaveText([
    /Unpublished Entries/,
    /Second Post.*Draft/,
    /Published Entries/,
    /First Post/,
  ]);
});

test('lists a colleague’s pull request once the board is refreshed', async ({
  cms,
  github,
  page,
}) => {
  await cms.open();
  await page.getByRole('radio', { name: 'Editorial Workflow' }).click();

  const drafts = page.getByRole('list', { name: 'Drafts' });

  await expect(drafts).toHaveText('No entries.');

  openEntryPullRequest(github, {
    slug: 'second-post',
    files: { 'content/posts/second-post.md': post('Second Post', 'From Alex.') },
  });
  await page.getByRole('button', { name: 'Refresh' }).click();

  await expect(
    page.getByRole('status').filter({ hasText: 'The board is up to date.' }),
  ).toBeVisible();
  await expect(drafts.getByRole('listitem')).toHaveText([/Second Post/]);
});

test('drops pull requests merged or closed on GitHub on the next check', async ({
  cms,
  github,
  page,
}) => {
  // A merge moves the configured branch, which the next check notices, so the pull requests are
  // listed again right away, after the merged post has been fetched
  const merged = openEntryPullRequest(github, {
    slug: 'second-post',
    files: { 'content/posts/second-post.md': post('Second Post', 'Coming soon.') },
    status: 'pending_publish',
  });

  openEntryPullRequest(github, {
    slug: 'third-post',
    files: { 'content/posts/third-post.md': post('Third Post', 'Maybe later.') },
  });

  await page.clock.install();
  await cms.open();
  await expect(page.getByRole('row', { name: /Third Post/ })).toBeVisible();

  github.mergePullRequest(merged);
  github.deleteBranch('cms/posts/second-post');
  github.deleteBranch('cms/posts/third-post');
  await page.clock.fastForward('01:01');

  await expect(getEntryRows(page)).toHaveText([/First Post/, /Second Post/]);
  await expect(page.getByRole('row', { name: /Second Post/ })).not.toContainText('Ready');
});

test('starts a new pull request when saving an entry whose request was closed on GitHub', async ({
  cms,
  github,
  page,
}) => {
  const closed = openEntryPullRequest(github, {
    slug: 'second-post',
    files: { 'content/posts/second-post.md': post('Second Post', 'Maybe later.') },
  });

  await cms.open();

  const editor = await openEntry(page, 'Second Post');

  // Closed while the editor is open, before the next check could notice
  github.deleteBranch('cms/posts/second-post');
  await editor.getByRole('textbox', { name: 'Body' }).fill('Now or never.');
  await editor.getByRole('button', { name: 'Save' }).click();
  await page
    .getByRole('alertdialog', { name: 'Send for Review' })
    .getByRole('button', { name: 'Later' })
    .click();

  await expect
    .poll(() => github.readFile('content/posts/second-post.md', 'cms/posts/second-post'))
    .toBe(post('Second Post', 'Now or never.'));
  expect(closed.state).toBe('closed');
  expect(github.getOpenPullRequests('cms/posts/second-post')).toHaveLength(1);
});

test('refuses to publish a commit pushed since the editor was opened, though the list has caught up', async ({
  cms,
  github,
  page,
}) => {
  const pullRequest = openEntryPullRequest(github, {
    slug: 'second-post',
    files: { 'content/posts/second-post.md': post('Second Post', 'Coming soon.') },
    status: 'pending_publish',
  });

  await page.clock.install();
  await cms.open();
  await openEntry(page, 'Second Post');

  // Someone who can push but not merge adds a commit nobody has reviewed, and the pull requests are
  // read again while the editor still shows the version that was reviewed
  github.commit(
    { 'content/posts/second-post.md': post('Second Post', 'Not what was reviewed.') },
    { branch: 'cms/posts/second-post', author: github.colleague },
  );

  const reloaded = page.waitForRequest(
    (request) =>
      request.url() === github.graphqlURL && !!request.postData()?.includes('pullRequests('),
  );

  await page.clock.fastForward('05:01');
  await reloaded;
  await publishEntry(page);

  await expect(page.getByRole('alert')).toContainText(
    'The entry has been changed since you opened it.',
  );
  expect(pullRequest.state).toBe('open');
  expect(github.readFile('content/posts/second-post.md')).toBeUndefined();
});
