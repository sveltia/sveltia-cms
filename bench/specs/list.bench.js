import { expect, test } from '@playwright/test';

import { getEntryList } from '../../e2e/fixtures/ui.js';
import {
  getLongTasks,
  now,
  percentile,
  profile,
  Results,
  RUNS,
  startFrameTimer,
  stopFrameTimer,
  timeUntil,
} from '../fixtures/measure.js';
import { openSession } from '../fixtures/session.js';
import { createPosts, ENTRY_COUNT } from '../fixtures/sites.js';

test('shows, scrolls and sorts a long entry list', async ({ browser, baseURL }) => {
  const results = new Results('list', { entries: ENTRY_COUNT, runs: RUNS });
  const files = createPosts();

  for (let run = 0; run < RUNS; run += 1) {
    // eslint-disable-next-line no-await-in-loop
    const { context, page } = await openSession({
      browser,
      baseURL: /** @type {string} */ (baseURL),
      backend: 'test-repo',
      files,
    });

    const list = getEntryList(page);

    // The Posts collection is shown first. Switch to the Pages collection and back, to time
    // showing the long list without the loading in the way
    // eslint-disable-next-line no-await-in-loop
    await page.getByRole('treeitem', { name: /^Pages\b/ }).click();
    // eslint-disable-next-line no-await-in-loop
    await expect(page.getByRole('main', { name: /Pages.*Collection/ })).toBeVisible();

    // eslint-disable-next-line no-await-in-loop
    let start = await now(page);

    // eslint-disable-next-line no-await-in-loop
    await page.getByRole('treeitem', { name: /^Posts\b/ }).click();
    // eslint-disable-next-line no-await-in-loop
    results.add('show collection', (await timeUntil(page, '[role="grid"] [role="row"]')) - start);

    // Scroll to the end of the list with the mouse wheel, which renders more rows as it goes
    // eslint-disable-next-line no-await-in-loop
    await list.hover();
    // eslint-disable-next-line no-await-in-loop
    await startFrameTimer(page);
    // eslint-disable-next-line no-await-in-loop
    start = await now(page);

    for (let step = 0; step < 100; step += 1) {
      // eslint-disable-next-line no-await-in-loop
      await page.mouse.wheel(0, 2000);
      // eslint-disable-next-line no-await-in-loop
      await page.waitForTimeout(16);
    }

    // eslint-disable-next-line no-await-in-loop
    const frames = await stopFrameTimer(page);

    results.add('scroll: p95 frame', percentile(frames, 95));
    results.add('scroll: slowest frame', Math.max(...frames));
    results.add('scroll: frames over 50 ms', frames.filter((gap) => gap > 50).length, 'frames');
    // eslint-disable-next-line no-await-in-loop
    results.add('scroll: long tasks', (await getLongTasks(page, start)).total);

    // Sort the list by date, the newest first, which puts the last post at the top
    // eslint-disable-next-line no-await-in-loop
    await page.getByRole('button', { name: 'Sort', exact: true }).click();
    // eslint-disable-next-line no-await-in-loop
    start = await now(page);
    // eslint-disable-next-line no-await-in-loop
    await profile(page, `list-sort-${run}`, async () => {
      await page.getByRole('menuitemradio', { name: /Date.*new to old/i }).click();
      await expect(list.getByRole('row').first()).toHaveAccessibleName(
        new RegExp(`^Post ${String(ENTRY_COUNT).padStart(5, '0')}`),
      );
    });
    // eslint-disable-next-line no-await-in-loop
    results.add('sort by date', (await now(page)) - start);

    // eslint-disable-next-line no-await-in-loop
    await context.close();
  }

  await results.save();
});
