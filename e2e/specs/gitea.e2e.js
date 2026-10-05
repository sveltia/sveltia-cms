import { createPNG } from '../fixtures/files.js';
import { getBlobSHA } from '../fixtures/git.js';
import { expect, GITEA_CONFIG, test } from '../fixtures/test.js';

/**
 * @import { Locator, Page } from '@playwright/test';
 */

const POST_PATH = 'content/posts/first-post.md';
const FIRST_POST = '---\ntitle: First Post\n---\n\nHello, world!\n';

test.use({ config: GITEA_CONFIG });

test.beforeEach(async ({ gitea }) => {
  gitea.commit({ [POST_PATH]: FIRST_POST }, { message: 'Add the first post' });
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

/**
 * Decode the Base64 content of a file in a commit request.
 * @param {Record<string, any>} file File in the request.
 * @returns {string} Content.
 */
const decode = ({ content }) => Buffer.from(content, 'base64').toString();

// Forgejo reports its version with the Gitea version it’s based on, and the CMS reads the files by
// their blob SHAs from another endpoint
[
  { name: 'Gitea', version: '1.24.0' },
  { name: 'Forgejo', version: '13.0.3+gitea-1.22.0' },
].forEach(({ name, version }) => {
  test.describe(name, () => {
    test.beforeEach(({ gitea }) => {
      gitea.version = version;
    });

    test('signs in with the stored session and lists the entries', async ({ cms, page }) => {
      await cms.open();
      await expect(page.getByRole('row', { name: 'First Post' })).toBeVisible();

      const editor = await openFirstPost(page);

      await expect(editor.getByRole('textbox', { name: 'Title' })).toHaveValue('First Post');
    });

    test('refuses to save over a colleague’s change made during the commit', async ({
      cms,
      gitea,
      page,
    }) => {
      await cms.open();

      const editor = await openFirstPost(page);

      // A colleague changes the same file between the check before saving and the commit itself,
      // so the blob SHA the commit carries is no longer the file’s
      // eslint-disable-next-line jsdoc/require-jsdoc
      gitea.beforeCommit = () => {
        gitea.commit({ [POST_PATH]: FIRST_POST.replace('Hello', 'Hi') });
      };

      await editor.getByRole('textbox', { name: 'Body' }).fill('Hello from Mona!');
      await editor.getByRole('button', { name: 'Save' }).click();

      const dialog = page.getByRole('alertdialog', { name: 'Error' });

      await expect(dialog).toContainText('The repository has been updated by someone else');
      // The colleague’s change is kept
      expect(gitea.readFile(POST_PATH)).toBe('---\ntitle: First Post\n---\n\nHi, world!\n');
    });
  });
});

test('lists the entries of a repository whose file tree spans several pages', async ({
  cms,
  gitea,
  page,
}) => {
  gitea.commit({
    'content/posts/second-post.md': '---\ntitle: Second Post\n---\n',
    'content/posts/third-post.md': '---\ntitle: Third Post\n---\n',
  });
  gitea.treePageSize = 2;
  await cms.open();

  await expect(page.getByRole('group', { name: 'Entry List' }).getByRole('row')).toHaveCount(3);
});

test('refuses a user who can only read the repository', async ({ cms, gitea, page }) => {
  gitea.canWrite = false;

  await cms.open();
  await expect(page.getByRole('alert')).toContainText(
    /You don’t have access to the .*e2e-site.* repository/,
  );
});

test('refuses an instance older than the supported version', async ({ cms, gitea, page }) => {
  gitea.version = '1.23.0';

  await cms.open();
  await expect(page.getByRole('alert')).toContainText(/Gitea.* 1\.24 or later/);
});

test('makes the content read-only when the user can’t push to the branch', async ({
  cms,
  gitea,
  page,
}) => {
  gitea.canPush = false;

  await cms.open();
  await expect(
    page.getByText(/You don’t have permission to push to the .*main.* branch/),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create New Entry' })).toBeDisabled();
});

test('commits a change, with the blob SHA of the file as it was loaded', async ({
  cms,
  gitea,
  page,
}) => {
  const sha = gitea.head.tree.get(POST_PATH);

  await cms.open();

  const editor = await openFirstPost(page);

  await editor.getByRole('textbox', { name: 'Body' }).fill('Hello from Mona!');
  await editor.getByRole('button', { name: 'Save' }).click();

  await expect
    .poll(() => gitea.readFile(POST_PATH))
    .toBe('---\ntitle: First Post\n---\n\nHello from Mona!\n');
  expect(gitea.received).toHaveLength(1);
  expect(gitea.received[0]).toMatchObject({
    branch: 'main',
    message: 'Update Post “first-post”',
    author: { name: gitea.user.name, email: gitea.user.email },
    files: [{ operation: 'update', path: POST_PATH, sha }],
  });
  expect(gitea.head.author.login).toBe(gitea.user.login);
});

test('creates an entry, then deletes it', async ({ cms, gitea, page }) => {
  await cms.open();
  await page.getByRole('button', { name: 'Create New Entry' }).click();

  const editor = page.getByRole('group', { name: 'Content Editor' });

  await editor.getByRole('textbox', { name: 'Title' }).fill('Second Post');
  await editor.getByRole('textbox', { name: 'Body' }).fill('Hello!');
  await editor.getByRole('button', { name: 'Save' }).click();

  await expect
    .poll(() => gitea.readFile('content/posts/second-post.md'))
    .toBe('---\ntitle: Second Post\n---\n\nHello!\n');
  expect(gitea.received[0].files).toEqual([
    expect.objectContaining({ operation: 'create', path: 'content/posts/second-post.md' }),
  ]);
  expect(decode(gitea.received[0].files[0])).toBe('---\ntitle: Second Post\n---\n\nHello!\n');

  await page.getByRole('row', { name: /Second Post/ }).click();
  await page.getByRole('button', { name: 'Show Editor Options' }).click();
  await page.getByRole('menuitem', { name: 'Delete Entry' }).click();
  await page
    .getByRole('alertdialog', { name: 'Delete Entry' })
    .getByRole('button', { name: 'Delete' })
    .click();

  await expect.poll(() => gitea.readFile('content/posts/second-post.md')).toBeUndefined();
  expect(gitea.received[1]).toMatchObject({
    message: 'Delete Post “second-post”',
    files: [{ operation: 'delete', path: 'content/posts/second-post.md' }],
  });
  await expect(page.getByRole('group', { name: 'Entry List' }).getByRole('row')).toHaveCount(1);
});

test('shows an image from the repository', async ({ cms, gitea, page }) => {
  gitea.commit({ 'static/images/sunset.png': createPNG({ color: [255, 128, 0] }) });
  await cms.open();
  await page.getByRole('radio', { name: 'Assets' }).click();
  await page.getByRole('row', { name: 'sunset.png' }).click();
  await page.getByRole('button', { name: 'Show Preview' }).click();

  const image = page.getByRole('group', { name: 'Asset Editor' }).getByRole('img', {
    name: 'sunset.png',
  });

  // The image is read from the media endpoint and decoded, not a broken one
  await expect.poll(() => image.evaluate((img) => img.naturalWidth)).toBe(32);
});

test('uploads an image along with the entry', async ({ cms, gitea, page }) => {
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

  await expect.poll(() => gitea.head.tree.get('static/images/kite.png')).toBe(getBlobSHA(kite));
  expect(gitea.received[0].files).toEqual([
    expect.objectContaining({ operation: 'create', content: kite.toString('base64') }),
  ]);
});

test('lists an entry a colleague has added, on the next scheduled check', async ({
  cms,
  gitea,
  page,
}) => {
  await page.clock.install();
  await cms.open();
  await expect(page.getByRole('row', { name: /First Post/ })).toBeVisible();

  gitea.commit({ 'content/posts/second-post.md': '---\ntitle: Second Post\n---\n' });
  await page.clock.fastForward('01:01');

  await expect(page.getByRole('row', { name: /Second Post/ })).toBeVisible();
});

test('warns before saving over a colleague’s change', async ({ cms, gitea, page }) => {
  await cms.open();

  const editor = await openFirstPost(page);

  gitea.commit({ [POST_PATH]: '---\ntitle: First Post\n---\n\nHello from Alex!\n' });
  await editor.getByRole('textbox', { name: 'Body' }).fill('Hello from Mona!');
  await editor.getByRole('button', { name: 'Save' }).click();

  const dialog = page.getByRole('alertdialog', { name: 'Entry Changed by Someone Else' });

  // Unlike GitHub, the file list doesn’t say who last changed a file, so the dialog can’t either
  await expect(dialog).toContainText(
    'This entry has been changed in the repository after you opened it.',
  );
  expect(gitea.received).toHaveLength(0);
  await dialog.getByRole('button', { name: 'Save Anyway' }).click();

  await expect
    .poll(() => gitea.readFile(POST_PATH))
    .toBe('---\ntitle: First Post\n---\n\nHello from Mona!\n');
});

test('lists the commits of an entry in the History panel', async ({ cms, gitea, page }) => {
  gitea.commit({ [POST_PATH]: FIRST_POST.replace('Hello', 'Hi') }, { author: gitea.user });
  // A commit to another file isn’t listed
  gitea.commit({ 'content/posts/second-post.md': '---\ntitle: Second Post\n---\n' });
  await cms.open();
  await page.getByRole('row', { name: /First Post/ }).click();
  await page
    .getByRole('radiogroup', { name: 'Sidebar Panels' })
    .getByRole('radio', { name: 'History' })
    .click();

  const commits = page.getByRole('group', { name: 'History', exact: true }).getByRole('link');

  await expect(commits).toHaveCount(2);
  await expect(commits.first()).toContainText(gitea.user.name);
  await expect(commits.last()).toContainText(gitea.colleague.name);

  // A commit opens on Gitea in a new tab
  await page
    .context()
    .route('https://gitea.com/sveltia/**', (route) => route.fulfill({ body: '' }));

  const [popup] = await Promise.all([page.waitForEvent('popup'), commits.last().click()]);

  expect(popup.url()).toBe(
    `https://gitea.com/sveltia/e2e-site/commit/${gitea.commits.at(-3)?.oid}`,
  );
});
