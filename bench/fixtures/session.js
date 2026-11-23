import { MockGitHub } from '../../e2e/fixtures/github.js';
import { CMS, serveSite } from '../../e2e/fixtures/test.js';

import { observeLongTasks } from './measure.js';
import { createConfig } from './sites.js';

/**
 * @import { Browser, BrowserContext, Page } from '@playwright/test';
 */

/**
 * Admin page served by the end-to-end tests’ server.
 */
const ADMIN_PATH = '/admin/';

/**
 * Options of every browser context, matching the Playwright config, as a context created by hand
 * doesn’t inherit them.
 */
const CONTEXT_OPTIONS = {
  timezoneId: 'UTC',
  locale: 'en-US',
  viewport: { width: 1440, height: 900 },
};

/**
 * @typedef {object} Session
 * @property {BrowserContext} context Browser context, fresh for each run, so nothing is cached.
 * @property {Page} page Page.
 * @property {CMS} cms CMS on the page.
 * @property {MockGitHub} [github] GitHub mock, for the `github` backend.
 */

/**
 * Open the CMS in a fresh browser context, with a repository holding the given files, and sign in.
 * With the `github` backend, the files are committed to a mocked GitHub repository and the CMS
 * signs in on its own when the page opens; with `test-repo`, they’re written to the origin private
 * file system and the CMS is signed in once they’re there.
 * @param {object} args Arguments.
 * @param {Browser} args.browser Browser.
 * @param {string} args.baseURL URL of the test server.
 * @param {'github' | 'test-repo'} args.backend Backend.
 * @param {Record<string, string | Buffer>} args.files Repository files.
 * @param {boolean} [args.signIn] Whether to sign in to `test-repo` right away. Turn it off to time
 * the sign-in, which is when the site data is loaded. Ignored for `github`.
 * @returns {Promise<Session>} Session.
 */
export const openSession = async ({ browser, baseURL, backend, files, signIn = true }) => {
  const context = await browser.newContext({ ...CONTEXT_OPTIONS, baseURL });

  // A context created by hand doesn’t get the `actionTimeout` of the config, and an action would
  // otherwise wait for good, e.g. for a field that isn’t rendered
  context.setDefaultTimeout(30_000);

  const page = await context.newPage();

  const config = createConfig(
    backend === 'github'
      ? { name: 'github', repo: 'sveltia/e2e-site', branch: 'main' }
      : { name: 'test-repo' },
  );

  await serveSite(context, { config, baseURL });
  await observeLongTasks(page);

  const cms = new CMS(page, ADMIN_PATH);

  if (backend === 'github') {
    const github = new MockGitHub();

    github.commit(files, { message: 'Add the benchmark site' });
    await github.install(page);

    return { context, page, cms, github };
  }

  await cms.open();
  await cms.seed(files);

  if (signIn) {
    await cms.signIn();
  }

  return { context, page, cms };
};

/**
 * Wait until the file cache records the commit the site data was loaded at, which is the last step
 * of a load, done in the background once the data is shown. A reload before then would find the
 * cache incomplete and fetch the files again.
 * @param {Page} page Page.
 */
export const waitForFileCache = async (page) => {
  await page.waitForFunction(
    async () => {
      const databases = await indexedDB.databases();

      const results = await Promise.all(
        databases.map(
          ({ name }) =>
            new Promise((resolve) => {
              const request = indexedDB.open(/** @type {string} */ (name));

              request.addEventListener('error', () => resolve(false));
              request.addEventListener('success', () => {
                const db = request.result;

                try {
                  const get = db.transaction('meta').objectStore('meta').get('last_commit_hash');

                  get.addEventListener('success', () => {
                    db.close();
                    resolve(!!get.result);
                  });
                  get.addEventListener('error', () => {
                    db.close();
                    resolve(false);
                  });
                } catch {
                  // The database has no `meta` store (yet)
                  db.close();
                  resolve(false);
                }
              });
            }),
        ),
      );

      return results.some(Boolean);
    },
    undefined,
    { polling: 250, timeout: 120_000 },
  );
};
