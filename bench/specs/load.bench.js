import { test } from '@playwright/test';

import { getLongTasks, Results, RUNS, timeUntil } from '../fixtures/measure.js';
import { openSession, waitForFileCache } from '../fixtures/session.js';
import { createPosts, ENTRY_COUNT } from '../fixtures/sites.js';

/**
 * The first row of the entry list, which is shown once the site data has been loaded and parsed.
 */
const FIRST_ROW = '[role="grid"] [role="row"]';

test('loads a large site from GitHub, cold and warm', async ({ browser, baseURL }) => {
  const results = new Results('load-github', { entries: ENTRY_COUNT, runs: RUNS });
  const files = createPosts();

  for (let run = 0; run < RUNS; run += 1) {
    // eslint-disable-next-line no-await-in-loop
    const { context, page, cms } = await openSession({
      browser,
      baseURL: /** @type {string} */ (baseURL),
      backend: 'github',
      files,
    });

    // A fresh browser context has nothing cached: every file is listed, fetched and parsed
    // eslint-disable-next-line no-await-in-loop
    await cms.open();
    // eslint-disable-next-line no-await-in-loop
    results.add('cold load', await timeUntil(page, FIRST_ROW));
    // eslint-disable-next-line no-await-in-loop
    results.add('cold load: long tasks', (await getLongTasks(page)).total);

    // The file cache, written once the site data is shown, is what a reload restores from
    // eslint-disable-next-line no-await-in-loop
    await waitForFileCache(page);
    // eslint-disable-next-line no-await-in-loop
    await page.reload();
    // eslint-disable-next-line no-await-in-loop
    results.add('warm load', await timeUntil(page, FIRST_ROW));
    // eslint-disable-next-line no-await-in-loop
    results.add('warm load: long tasks', (await getLongTasks(page)).total);

    // eslint-disable-next-line no-await-in-loop
    await context.close();
  }

  await results.save();
});

test('loads a large site from a local repository', async ({ browser, baseURL }) => {
  const results = new Results('load-local', { entries: ENTRY_COUNT, runs: RUNS });
  const files = createPosts();

  for (let run = 0; run < RUNS; run += 1) {
    // eslint-disable-next-line no-await-in-loop
    const { context, page } = await openSession({
      browser,
      baseURL: /** @type {string} */ (baseURL),
      backend: 'test-repo',
      files,
      signIn: false,
    });

    // The files are read from the origin private file system once signed in
    // eslint-disable-next-line no-await-in-loop
    const start = await page.evaluate(() => performance.now());

    // eslint-disable-next-line no-await-in-loop
    await page.getByRole('button', { name: 'Work with Test Repository' }).click();
    // eslint-disable-next-line no-await-in-loop
    results.add('load', (await timeUntil(page, FIRST_ROW)) - start);
    // eslint-disable-next-line no-await-in-loop
    results.add('load: long tasks', (await getLongTasks(page, start)).total);

    // eslint-disable-next-line no-await-in-loop
    await context.close();
  }

  await results.save();
});
