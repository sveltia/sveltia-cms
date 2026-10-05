import { mkdtemp, readFile, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

import { test as base, expect } from '@playwright/test';
import { stringify } from 'yaml';

import { MockGitea } from './gitea.js';
import { MockGitHub } from './github.js';
import { MockGitLab } from './gitlab.js';

/**
 * @import { BrowserContext, Locator, Page } from '@playwright/test';
 */

/**
 * Name of the directory in the origin private file system (OPFS) where the `test-repo` backend
 * stores the repository files. Keep it in sync with `TEST_BACKEND_ROOT_DIR_NAME` in
 * `src/lib/services/backends/fs/test.js`.
 */
export const TEST_REPO_DIR_NAME = 'sveltia-cms-test';

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
 * CMS config for a Gitea or Forgejo repository, which the `gitea` fixture mocks.
 */
export const GITEA_CONFIG = {
  ...BASE_CONFIG,
  backend: { name: 'gitea', repo: 'sveltia/e2e-site', branch: 'main' },
};

/**
 * CMS config for a GitLab project, which the `gitlab` fixture mocks.
 */
export const GITLAB_CONFIG = {
  ...BASE_CONFIG,
  backend: { name: 'gitlab', repo: 'sveltia/e2e-site', branch: 'main' },
};

/**
 * Version of the CMS being tested, which the update check is told is the latest.
 */
const { version: CMS_VERSION } = JSON.parse(
  await readFile(new URL('../../package.json', import.meta.url), 'utf8'),
);

/**
 * The CMS on the test page.
 */
export class CMS {
  /**
   * Create a handle for the CMS on a page.
   * @param {Page} page Page.
   * @param {string} adminPath Path of the admin page.
   * @param {string} [siteOrigin] Origin to serve the admin page from instead of the test server.
   */
  constructor(page, adminPath, siteOrigin) {
    this.page = page;
    this.adminPath = adminPath;
    this.siteOrigin = siteOrigin;
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
    await this.page.goto(`${this.siteOrigin ?? ''}${this.adminPath}`);
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
 * Answer the requests the CMS makes for its site in a browser context: the config, the admin page
 * at another origin if any, and what it asks the CDN for. The `cms` fixture does this for the test
 * page; call it for another browser context, e.g. a phone.
 * @param {BrowserContext} context Browser context.
 * @param {object} args Arguments.
 * @param {object | string} args.config CMS config, as an object or a YAML string.
 * @param {string} [args.siteOrigin] Origin to serve the admin page from, passing its requests on to
 * the test server.
 * @param {string} [args.baseURL] URL of the test server.
 */
export const serveSite = async (context, { config, siteOrigin, baseURL }) => {
  if (siteOrigin) {
    await context.route(
      (url) => url.origin === siteOrigin,
      async (route) => {
        const { pathname, search } = new URL(route.request().url());

        await route.fulfill({
          response: await route.fetch({ url: `${baseURL}${pathname}${search}` }),
        });
      },
    );
  }

  // The CMS checks for a newer version on the CDN: it’s the one being tested
  await context.route('https://unpkg.com/@sveltia/cms/package.json', (route) =>
    route.fulfill({ json: { version: CMS_VERSION } }),
  );
  // The production bundle only includes the English strings and fetches the others from the CDN,
  // so answer that request with the file the build has generated
  await context.route('https://unpkg.com/@sveltia/cms@*/locales/*.json', async (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: await readFile(
        new URL(`../../package/locales/${route.request().url().split('/').pop()}`, import.meta.url),
      ),
    }),
  );
  // The CMS adds a cache-busting query to the URL, hence the trailing wildcard. A sign-in popup
  // opens the CMS as well, so the config is served to every page of the browser context. Routes
  // added later take precedence, so this one is answered rather than passed on to the server
  await context.route('**/admin/config.yml?*', (route) =>
    route.fulfill({
      contentType: 'application/yaml',
      body: typeof config === 'string' ? config : stringify(config),
    }),
  );
};

/**
 * @typedef {{
 * config: object | string, signedIn: boolean, siteOrigin: string | undefined, cms: CMS,
 * github: MockGitHub, gitlab: MockGitLab, gitea: MockGitea
 * }} TestFixtures
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
  // Whether the `github`, `gitlab` and `gitea` fixtures store a session for the user, so the CMS
  // signs in on its own; a test of the sign-in itself turns it off
  signedIn: [true, { option: true }],
  // An HTTPS origin like `https://cms.example.com` to serve the admin page from, for a feature the
  // CMS only offers off localhost. The requests to it are passed on to the test server
  siteOrigin: [undefined, { option: true }],
  // eslint-disable-next-line jsdoc/require-jsdoc
  cms: async ({ page, adminPath, config, siteOrigin, baseURL }, use) => {
    const context = page.context();

    await serveSite(context, { config, siteOrigin, baseURL });

    const cms = new CMS(page, adminPath, siteOrigin);

    await use(cms);
    await cms.cleanUp();
  },
  // A test that asks for this fixture signs in to a mocked GitHub repository when the page opens
  // eslint-disable-next-line jsdoc/require-jsdoc
  github: async ({ page, signedIn }, use) => {
    const github = new MockGitHub();

    await github.install(page, { signedIn });
    await use(github);

    expect(github.unhandled, 'Requests the GitHub mock couldn’t answer').toEqual([]);
  },
  // A test that asks for this fixture signs in to a mocked GitLab project when the page opens
  // eslint-disable-next-line jsdoc/require-jsdoc
  gitlab: async ({ page, signedIn }, use) => {
    const gitlab = new MockGitLab();

    await gitlab.install(page, { signedIn });
    await use(gitlab);

    expect(gitlab.unhandled, 'Requests the GitLab mock couldn’t answer').toEqual([]);
  },
  // A test that asks for this fixture signs in to a mocked Gitea repository when the page opens
  // eslint-disable-next-line jsdoc/require-jsdoc
  gitea: async ({ page, signedIn }, use) => {
    const gitea = new MockGitea();

    await gitea.install(page, { signedIn });
    await use(gitea);

    expect(gitea.unhandled, 'Requests the Gitea mock couldn’t answer').toEqual([]);
  },
});

export { expect };
