import {
  COLLECTION_OPTIONS_CONFIG,
  COLLECTION_OPTIONS_FILES,
} from '../../fixtures/configs/collection-options.js';
import { expect, test } from '../../fixtures/test.js';

import { getEntryList, openCollection } from './helpers.js';

/**
 * @import { CMS } from '../../fixtures/test.js';
 */

test.use({ config: COLLECTION_OPTIONS_CONFIG });

const WATERING = 'content/faqs/when-can-i-water.md';
const JOINING = 'content/faqs/who-can-join.md';
const TOOLS = 'content/faqs/are-tools-provided.md';

test.beforeEach(async ({ cms, page }) => {
  await cms.open();
  await cms.seed(COLLECTION_OPTIONS_FILES);
  await cms.signIn();
  await openCollection(page, 'FAQs');
});

/**
 * Read the FAQ files in the repository.
 * @param {CMS} cms CMS.
 * @returns {Promise<Record<string, string>>} File content keyed by path.
 */
const readFAQs = async (cms) =>
  Object.fromEntries(
    Object.entries(await cms.readRepo()).filter(([path]) => path.startsWith('content/faqs/')),
  );

/**
 * Get a seeded FAQ file with another order.
 * @param {string} path File path.
 * @param {number} order New order.
 * @returns {string} File content.
 */
const withOrder = (path, order) =>
  COLLECTION_OPTIONS_FILES[path].replace(/^order: \d+$/m, `order: ${order}`);

test('lists the entries in their manual order', async ({ page }) => {
  await expect(getEntryList(page)).toMatchAriaSnapshot(`
    - rowgroup:
      - row /When can I water\\?/
      - row /Who can join\\?/
      - row /Are tools provided\\?/
  `);
});

test('moves an entry up, and saves the new order of the entries that moved', async ({
  cms,
  page,
}) => {
  await page.getByRole('button', { name: 'Reorder Entries' }).click();

  const done = page.getByRole('button', { name: 'Done Reordering Entries' });
  const tools = page.getByRole('row', { name: /Are tools provided/ });

  // The ends of the list can’t move any further, and there’s nothing to save until something moves
  await expect(
    page.getByRole('row', { name: /When can I water/ }).getByRole('button', { name: 'Move Up' }),
  ).toBeDisabled();
  await expect(tools.getByRole('button', { name: 'Move Down' })).toBeDisabled();
  await expect(done).toBeDisabled();

  await tools.getByRole('button', { name: 'Move Up' }).click();
  await done.click();

  await expect(page.getByRole('button', { name: 'Reorder Entries' })).toBeVisible();
  // The first entry keeps its number, so its file is left alone
  await expect
    .poll(() => readFAQs(cms))
    .toEqual({
      [WATERING]: COLLECTION_OPTIONS_FILES[WATERING],
      [TOOLS]: withOrder(TOOLS, 2),
      [JOINING]: withOrder(JOINING, 3),
    });
  await expect(getEntryList(page)).toMatchAriaSnapshot(`
    - rowgroup:
      - row /When can I water\\?/
      - row /Are tools provided\\?/
      - row /Who can join\\?/
  `);
});

test('cancels reordering, leaving the order and the files as they were', async ({ cms, page }) => {
  await page.getByRole('button', { name: 'Reorder Entries' }).click();
  await page
    .getByRole('row', { name: /When can I water/ })
    .getByRole('button', { name: 'Move Down' })
    .click();
  await expect(getEntryList(page)).toMatchAriaSnapshot(`
    - rowgroup:
      - row /Who can join\\?/
      - row /When can I water\\?/
      - row /Are tools provided\\?/
  `);
  await page.getByRole('button', { name: 'Cancel Reordering Entries' }).click();

  await expect(getEntryList(page)).toMatchAriaSnapshot(`
    - rowgroup:
      - row /When can I water\\?/
      - row /Who can join\\?/
      - row /Are tools provided\\?/
  `);
  expect(await readFAQs(cms)).toEqual({
    [WATERING]: COLLECTION_OPTIONS_FILES[WATERING],
    [JOINING]: COLLECTION_OPTIONS_FILES[JOINING],
    [TOOLS]: COLLECTION_OPTIONS_FILES[TOOLS],
  });
});

test('puts a new entry at the end', async ({ cms, page }) => {
  await page.getByRole('button', { name: 'Create New Entry' }).click();

  const editor = page.getByRole('group', { name: 'Content Editor' });

  await editor.getByRole('textbox', { name: 'Question' }).fill('Is there parking?');
  await editor.getByRole('textbox', { name: 'Answer' }).fill('On the street.');
  await editor.getByRole('button', { name: 'Save' }).click();

  await expect
    .poll(async () => (await cms.readRepo())['content/faqs/is-there-parking.md'])
    .toBe('---\norder: 4\nquestion: Is there parking?\nanswer: On the street.\n---\n');
  await expect(getEntryList(page).getByRole('row').last()).toHaveAccessibleName(
    /Is there parking\?/,
  );
});

test('renumbers the other entries when one is deleted', async ({ cms, page }) => {
  await page.getByRole('row', { name: /When can I water/ }).click();
  await cms.chooseMenuItem(
    page.getByRole('button', { name: 'Show Editor Options' }),
    page.getByRole('menuitem', { name: 'Delete Entry' }),
  );
  await page
    .getByRole('alertdialog', { name: 'Delete Entry' })
    .getByRole('button', { name: 'Delete' })
    .click();

  await expect
    .poll(() => readFAQs(cms))
    .toEqual({ [JOINING]: withOrder(JOINING, 1), [TOOLS]: withOrder(TOOLS, 2) });
});
