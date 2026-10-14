import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';

import { createPNG } from '../fixtures/files.js';
import { expect, GITHUB_CONFIG, test, TEST_REPO_DIR_NAME } from '../fixtures/test.js';
import { getEditor, getEntryRows, openFirstPost } from '../fixtures/ui.js';

/**
 * @import { Locator, Page } from '@playwright/test';
 */

const POST_PATH = 'content/posts/first-post.md';
const FIRST_POST = '---\ntitle: First Post\n---\n\nHello, world!\n';

/**
 * A blog on GitHub with an image field, which offers to work with a local clone of the repository
 * on a page served from localhost.
 */
const LOCAL_CONFIG = {
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
};

test.use({ config: LOCAL_CONFIG });

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

  const editor = getEditor(page);

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

test.describe('with a root directory', () => {
  test.use({
    config: { ...LOCAL_CONFIG, backend: { ...LOCAL_CONFIG.backend, root_dir: 'apps/blog' } },
  });

  test('works in the directory of the repository root that was picked', async ({ cms, page }) => {
    // The site lives in a subdirectory of a monorepo, next to another site
    await cms.seed({
      '.git/HEAD': 'ref: refs/heads/main\n',
      [`apps/blog/${POST_PATH}`]: FIRST_POST,
      [`apps/docs/${POST_PATH}`]: '---\ntitle: Docs Post\n---\n\nRead the docs.\n',
    });
    await page.getByRole('button', { name: 'Work with Local Repository' }).click();
    await expect(getEntryRows(page)).toHaveText([/First Post/]);

    const editor = await openFirstPost(page);

    await editor.getByRole('textbox', { name: 'Body' }).fill('Hello from the blog!');
    await editor.getByRole('button', { name: 'Save' }).click();

    await expect
      .poll(async () => (await cms.readRepo())[`apps/blog/${POST_PATH}`])
      .toBe("---\ntitle: First Post\ncover: ''\n---\n\nHello from the blog!\n");
    expect((await cms.readRepo())[POST_PATH]).toBeUndefined();
  });

  test('says so when the directory doesn’t exist', async ({ cms, page }) => {
    await cms.seed({ '.git/HEAD': 'ref: refs/heads/main\n', [POST_PATH]: FIRST_POST });
    await page.getByRole('button', { name: 'Work with Local Repository' }).click();

    // Not mistaken for a folder that isn’t the root of a repository
    await expect(
      page.getByText(/The root directory .*apps\/blog.* doesn’t exist in the .*e2e-site/),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Show Account Menu' })).toHaveCount(0);
  });
});

test.describe('Git commits', () => {
  /** @type {string[]} */
  const tempDirs = [];

  /**
   * Run a Git command, isolated from the user’s and system configuration.
   * @param {string} cwd Repository directory.
   * @param {...string} args Arguments.
   * @returns {string} Output, trimmed.
   */
  const git = (cwd, ...args) =>
    execFileSync('git', args, {
      cwd,
      env: {
        ...process.env,
        GIT_CONFIG_GLOBAL: '/dev/null',
        GIT_CONFIG_NOSYSTEM: '1',
        // No detached `git maintenance` after a commit
        GIT_CONFIG_COUNT: '1',
        GIT_CONFIG_KEY_0: 'maintenance.auto',
        GIT_CONFIG_VALUE_0: 'false',
      },
      stdio: 'pipe',
    })
      .toString()
      .trim();

  /**
   * Create a temporary directory, removed after the test.
   * @returns {Promise<string>} Path.
   */
  const createTempDir = async () => {
    const dir = await mkdtemp(join(tmpdir(), 'sveltia-e2e-git-'));

    tempDirs.push(dir);

    return dir;
  };

  /**
   * Create a clone of the repository with the `git` command, with its objects packed as they are
   * after `git clone`, and its branch in `.git/refs`, as the seeding can’t create the empty
   * directory Git requires there once the references are packed too. Then read its files, `.git`
   * included, to seed the folder the user picks.
   * @param {(dir: string) => Promise<void>} [prepare] Function to change the clone before reading.
   * @returns {Promise<{ dir: string, files: Record<string, Buffer> }>} Clone directory and files.
   */
  const createClone = async (prepare) => {
    const dir = await createTempDir();

    git(dir, 'init', '--initial-branch=main');
    git(dir, 'config', 'user.name', 'Jane Doe');
    git(dir, 'config', 'user.email', 'jane@example.com');
    await mkdir(join(dir, 'content/posts'), { recursive: true });
    await writeFile(join(dir, POST_PATH), FIRST_POST);
    await writeFile(join(dir, 'README.md'), 'Readme\n');
    git(dir, 'add', '.');
    git(dir, 'commit', '-m', 'Initial commit');
    git(dir, 'repack', '-a', '-d', '--quiet');
    git(dir, 'prune-packed');
    await prepare?.(dir);

    const entries = await readdir(dir, { recursive: true, withFileTypes: true });

    const files = Object.fromEntries(
      await Promise.all(
        entries
          .filter((entry) => entry.isFile() && !entry.parentPath.includes('.git/hooks'))
          .map(async (entry) => {
            const path = join(entry.parentPath, entry.name);

            return [relative(dir, path), await readFile(path)];
          }),
      ),
    );

    return { dir, files };
  };

  /**
   * Copy the folder the user picked back to a directory, to check it with the `git` command.
   * @param {Page} page Page.
   * @returns {Promise<string>} Directory.
   */
  const copyFolderBack = async (page) => {
    const dir = await createTempDir();

    /** @type {[string, string][]} */
    const entries = await page.evaluate(async (rootDirName) => {
      /** @type {[string, string][]} */
      const files = [];

      /**
       * Walk a directory recursively.
       * @param {FileSystemDirectoryHandle} dirHandle Directory handle.
       * @param {string} prefix Path of the directory, with a trailing slash.
       */
      const walk = async (dirHandle, prefix) => {
        /** @type {(FileSystemDirectoryHandle | FileSystemFileHandle)[]} */
        // @ts-ignore `values()` is missing from the TypeScript DOM library
        const handles = await Array.fromAsync(dirHandle.values());

        await Promise.all(
          handles.map(async (handle) => {
            if (handle.kind === 'directory') {
              // Keep the empty directories, as Git requires `.git/refs` to exist
              files.push([`${prefix}${handle.name}/`, '']);
              await walk(handle, `${prefix}${handle.name}/`);
            } else {
              const bytes = new Uint8Array(await (await handle.getFile()).arrayBuffer());

              files.push([`${prefix}${handle.name}`, bytes.toBase64()]);
            }
          }),
        );
      };

      await walk(
        await (await navigator.storage.getDirectory()).getDirectoryHandle(rootDirName),
        '',
      );

      return files;
    }, TEST_REPO_DIR_NAME);

    await Promise.all(
      entries.map(async ([path, base64]) => {
        if (path.endsWith('/')) {
          await mkdir(join(dir, path), { recursive: true });
        } else {
          await mkdir(dirname(join(dir, path)), { recursive: true });
          await writeFile(join(dir, path), Buffer.from(base64, 'base64'));
        }
      }),
    );

    return dir;
  };

  /**
   * Sign in with the given files, and open the Git commits setting, which is off by default.
   * @param {import('../fixtures/test.js').CMS} cms CMS.
   * @param {Page} page Page.
   * @param {Record<string, Buffer>} files Files of the clone.
   * @param {object} [options] Options.
   * @param {boolean} [options.enable] Whether to turn Git commits on.
   * @returns {Promise<Locator>} Settings dialog, still open.
   */
  const signInAndOpenGitSettings = async (cms, page, files, { enable = true } = {}) => {
    await cms.seed(files);
    await page.getByRole('button', { name: 'Work with Local Repository' }).click();
    await expect(page.getByRole('button', { name: 'Show Account Menu' })).toBeVisible();
    await cms.chooseMenuItem(
      page.getByRole('button', { name: 'Show Account Menu' }),
      page.getByRole('menuitem', { name: 'Settings' }),
    );

    const dialog = page.getByRole('dialog', { name: 'Settings' });

    await dialog.getByRole('tab', { name: 'Developer' }).click();

    const toggle = dialog.getByRole('switch', { name: 'Commit Changes to Git' });

    await expect(toggle).not.toBeChecked();

    if (enable) {
      await toggle.click();
      await expect(toggle).toBeChecked();
    }

    return dialog;
  };

  /**
   * Edit the body of the first post and save it.
   * @param {Page} page Page.
   */
  const editFirstPost = async (page) => {
    const editor = await openFirstPost(page);

    await editor.getByRole('textbox', { name: 'Body' }).fill('Hello from Git!');
    await editor.getByRole('button', { name: 'Save' }).click();
  };

  test.afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  test('commits a saved change to the current branch', async ({ cms, page }) => {
    const { dir: cloneDir, files } = await createClone();
    const initialHead = git(cloneDir, 'rev-parse', 'HEAD');
    const dialog = await signInAndOpenGitSettings(cms, page, files);

    // The text follows the icon and status names
    await expect(dialog.getByRole('status')).toContainText(
      'Changes will be committed to the \u2068main\u2069 branch as \u2068Jane Doe\u2069 (\u2068jane@example.com\u2069).',
    );
    await page.keyboard.press('Escape');
    await editFirstPost(page);

    // Wait for the whole commit, including the reflogs, which ends with the lock being removed
    await expect
      .poll(async () => {
        const repoFiles = await cms.readRepo();

        return (
          repoFiles['.git/refs/heads/main'] !== `${initialHead}\n` &&
          !('.git/index.lock' in repoFiles)
        );
      })
      .toBe(true);

    const dir = await copyFolderBack(page);

    expect(git(dir, 'rev-parse', 'HEAD~1')).toBe(initialHead);
    expect(git(dir, 'log', '-1', '--format=%an <%ae>%n%s')).toBe(
      'Jane Doe <jane@example.com>\nUpdate Post “first-post”',
    );
    expect(git(dir, 'show', '--name-status', '--format=', 'HEAD')).toBe(`M\t${POST_PATH}`);
    expect(git(dir, 'show', `HEAD:${POST_PATH}`)).toBe(
      "---\ntitle: First Post\ncover: ''\n---\n\nHello from Git!",
    );
    expect(git(dir, 'status', '--porcelain')).toBe('');
    expect(git(dir, 'reflog', '-1', '--format=%gs')).toBe('commit: Update Post “first-post”');
    expect(() => git(dir, 'fsck', '--strict', '--no-dangling')).not.toThrow();
  });

  test('only saves the change while Git commits are off, as by default', async ({ cms, page }) => {
    const { dir: cloneDir, files } = await createClone();
    const initialHead = git(cloneDir, 'rev-parse', 'HEAD');
    const dialog = await signInAndOpenGitSettings(cms, page, files, { enable: false });

    await expect(dialog.getByRole('status')).toHaveCount(0);
    await page.keyboard.press('Escape');
    await editFirstPost(page);

    await expect
      .poll(async () => (await cms.readRepo())[POST_PATH])
      .toBe("---\ntitle: First Post\ncover: ''\n---\n\nHello from Git!\n");

    const dir = await copyFolderBack(page);

    expect(git(dir, 'rev-parse', 'HEAD')).toBe(initialHead);
    // The change is left unstaged
    expect(git(dir, 'diff', '--name-only')).toBe(POST_PATH);
    expect(git(dir, 'diff', '--cached', '--name-only')).toBe('');
    await expect(page.getByText('saved but not committed to Git')).toHaveCount(0);
  });

  test('saves without committing while the user has staged changes', async ({ cms, page }) => {
    const { dir: cloneDir, files } = await createClone(async (dir) => {
      await writeFile(join(dir, 'README.md'), 'Work in progress\n');
      git(dir, 'add', 'README.md');
    });

    const initialHead = git(cloneDir, 'rev-parse', 'HEAD');
    const dialog = await signInAndOpenGitSettings(cms, page, files);

    // The text follows the icon and status names
    await expect(dialog.getByRole('alert')).toContainText(
      'Changes can’t be committed right now. \u2068You have other changes staged for commit. Commit or unstage them first.\u2069',
    );
    await page.keyboard.press('Escape');
    await editFirstPost(page);

    await expect(
      page.getByRole('alert').filter({ hasText: 'saved but not committed to Git' }),
    ).toBeVisible();
    await expect
      .poll(async () => (await cms.readRepo())[POST_PATH])
      .toBe("---\ntitle: First Post\ncover: ''\n---\n\nHello from Git!\n");

    const dir = await copyFolderBack(page);

    expect(git(dir, 'rev-parse', 'HEAD')).toBe(initialHead);
    // The user’s staged change is left as it was
    expect(git(dir, 'diff', '--cached', '--name-only')).toBe('README.md');
  });
});
