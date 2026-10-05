import { createPNG } from '../fixtures/files.js';
import { getBlobSHA } from '../fixtures/git.js';
import { expect, GITLAB_CONFIG, test } from '../fixtures/test.js';

/**
 * @import { Locator, Page } from '@playwright/test';
 */

const POST_PATH = 'content/posts/first-post.md';
const FIRST_POST = '---\ntitle: First Post\n---\n\nHello, world!\n';

test.use({ config: GITLAB_CONFIG });

test.beforeEach(async ({ gitlab }) => {
  gitlab.commit({ [POST_PATH]: FIRST_POST }, { message: 'Add the first post' });
});

/**
 * Open the first post in the entry editor.
 * @param {Page} page Page.
 * @returns {Promise<Locator>} Editor.
 */
const openFirstPost = async (page) => {
  const editor = page.getByRole('group', { name: 'Content Editor' });

  await page.getByRole('row', { name: /First Post/ }).click();
  await expect(editor.getByRole('textbox', { name: 'Body' })).toHaveValue('Hello, world!');

  return editor;
};

test('signs in with the stored session and lists the entries', async ({ cms, page }) => {
  await cms.open();
  await expect(page.getByRole('row', { name: 'First Post' })).toBeVisible();

  const editor = await openFirstPost(page);

  await expect(editor.getByRole('textbox', { name: 'Title' })).toHaveValue('First Post');
});

test('lists the entries of a project with more files than a page of the file list', async ({
  cms,
  gitlab,
  page,
}) => {
  gitlab.commit({
    'content/posts/second-post.md': '---\ntitle: Second Post\n---\n',
    'content/posts/third-post.md': '---\ntitle: Third Post\n---\n',
  });
  gitlab.treePageSize = 2;
  await cms.open();

  await expect(page.getByRole('group', { name: 'Entry List' }).getByRole('row')).toHaveCount(3);
});

test('refuses a user who can’t push code to the project', async ({ cms, gitlab, page }) => {
  gitlab.canWrite = false;

  await cms.open();
  await expect(page.getByRole('alert')).toContainText(
    /You don’t have access to the .*e2e-site.* repository/,
  );
});

