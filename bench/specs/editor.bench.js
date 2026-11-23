import { expect, test } from '@playwright/test';

import { getEditor, openCollection } from '../../e2e/fixtures/ui.js';
import {
  getKeystrokeLatencies,
  getLongTasks,
  now,
  percentile,
  profile,
  Results,
  RUNS,
  startKeystrokeTimer,
} from '../fixtures/measure.js';
import { openSession } from '../fixtures/session.js';
import { createNestedPage, createPosts, NESTED_PAGE_TITLE } from '../fixtures/sites.js';

/**
 * @import { Locator, Page } from '@playwright/test';
 */

/**
 * Text typed into a field, a character at a time.
 */
const TYPED_TEXT = ' and some more words typed one by one';
/**
 * Delay between keystrokes in milliseconds: a fast typist, so a slow keystroke delays the next.
 */
const KEYSTROKE_DELAY = 50;

/**
 * Type into a text box a character at a time, and record how long the keystrokes took to show.
 * @param {object} args Arguments.
 * @param {Page} args.page Page.
 * @param {Locator} args.textbox Text box.
 * @param {Results} args.results Results.
 * @param {string} args.name Name of the metrics, e.g. `typing in a top-level field`.
 */
const measureTyping = async ({ page, textbox, results, name }) => {
  await textbox.click();
  // The End key doesn’t move the caret on macOS
  await textbox.evaluate((/** @type {HTMLInputElement} */ input) => {
    input.setSelectionRange(input.value.length, input.value.length);
  });
  await startKeystrokeTimer(page);

  const start = await now(page);

  await profile(page, `editor-${name.replace(/\W+/g, '-')}`, () =>
    textbox.pressSequentially(TYPED_TEXT, { delay: KEYSTROKE_DELAY }),
  );
  await expect(textbox).toHaveValue(new RegExp(`${TYPED_TEXT}$`));
  // Let the last keystroke reach the screen
  await page.waitForTimeout(500);

  const latencies = await getKeystrokeLatencies(page);

  results.add(`${name}: median keystroke`, percentile(latencies, 50));
  results.add(`${name}: p95 keystroke`, percentile(latencies, 95));
  results.add(`${name}: slowest keystroke`, Math.max(...latencies));
  results.add(`${name}: long tasks`, (await getLongTasks(page, start)).total);
};

/**
 * Scroll down the given pane until the given element has been rendered.
 * @param {Page} page Page.
 * @param {Locator} pane Editor pane.
 * @param {Locator} target Element.
 */
const scrollUntilRendered = async (page, pane, target) => {
  await pane.hover();

  // eslint-disable-next-line no-await-in-loop
  for (let step = 0; step < 50 && !(await target.count()); step += 1) {
    // eslint-disable-next-line no-await-in-loop
    await page.mouse.wheel(0, 500);
    // eslint-disable-next-line no-await-in-loop
    await page.waitForTimeout(50);
  }

  await target.scrollIntoViewIfNeeded();
};

/**
 * Scroll through the given pane to the end and back, so every field in it is rendered.
 * @param {Page} page Page.
 * @param {Locator} pane Editor pane.
 */
const renderAllFields = async (page, pane) => {
  await pane.hover();

  for (let step = 0; step < 200; step += 1) {
    // eslint-disable-next-line no-await-in-loop
    await page.mouse.wheel(0, 1000);
    // eslint-disable-next-line no-await-in-loop
    await page.waitForTimeout(20);
  }

  for (let step = 0; step < 200; step += 1) {
    // eslint-disable-next-line no-await-in-loop
    await page.mouse.wheel(0, -1000);
  }

  await page.waitForTimeout(500);
};

test('opens a deeply nested entry and types in it', async ({ browser, baseURL }) => {
  const results = new Results('editor', { sections: 30, runs: RUNS });
  const files = { ...createPosts(10), ...createNestedPage() };

  for (let run = 0; run < RUNS; run += 1) {
    // eslint-disable-next-line no-await-in-loop
    const { context, page } = await openSession({
      browser,
      baseURL: /** @type {string} */ (baseURL),
      backend: 'test-repo',
      files,
    });

    // eslint-disable-next-line no-await-in-loop
    await openCollection(page, 'Pages');

    const editor = getEditor(page);
    const pane = editor.getByRole('group', { name: 'Edit Content' });
    // The items of a Features section have a Title field too; the page’s own comes first
    const title = editor.getByRole('textbox', { name: 'Title', exact: true }).first();
    // eslint-disable-next-line no-await-in-loop
    const start = await now(page);

    // eslint-disable-next-line no-await-in-loop
    await page.getByRole('row', { name: new RegExp(`^${NESTED_PAGE_TITLE}`) }).click();
    // eslint-disable-next-line no-await-in-loop
    await expect(title).toHaveValue(NESTED_PAGE_TITLE);
    // eslint-disable-next-line no-await-in-loop
    results.add('open entry', (await now(page)) - start);

    // A field at the top level, which a Compute field depends on
    // eslint-disable-next-line no-await-in-loop
    await measureTyping({ page, textbox: title, results, name: 'top-level field' });

    // A field four levels down: section → item → details → note. The fields are only rendered once
    // scrolled into view, so scroll down to the first one
    const note = editor.getByRole('textbox', { name: 'Note', exact: true }).first();

    // eslint-disable-next-line no-await-in-loop
    await scrollUntilRendered(page, pane, note);
    // eslint-disable-next-line no-await-in-loop
    await measureTyping({ page, textbox: note, results, name: 'nested field' });

    // The fields are only rendered once scrolled into view. Scroll through the whole entry, so
    // every section is rendered, and type in the top-level field again
    // eslint-disable-next-line no-await-in-loop
    await renderAllFields(page, pane);
    // eslint-disable-next-line no-await-in-loop
    await measureTyping({ page, textbox: title, results, name: 'all rendered, top-level field' });

    // eslint-disable-next-line no-await-in-loop
    await context.close();
  }

  await results.save();
});
