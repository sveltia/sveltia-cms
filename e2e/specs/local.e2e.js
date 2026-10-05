import { createPNG } from '../fixtures/files.js';
import { expect, GITHUB_CONFIG, test, TEST_REPO_DIR_NAME } from '../fixtures/test.js';

/**
 * @import { Locator, Page } from '@playwright/test';
 */

const POST_PATH = 'content/posts/first-post.md';
const FIRST_POST = '---\ntitle: First Post\n---\n\nHello, world!\n';

/**
 * A blog on GitHub with an image field, which offers to work with a local clone of the repository
 * on a page served from localhost.
 */
test.use({
  config: {
    ...GITHUB_CONFIG,
    collections: [
      {
        ...GITHUB_CONFIG.collections[0],
        fields: [
          { name: 'title', label: 'Title' },
          { name: 'cover', label: 'Cover', widget: 'image', required: false },
          { name: 'body', label: 'Body', widget: 'text' },
        ],
      },
    ],
  },
});

/**
 * Make the folder picker return a folder in the origin private file system (OPFS), as Playwright
 * can’t pick a folder in the browser’s own dialog. The `cms` fixture seeds and reads the same
 * folder as the `test-repo` backend’s, so `cms.seed()` and `cms.readRepo()` work on the local
 * clone. The folder the user picks is recorded in `window.pickedFolders`.
 *
 * The CMS remembers the folder by storing its handle in IndexedDB, and reading an OPFS handle back
 * from there closes the page in Playwright’s Chromium. So a test can’t reload the page while a
 * folder is remembered, and signing in again with the remembered folder isn’t covered.
 * @param {Page} page Page.
 * @param {object} [options] Options.
 * @param {boolean} [options.dismiss] Whether the user dismisses the picker instead.
 */
const stubFolderPicker = async (page, { dismiss = false } = {}) => {
  await page.addInitScript(
    ({ dirName, dismissPicker }) => {
      /** @type {any} */
      const win = window;

      win.pickedFolders = [];

      /**
       * Get the folder the user picks.
       * @returns {Promise<FileSystemDirectoryHandle>} Folder.
       */
      win.showDirectoryPicker = async () => {
        if (dismissPicker) {
          throw new DOMException('The user aborted a request.', 'AbortError');
        }

        win.pickedFolders.push(dirName);

        return (await navigator.storage.getDirectory()).getDirectoryHandle(dirName, {
          create: true,
        });
      };
    },
    { dirName: TEST_REPO_DIR_NAME, dismissPicker: dismiss },
  );
};

test.beforeEach(async ({ cms, page }) => {
  // The local clone is all the CMS works with, so GitHub is never asked
  await page.route('https://*.github.com/**', (route) => route.abort());
  await page.route('https://*.githubstatus.com/**', (route) => route.abort());
  await stubFolderPicker(page);
  await cms.open();
});

/**
 * Seed a local clone of the repository, with the `.git` folder that marks its root, and sign in by
 * picking it.
 * @param {import('../fixtures/test.js').CMS} cms CMS.
 * @param {Page} page Page.
 * @param {Record<string, string | Buffer>} [files] Files besides the first post.
 */
const signInWithClone = async (cms, page, files = {}) => {
  await cms.seed({ '.git/HEAD': 'ref: refs/heads/main\n', [POST_PATH]: FIRST_POST, ...files });
  await page.getByRole('button', { name: 'Work with Local Repository' }).click();
  await expect(page.getByRole('button', { name: 'Show Account Menu' })).toBeVisible();
};

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

