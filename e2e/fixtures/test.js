import { test as base, expect } from '@playwright/test';
import { stringify } from 'yaml';

/**
 * @import { Page } from '@playwright/test';
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
 * The CMS on the test page.
 */
class CMS {
  /**
   * Create a handle for the CMS on a page.
   * @param {Page} page Page.
   * @param {string} adminPath Path of the admin page.
   */
  constructor(page, adminPath) {
    this.page = page;
    this.adminPath = adminPath;
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
   * @param {Record<string, string>} files File content keyed by path, e.g. `content/posts/a.md`.
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

            await writable.write(content);
            await writable.close();
          }),
        );
      },
      { rootDirName: TEST_REPO_DIR_NAME, entries: Object.entries(files) },
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
 * @typedef {{ config: object | string, cms: CMS }} TestFixtures
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

    await use(new CMS(page, adminPath));
  },
});

export { expect };