test('makes the content read-only when the user can’t push to the branch', async ({
  cms,
  gitlab,
  page,
}) => {
  gitlab.canPush = false;

  await cms.open();
  await expect(
    page.getByText(/You don’t have permission to push to the .*main.* branch/),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create New Entry' })).toBeDisabled();
});

test('tells the user about an incident on GitLab', async ({ cms, gitlab, page }) => {
  gitlab.statusCode = 500;
  await cms.open();

  await expect(page.getByRole('alert').filter({ hasText: /is experiencing/ })).toHaveText(
    /GitLab.* is experiencing a major incident\./,
  );
});

test('commits a change, with the head the file was loaded at', async ({ cms, gitlab, page }) => {
  const { oid: headBefore } = gitlab.head;

  await cms.open();

  const editor = await openFirstPost(page);

  await editor.getByRole('textbox', { name: 'Body' }).fill('Hello from Mona!');
  await editor.getByRole('button', { name: 'Save' }).click();

  await expect
    .poll(() => gitlab.readFile(POST_PATH))
    .toBe('---\ntitle: First Post\n---\n\nHello from Mona!\n');
  expect(gitlab.received).toEqual([
    {
      branch: 'main',
      commit_message: 'Update Post “first-post”',
      actions: [
        {
          action: 'update',
          file_path: POST_PATH,
          content: '---\ntitle: First Post\n---\n\nHello from Mona!\n',
          encoding: 'text',
          last_commit_id: headBefore,
        },
      ],
    },
  ]);
  expect(gitlab.head.author.login).toBe(gitlab.user.login);
});

test('creates an entry, then deletes it', async ({ cms, gitlab, page }) => {
  await cms.open();
  await page.getByRole('button', { name: 'Create New Entry' }).click();

  const editor = page.getByRole('group', { name: 'Content Editor' });

  await editor.getByRole('textbox', { name: 'Title' }).fill('Second Post');
  await editor.getByRole('textbox', { name: 'Body' }).fill('Hello!');
  await editor.getByRole('button', { name: 'Save' }).click();

  await expect
    .poll(() => gitlab.readFile('content/posts/second-post.md'))
    .toBe('---\ntitle: Second Post\n---\n\nHello!\n');
  // A new file has no last commit to check
  expect(gitlab.received[0].actions).toEqual([
    {
      action: 'create',
      file_path: 'content/posts/second-post.md',
      content: '---\ntitle: Second Post\n---\n\nHello!\n',
      encoding: 'text',
    },
  ]);

  await page.getByRole('row', { name: /Second Post/ }).click();
  await page.getByRole('button', { name: 'Show Editor Options' }).click();
  await page.getByRole('menuitem', { name: 'Delete Entry' }).click();
  await page
    .getByRole('alertdialog', { name: 'Delete Entry' })
    .getByRole('button', { name: 'Delete' })
    .click();

  await expect.poll(() => gitlab.readFile('content/posts/second-post.md')).toBeUndefined();
  expect(gitlab.received[1]).toMatchObject({
    commit_message: 'Delete Post “second-post”',
    actions: [
      {
        action: 'delete',
        file_path: 'content/posts/second-post.md',
        last_commit_id: gitlab.head.parents[0],
      },
    ],
  });
  await expect(page.getByRole('group', { name: 'Entry List' }).getByRole('row')).toHaveCount(1);
});

test('shows an image from the project', async ({ cms, gitlab, page }) => {
  gitlab.commit({ 'static/images/sunset.png': createPNG({ color: [255, 128, 0] }) });
  await cms.open();
  await page.getByRole('radio', { name: 'Assets' }).click();
  await page.getByRole('row', { name: 'sunset.png' }).click();
  await page.getByRole('button', { name: 'Show Preview' }).click();

  const image = page.getByRole('group', { name: 'Asset Editor' }).getByRole('img', {
    name: 'sunset.png',
  });

  // The image is read from the raw file endpoint and decoded, not a broken one
  await expect.poll(() => image.evaluate((img) => img.naturalWidth)).toBe(32);
});

test('uploads an image', async ({ cms, gitlab, page }) => {
  const kite = createPNG({ color: [255, 255, 0] });

  await cms.open();
  await page.getByRole('radio', { name: 'Assets' }).click();
  // The empty asset list has a button of its own
  await page.getByRole('button', { name: 'Upload New Assets' }).first().click();

  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page
      .getByRole('dialog', { name: 'Upload New Assets' })
      .getByRole('button', { name: 'Choose Files' })
      .click(),
  ]);

  await chooser.setFiles({ name: 'kite.png', mimeType: 'image/png', buffer: kite });
  await page
    .getByRole('alertdialog', { name: 'Upload New Assets' })
    .getByRole('button', { name: 'Upload' })
    .click();

  await expect.poll(() => gitlab.head.tree.get('static/images/kite.png')).toBe(getBlobSHA(kite));
  expect(gitlab.received[0].actions).toEqual([
    expect.objectContaining({
      action: 'create',
      encoding: 'base64',
      content: kite.toString('base64'),
    }),
  ]);
});

test('lists an entry a colleague has added, on the next scheduled check', async ({
  cms,
  gitlab,
  page,
}) => {
  await page.clock.install();
  await cms.open();
  await expect(page.getByRole('row', { name: /First Post/ })).toBeVisible();

  gitlab.commit({ 'content/posts/second-post.md': '---\ntitle: Second Post\n---\n' });
  await page.clock.fastForward('01:01');

  await expect(page.getByRole('row', { name: /Second Post/ })).toBeVisible();
});

