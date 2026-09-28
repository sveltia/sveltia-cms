import {
  COLLECTION_OPTIONS_CONFIG,
  COLLECTION_OPTIONS_FILES,
} from '../../fixtures/configs/collection-options.js';
import { expect, test } from '../../fixtures/test.js';

import { getEntryList, openCollection } from './helpers.js';

test.use({ config: COLLECTION_OPTIONS_CONFIG });

test.beforeEach(async ({ cms }) => {
  await cms.open();
  await cms.seed(COLLECTION_OPTIONS_FILES);
  await cms.signIn();
});

test('lists only the entries matching each collection’s filter', async ({ page }) => {
  const tree = page.getByRole('tree', { name: 'Collection List' });

  // The count next to each collection only includes its own entries, too
  await expect(
    tree.getByRole('treeitem', { name: /^Events/ }).getByLabel(/\(\W*2\W* entries\)/),
  ).toHaveText('2');
  await expect(
    tree.getByRole('treeitem', { name: /^Workshops/ }).getByLabel(/\(\W*1\W* entry\)/),
  ).toHaveText('1');

  await openCollection(page, 'Events');
  await expect(getEntryList(page)).toMatchAriaSnapshot(`
    - rowgroup:
      - row /Harvest Fair/
      - row /Seed Swap/
  `);
  await openCollection(page, 'Workshops');
  await expect(getEntryList(page)).toMatchAriaSnapshot(`
    - rowgroup:
      - row /Composting 101/
  `);
});

test('saves a new entry with the value of the filter field, listing it there only', async ({
  cms,
  page,
}) => {
  await openCollection(page, 'Workshops');
  await page.getByRole('button', { name: 'Create New Entry' }).click();

  const editor = page.getByRole('group', { name: 'Content Editor' });

  await editor.getByRole('textbox', { name: 'Title' }).fill('Pruning Basics');
  await editor.getByRole('button', { name: 'Save' }).click();

  // The hidden field’s default puts the entry in the collection’s folder with the filter value
  await expect
    .poll(async () => (await cms.readRepo())['content/activities/pruning-basics.md'])
    .toBe('---\ntype: workshop\ntitle: Pruning Basics\n---\n');
  await expect(page.getByRole('row', { name: /Pruning Basics/ })).toBeVisible();

  await openCollection(page, 'Events');
  await expect(page.getByRole('row', { name: /Harvest Fair/ })).toBeVisible();
  await expect(page.getByRole('row', { name: /Pruning Basics/ })).toHaveCount(0);
});

test('leaves a field out of the preview with `preview: false`', async ({ page }) => {
  await openCollection(page, 'Events');
  await page.getByRole('row', { name: /Seed Swap/ }).click();

  const editor = page.getByRole('group', { name: 'Content Editor' });
  const preview = editor.getByRole('document', { name: 'Content Preview' });

  // The field is still edited as usual
  await expect(editor.getByRole('textbox', { name: 'Organizer Notes' })).toHaveValue(
    'Bring extra envelopes.',
  );
  await expect(preview).toContainText('Tool Shed');
  await expect(preview.getByRole('heading', { name: 'Place' })).toBeVisible();
  await expect(preview.getByRole('heading', { name: 'Organizer Notes' })).toHaveCount(0);
  await expect(preview).not.toContainText('Bring extra envelopes.');
});
