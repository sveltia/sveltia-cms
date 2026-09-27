import { openEntryPullRequest, post, WORKFLOW_CONFIG } from '../../fixtures/configs/workflow.js';
import { expect, test } from '../../fixtures/test.js';

/**
 * @import { Locator, Page } from '@playwright/test';
 */

test.use({ config: WORKFLOW_CONFIG });

test.beforeEach(async ({ github }) => {
  github.commit({ 'content/posts/first-post.md': post('First Post', 'Hello, world!') });
});

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

test('overwrites a colleague’s commit to the workflow branch (known issue)', async ({
  cms,
  github,
  page,
}) => {
  // Changes made to the pull request on GitHub go unnoticed: the remote check only looks at the
  // configured branch, and a save to a workflow branch goes on top of whatever the branch holds.
  // Once fixed, the editor should offer to reload the entry, like it does for a published one, or
  // warn before saving, and this test should check that instead
  openEntryPullRequest(github, {
    slug: 'first-post',
    files: { 'content/posts/first-post.md': post('First Post', 'Hello from Mona!') },
  });

  await page.clock.install();
  await cms.open();

  const editor = await openEntry(page, 'First Post');

  github.commit(
    { 'content/posts/first-post.md': post('First Post', 'Hello from Alex!') },
    { branch: 'cms/posts/first-post' },
  );
  await page.clock.fastForward('01:01');
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(editor.getByRole('alert')).toHaveCount(0);

  await editor.getByRole('textbox', { name: 'Body' }).fill('Hello again from Mona!');
  await editor.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('alertdialog', { name: 'Send for Review' })).toBeVisible();

  expect(github.readFile('content/posts/first-post.md', 'cms/posts/first-post')).toBe(
    post('First Post', 'Hello again from Mona!'),
  );
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

test('lists a colleague’s pull request only after a reload (known issue)', async ({
  cms,
  github,
  page,
}) => {
  // The unpublished entries are loaded once, at sign-in, and the remote check doesn’t update them.
  // Once fixed, the new entry should show up on the next check
  await page.clock.install();
  await cms.open();
  await expect(page.getByRole('row', { name: /First Post/ })).toBeVisible();

  openEntryPullRequest(github, {
    slug: 'second-post',
    files: { 'content/posts/second-post.md': post('Second Post', 'From Alex.') },
  });
  await page.clock.fastForward('01:01');
  // Give the check time to finish, to show that it doesn’t change the list
  await page.waitForTimeout(1000);
  await expect(page.getByRole('grid', { name: 'Entries' }).getByRole('row')).toHaveText([
    /First Post/,
  ]);

  await page.reload();
  await expect(page.getByRole('row', { name: /Second Post/ })).toBeVisible();
});

test('keeps showing pull requests merged or closed on GitHub (known issue)', async ({
  cms,
  github,
  page,
}) => {
  // The remote check picks up the merged post, but not the fact that its pull request is gone, so
  // the post is listed with a stale status. A pull request closed on GitHub stays listed too, and
  // saving it fails, as its branch has gone. Once fixed, both should be dropped on the next check
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

  const grid = page.getByRole('grid', { name: 'Entries' });

  await expect(grid.getByRole('row')).toHaveText([
    /Unpublished Entries/,
    /Third Post.*Draft/,
    /Published Entries/,
    /First Post/,
    /Second Post.*Ready/,
  ]);

  const editor = await openEntry(page, 'Third Post');

  await editor.getByRole('textbox', { name: 'Body' }).fill('Now or never.');
  await editor.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('alertdialog', { name: 'Error' })).toContainText(
    /doesn’t have the .*cms\/posts\/third-post.* branch/,
  );
});