test('warns before saving over a colleague’s change', async ({ cms, gitlab, page }) => {
  await cms.open();

  const editor = await openFirstPost(page);

  gitlab.commit({ [POST_PATH]: '---\ntitle: First Post\n---\n\nHello from Alex!\n' });
  await editor.getByRole('textbox', { name: 'Body' }).fill('Hello from Mona!');
  await editor.getByRole('button', { name: 'Save' }).click();

  const dialog = page.getByRole('alertdialog', { name: 'Entry Changed by Someone Else' });

  await expect(dialog).toContainText(
    'This entry has been changed in the repository after you opened it.',
  );
  expect(gitlab.received).toHaveLength(0);
  await dialog.getByRole('button', { name: 'Save Anyway' }).click();

  await expect
    .poll(() => gitlab.readFile(POST_PATH))
    .toBe('---\ntitle: First Post\n---\n\nHello from Mona!\n');
});

test('refuses to save over a colleague’s change made during the commit', async ({
  cms,
  gitlab,
  page,
}) => {
  await cms.open();

  const editor = await openFirstPost(page);

  // A colleague changes the same file between the check before saving and the commit itself, so
  // the file’s last commit is no longer the one as of the head the commit carries
  // eslint-disable-next-line jsdoc/require-jsdoc
  gitlab.beforeCommit = () => {
    gitlab.commit({ [POST_PATH]: FIRST_POST.replace('Hello', 'Hi') });
  };

  await editor.getByRole('textbox', { name: 'Body' }).fill('Hello from Mona!');
  await editor.getByRole('button', { name: 'Save' }).click();

  const dialog = page.getByRole('alertdialog', { name: 'Error' });

  await expect(dialog).toContainText('The repository has been updated by someone else');
  // The colleague’s change is kept
  expect(gitlab.readFile(POST_PATH)).toBe('---\ntitle: First Post\n---\n\nHi, world!\n');
});

test('saves a change while a colleague changes another file', async ({ cms, gitlab, page }) => {
  await cms.open();

  const editor = await openFirstPost(page);

  // GitLab only checks the files being changed, so a commit to another file doesn’t get in the way
  // eslint-disable-next-line jsdoc/require-jsdoc
  gitlab.beforeCommit = () => {
    gitlab.commit({ 'content/posts/second-post.md': '---\ntitle: Second Post\n---\n' });
  };

  await editor.getByRole('textbox', { name: 'Body' }).fill('Hello from Mona!');
  await editor.getByRole('button', { name: 'Save' }).click();

  await expect
    .poll(() => gitlab.readFile(POST_PATH))
    .toBe('---\ntitle: First Post\n---\n\nHello from Mona!\n');
  expect(gitlab.readFile('content/posts/second-post.md')).toBe('---\ntitle: Second Post\n---\n');
});

test('lists the commits of an entry in the History panel', async ({ cms, gitlab, page }) => {
  gitlab.commit({ [POST_PATH]: FIRST_POST.replace('Hello', 'Hi') }, { author: gitlab.user });
  // A commit to another file isn’t listed
  gitlab.commit({ 'content/posts/second-post.md': '---\ntitle: Second Post\n---\n' });
  await cms.open();
  await page.getByRole('row', { name: /First Post/ }).click();
  await page
    .getByRole('radiogroup', { name: 'Sidebar Panels' })
    .getByRole('radio', { name: 'History' })
    .click();

  const commits = page.getByRole('group', { name: 'History', exact: true }).getByRole('link');

  await expect(commits).toHaveCount(2);
  await expect(commits.first()).toContainText(gitlab.user.name);
  await expect(commits.last()).toContainText(gitlab.colleague.name);

  // A commit opens on GitLab in a new tab
  await page
    .context()
    .route('https://gitlab.com/sveltia/**', (route) => route.fulfill({ body: '' }));

  const [popup] = await Promise.all([page.waitForEvent('popup'), commits.last().click()]);

  expect(popup.url()).toBe(
    `https://gitlab.com/sveltia/e2e-site/-/commit/${gitlab.commits.at(-3)?.oid}`,
  );
});