test('offers to work with a local clone of the repository', async ({ page }) => {
  await expect(
    page.getByText(/Once prompted, select the root directory of the .*e2e-site.* repository\./),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Work with Local Repository' })).toBeEnabled();
  await expect(page.getByRole('button', { name: /^Sign In with .*GitHub/ })).toBeVisible();
});

test('lists the entries of the picked folder, and saves a change to its file', async ({
  cms,
  page,
}) => {
  await signInWithClone(cms, page);
  expect(await page.evaluate(() => /** @type {any} */ (window).pickedFolders)).toHaveLength(1);

  const editor = await openFirstPost(page);

  await editor.getByRole('textbox', { name: 'Body' }).fill('Hello from disk!');
  await editor.getByRole('button', { name: 'Save' }).click();

  await expect
    .poll(async () => (await cms.readRepo())[POST_PATH])
    .toBe("---\ntitle: First Post\ncover: ''\n---\n\nHello from disk!\n");
});

test('creates an entry with an image, then deletes it', async ({ cms, page }) => {
  const kite = createPNG({ color: [255, 255, 0] });

  await signInWithClone(cms, page);
  await page.getByRole('button', { name: 'Create New Entry' }).click();

  const editor = page.getByRole('group', { name: 'Content Editor' });

  await editor.getByRole('textbox', { name: 'Title' }).fill('Kites');
  await editor
    .getByRole('group', { name: '“\u2068Cover\u2069” Field' })
    .locator('input[type="file"]')
    .first()
    .setInputFiles({ name: 'kite.png', mimeType: 'image/png', buffer: kite });
  await editor.getByRole('textbox', { name: 'Body' }).fill('Up they go.');
  await editor.getByRole('button', { name: 'Save' }).click();

  await expect
    .poll(async () => (await cms.readRepo())['content/posts/kites.md'])
    .toBe('---\ntitle: Kites\ncover: /images/kite.png\n---\n\nUp they go.\n');
  expect(await cms.readRepoFile('static/images/kite.png')).toEqual(kite);

  await page.getByRole('row', { name: /Kites/ }).click();
  await page.getByRole('button', { name: 'Show Editor Options' }).click();
  await page.getByRole('menuitem', { name: 'Delete Entry' }).click();
  await page
    .getByRole('alertdialog', { name: 'Delete Entry' })
    .getByRole('button', { name: 'Delete' })
    .click();

  await expect.poll(async () => (await cms.readRepo())['content/posts/kites.md']).toBeUndefined();
  // The image stays in the media folder
  expect(await cms.readRepoFile('static/images/kite.png')).toEqual(kite);
});

test('shows an image from the folder', async ({ cms, page }) => {
  await signInWithClone(cms, page, {
    'static/images/sunset.png': createPNG({ color: [255, 128, 0] }),
  });
  await page.getByRole('radio', { name: 'Assets' }).click();
  await page.getByRole('row', { name: 'sunset.png' }).click();
  await page.getByRole('button', { name: 'Show Preview' }).click();

  const image = page.getByRole('group', { name: 'Asset Editor' }).getByRole('img', {
    name: 'sunset.png',
  });

  await expect.poll(() => image.evaluate((img) => img.naturalWidth)).toBe(32);
});

test('forgets the folder when signing out', async ({ cms, page }) => {
  await signInWithClone(cms, page);
  await cms.chooseMenuItem(
    page.getByRole('button', { name: 'Show Account Menu' }),
    page.getByRole('menuitem', { name: 'Sign Out' }),
  );
  await expect(page.getByRole('button', { name: 'Work with Local Repository' })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('button', { name: 'Work with Local Repository' })).toBeVisible();
});

test('accepts a Git worktree, whose `.git` is a file', async ({ cms, page }) => {
  await cms.seed({
    '.git': 'gitdir: /repos/e2e-site/.git/worktrees/main\n',
    [POST_PATH]: FIRST_POST,
  });
  await page.getByRole('button', { name: 'Work with Local Repository' }).click();

  await expect(page.getByRole('row', { name: /First Post/ })).toBeVisible();
});

test('refuses a folder that isn’t the root of a repository', async ({ cms, page }) => {
  await cms.seed({ [POST_PATH]: FIRST_POST });
  await page.getByRole('button', { name: 'Work with Local Repository' }).click();

  await expect(
    page.getByText('The selected folder is not a repository root directory. Please try again.'),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Show Account Menu' })).toHaveCount(0);
});

test.describe('with the picker dismissed', () => {
  test.beforeEach(async ({ page }) => {
    await stubFolderPicker(page, { dismiss: true });
    await page.reload();
  });

  test('says no folder was picked', async ({ page }) => {
    await page.getByRole('button', { name: 'Work with Local Repository' }).click();

    await expect(
      page.getByText('A repository root directory could not be selected. Please try again.'),
    ).toBeVisible();
  });
});
