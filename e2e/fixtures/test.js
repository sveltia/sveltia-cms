import { mkdtemp, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

import { test as base, expect } from '@playwright/test';
import { stringify } from 'yaml';

import { MockGitHub } from './github.js';

/**
 * @import { Locator, Page } from '@playwright/test';
 */

/**
 * Name of the directory in the origin private file system (OPFS) where the `test-repo` backend
 * stores the repository files. Keep it in sync with `TEST_BACKEND_ROOT_DIR_NAME` in
 * `src/lib/services/backends/fs/test.js`.
 */
const TEST_REPO_DIR_NAME = 'sveltia-cms-test';

/**
 * Default CMS config: a blog on the `test-repo` backend, which needs no authentication and keeps
 * the files in OPFS. Every test runs in a fresh browser context, so it starts with an empty
 * repository.
 */
export const BASE_CONFIG = {
  backend: { name: 'test-repo' },
  media_folder: 'static/images',
  public_folder: '/images',
  collections: [
    {
      name: 'posts',
      label: 'Posts',
      label_singular: 'Post',
      folder: 'content/posts',
      create: true,
      fields: [
        { name: 'title', label: 'Title' },
        { name: 'body', label: 'Body', widget: 'text' },
      ],
    },
  ],
};

/**
 * CMS config for a GitHub repository, which the `github` fixture mocks. Use it with
 * `test.use({ config: GITHUB_CONFIG })` and the `github` fixture in the test.
 */
export const GITHUB_CONFIG = {
  ...BASE_CONFIG,
  backend: { name: 'github', repo: 'sveltia/e2e-site', branch: 'main' },
};

/**
 * The CMS on the test page.
 */
export class CMS {
  /**
   * Create a handle for the CMS on a page.
   * @param {Page} page Page.
   * @param {string} adminPath Path of the admin page.
   */
  constructor(page, adminPath) {
    this.page = page;
    this.adminPath = adminPath;
    /**
     * Temporary directories holding the files dropped with {@link dropFiles}.
     * @type {string[]}
     */
    this.tempDirs = [];
  }

  /**
   * Remove the temporary files the test has created.
   */
  async cleanUp() {
    await Promise.all(this.tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
  }

  /**
   * Open the admin page.
   */
  async open() {
    await this.page.goto(this.adminPath);
  }

  /**
   * Write files to the test repository. Call this after {@link open}, as OPFS is per origin, and
   * before {@link signIn}, which is when the backend reads them.
   * @param {Record<string, string | Buffer>} files File content keyed by path, e.g.
   * `content/posts/a.md`: text, or a `Buffer` for a binary file such as an image.
   */
  async seed(files) {
    await this.page.evaluate(
      async ({ rootDirName, entries }) => {
        const rootDir = await (
          await navigator.storage.getDirectory()
        ).getDirectoryHandle(rootDirName, { create: true });

        await Promise.all(
          entries.map(async ([path, content]) => {
            const segments = path.split('/');
            const fileName = /** @type {string} */ (segments.pop());

            const dir = await segments.reduce(
              async (parent, segment) =>
                (await parent).getDirectoryHandle(segment, { create: true }),
              Promise.resolve(rootDir),
            );

            const writable = await (
              await dir.getFileHandle(fileName, { create: true })
            ).createWritable();

            await writable.write(
              typeof content === 'string'
                ? content
                : Uint8Array.from(atob(content.base64), (char) => char.charCodeAt(0)),
            );
            await writable.close();
          }),
        );
      },
      {
        rootDirName: TEST_REPO_DIR_NAME,
        // A `Buffer` can’t be passed to the page as is, so send binary content as Base64
        entries: Object.entries(files).map(([path, content]) => [
          path,
          typeof content === 'string' ? content : { base64: content.toString('base64') },
        ]),
      },
    );
  }

  /**
   * Sign in with the test backend and wait for the main UI.
   */
  async signIn() {
    await this.page.getByRole('button', { name: 'Work with Test Repository' }).click();
    await expect(this.page.getByRole('button', { name: 'Show Account Menu' })).toBeVisible();
  }

  /**
   * Open a popup, e.g. a menu or a dropdown list, and wait until it’s shown.
   * @param {Locator} trigger Element that opens the popup, e.g. a button or a combobox.
   * @param {Locator} popup Popup, or an element in it.
   */
  async openPopup(trigger, popup) {
    await trigger.click();
    await expect(popup).toBeVisible();
  }

  /**
   * Open a menu and choose one of its items.
   * @param {Locator} button Button that opens the menu.
   * @param {Locator} item Menu item.
   */
  async chooseMenuItem(button, item) {
    await this.openPopup(button, item);
    await item.click();
  }

  /**
   * Drop files on an element, as a user does from the file manager. A `drop` event dispatched from
   * the page is ignored, as its files can’t be read as file system entries, so the files are
   * written to disk and dragged in by the browser.
   * @param {Locator} target Element to drop the files on.
   * @param {{ name: string, buffer: Buffer }[]} files Files to drop.
   */
  async dropFiles(target, files) {
    const dir = await mkdtemp(join(tmpdir(), 'sveltia-cms-e2e-'));

    this.tempDirs.push(dir);

    const paths = await Promise.all(
      files.map(async ({ name, buffer }) => {
        const path = join(dir, name);

        await writeFile(path, buffer);

        return path;
      }),
    );

    const box = /** @type {{ x: number, y: number, width: number, height: number }} */ (
      await target.boundingBox()
    );

    const cdp = await this.page.context().newCDPSession(this.page);
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    const data = { items: [], files: paths, dragOperationsMask: 1 }; // copy

    await cdp.send('Input.dispatchDragEvent', { type: 'dragEnter', x, y, data });
    // Chromium only drops once the page has accepted the drag in a `dragover` handler, which is
    // when the drop zone shows its indicator; a drop sent before that is lost. The page doesn’t
    // always get the first `dragover`, so send it until the indicator shows up
    await expect(async () => {
      await cdp.send('Input.dispatchDragEvent', { type: 'dragOver', x, y, data });
      await expect(this.page.getByText(/^Drop (a file|files) here$/)).toBeVisible({
        timeout: 200,
      });
    }).toPass();
    await cdp.send('Input.dispatchDragEvent', { type: 'drop', x, y, data });
    await cdp.detach();
  }

  /**
   * Read all the files in the test repository, to check what the CMS has written.
   * @returns {Promise<Record<string, string>>} File content keyed by path.
   */
  async readRepo() {
    return this.page.evaluate(async (rootDirName) => {
      /** @type {Record<string, string>} */
      const files = {};

      /**
       * Walk a directory recursively.
       * @param {FileSystemDirectoryHandle} dir Directory handle.
       * @param {string} prefix Path of the directory, with a trailing slash.
       */
      const walk = async (dir, prefix) => {
        /** @type {(FileSystemDirectoryHandle | FileSystemFileHandle)[]} */
        // @ts-ignore `values()` is missing from the TypeScript DOM library
        const handles = await Array.fromAsync(dir.values());

        await Promise.all(
          handles.map(async (handle) => {
            if (handle.kind === 'directory') {
              await walk(handle, `${prefix}${handle.name}/`);
            } else {
              files[`${prefix}${handle.name}`] = await (await handle.getFile()).text();
            }
          }),
        );
      };

      try {
        await walk(
          await (await navigator.storage.getDirectory()).getDirectoryHandle(rootDirName),
          '',
        );
      } catch {
        // The repository is empty
      }

      return files;
    }, TEST_REPO_DIR_NAME);
  }

  /**
   * Read a binary file in the test repository, e.g. an uploaded image, which {@link readRepo}
   * can’t return intact as text.
   * @param {string} path File path, e.g. `static/images/photo.png`.
   * @returns {Promise<Buffer | undefined>} File content, or `undefined` if the file doesn’t exist.
   */
  async readRepoFile(path) {
    const bytes = await this.page.evaluate(
      async ({ rootDirName, segments }) => {
        try {
          const fileName = /** @type {string} */ (segments.pop());

          const dir = await segments.reduce(
            async (parent, segment) => (await parent).getDirectoryHandle(segment),
            (await navigator.storage.getDirectory()).getDirectoryHandle(rootDirName),
          );

          const file = await (await dir.getFileHandle(fileName)).getFile();

          return [...new Uint8Array(await file.arrayBuffer())];
        } catch {
          return undefined;
        }
      },
      { rootDirName: TEST_REPO_DIR_NAME, segments: path.split('/') },
    );

    return bytes ? Buffer.from(bytes) : undefined;
  }
}

/**
 * @typedef {{ config: object | string, cms: CMS, github: MockGitHub }} TestFixtures
 * @typedef {{ adminPath: string }} WorkerFixtures
 */

/**
 * Playwright `test` with the CMS fixtures. A test file can set its own config with
 * `test.use({ config })`; it’s served as the `config.yml` next to the admin page.
 * @type {ReturnType<typeof base.extend<TestFixtures, WorkerFixtures>>}
 */
export const test = base.extend({
  adminPath: ['/admin/', { option: true, scope: 'worker' }],
  config: [BASE_CONFIG, { option: true }],
  // eslint-disable-next-line jsdoc/require-jsdoc
  cms: async ({ page, adminPath, config }, use) => {
    // The CMS adds a cache-busting query to the URL, hence the trailing wildcard
    await page.route('**/admin/config.yml?*', (route) =>
      route.fulfill({
        contentType: 'application/yaml',
        body: typeof config === 'string' ? config : stringify(config),
      }),
    );

    const cms = new CMS(page, adminPath);

    await use(cms);
    await cms.cleanUp();
  },
  // A test that asks for this fixture signs in to a mocked GitHub repository when the page opens
  // eslint-disable-next-line jsdoc/require-jsdoc
  github: async ({ page }, use) => {
    const github = new MockGitHub();

    await github.install(page);
    await use(github);

    expect(github.unhandled, 'Requests the GitHub mock couldn’t answer').toEqual([]);
  },
});

export { expect };
