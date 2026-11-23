import { test } from '@playwright/test';

import { getLongTasks, now, Results, RUNS } from '../fixtures/measure.js';
import { openSession } from '../fixtures/session.js';
import { ASSET_COUNT, createImages, createPosts } from '../fixtures/sites.js';

/**
 * @import { Page } from '@playwright/test';
 */

/**
 * Wait until every thumbnail in the visible part of the asset grid has been loaded, and get the
 * time since the navigation started.
 * @param {Page} page Page.
 * @returns {Promise<number>} Time.
 */
const timeUntilThumbnailsShown = async (page) => {
  const handle = await page.waitForFunction(
    () => {
      const grid = document.querySelector('[role="grid"][aria-label="Assets"]');

      if (!grid) {
        return undefined;
      }

      const images = [...grid.querySelectorAll('img')].filter((image) => {
        const { top, bottom } = image.getBoundingClientRect();

        return bottom > 0 && top < window.innerHeight;
      });

      return images.length && images.every((image) => image.complete && image.naturalWidth)
        ? performance.now()
        : undefined;
    },
    undefined,
    { polling: 'raf', timeout: 300_000 },
  );

  return /** @type {number} */ (await handle.jsonValue());
};

test('shows the thumbnails of a large media folder', async ({ browser, baseURL }) => {
  const results = new Results('assets', { assets: ASSET_COUNT, runs: RUNS });
  const files = { ...createPosts(10), ...createImages() };

  for (let run = 0; run < RUNS; run += 1) {
    // eslint-disable-next-line no-await-in-loop
    const { context, page } = await openSession({
      browser,
      baseURL: /** @type {string} */ (baseURL),
      backend: 'test-repo',
      files,
    });

    // The thumbnails are generated from the full-size images, as none is cached yet
    // eslint-disable-next-line no-await-in-loop
    let start = await now(page);

    // eslint-disable-next-line no-await-in-loop
    await page.getByRole('radio', { name: 'Assets' }).click();
    // eslint-disable-next-line no-await-in-loop
    results.add('first screen of thumbnails', (await timeUntilThumbnailsShown(page)) - start);
    // eslint-disable-next-line no-await-in-loop
    results.add('first screen: long tasks', (await getLongTasks(page, start)).total);

    // Once generated, the thumbnails are cached: open the library again in a new page load
    // eslint-disable-next-line no-await-in-loop
    await page.waitForTimeout(2000);
    // eslint-disable-next-line no-await-in-loop
    await page.reload();
    // The session is kept, so the CMS signs in on its own
    // eslint-disable-next-line no-await-in-loop
    await page.getByRole('button', { name: 'Show Account Menu' }).waitFor();
    // eslint-disable-next-line no-await-in-loop
    start = await now(page);
    // eslint-disable-next-line no-await-in-loop
    await page.getByRole('radio', { name: 'Assets' }).click();
    // eslint-disable-next-line no-await-in-loop
    results.add('cached thumbnails', (await timeUntilThumbnailsShown(page)) - start);

    // eslint-disable-next-line no-await-in-loop
    await context.close();
  }

  await results.save();
});
