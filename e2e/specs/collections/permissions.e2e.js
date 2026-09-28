import {
  COLLECTION_OPTIONS_CONFIG,
  COLLECTION_OPTIONS_FILES,
} from '../../fixtures/configs/collection-options.js';
import { expect, test } from '../../fixtures/test.js';

import { openCollection } from './helpers.js';

test.use({ config: COLLECTION_OPTIONS_CONFIG });

test.beforeEach(async ({ cms }) => {
  await cms.open();
  await cms.seed(COLLECTION_OPTIONS_FILES);
  await cms.signIn();
});

test('lists the collections with a divider, leaving out the hidden one', async ({ page }) => {
  await expect(page.getByRole('tree', { name: 'Collection List' })).toMatchAriaSnapshot(`
    - group "Collections":
      - treeitem /Announcements/
      - treeitem /FAQs/
      - separator
      - treeitem /Events/
      - treeitem /Workshops/
      - treeitem /Journal/
  `);
});

test.describe('with creation and deletion turned off', () => {
  test('neither creates nor deletes an announcement from the list', async ({ page }) => {
    const collection = await openCollection(page, 'Announcements');

    await expect(collection.getByRole('button', { name: 'Create New Entry' })).toBeDisabled();
    await expect(collection.getByRole('status')).toHaveText(
      /Creating new entries in this collection is disabled by the administrator\./,
    );

    await collection.getByRole('checkbox', { name: /Select.*Opening Day/ }).check();
    await expect(
      collection.getByRole('button', { name: /^Delete Selected Entr(y|ies)$/ }),
    ).toBeDisabled();
  });

  test('edits an announcement, whose menu offers neither Duplicate nor Delete', async ({
    cms,
    page,
  }) => {
    await openCollection(page, 'Announcements');
    await page.getByRole('row', { name: /Opening Day/ }).click();

    const editor = page.getByRole('group', { name: 'Content Editor' });

    await expect(editor.getByRole('textbox', { name: 'Body' })).toHaveValue(
      'The gates open at nine.',
    );
    await cms.openPopup(
      page.getByRole('button', { name: 'Show Editor Options' }),
      page.getByRole('menuitem', { name: 'Edit Slug' }),
    );
    await expect(page.getByRole('menuitem', { name: 'Duplicate Entry' })).toHaveCount(0);
    await expect(page.getByRole('menuitem', { name: 'Delete Entry' })).toHaveCount(0);
    await page.keyboard.press('Escape');

    // Editing is still allowed
    await editor.getByRole('textbox', { name: 'Body' }).fill('The gates open at ten.');
    await editor.getByRole('button', { name: 'Save' }).click();
    await expect
      .poll(async () => (await cms.readRepo())['content/announcements/opening-day.md'])
      .toBe('---\ntitle: Opening Day\n---\n\nThe gates open at ten.\n');
  });

  test('refuses to open a new announcement from its URL', async ({ page }) => {
    await openCollection(page, 'Announcements');
    await page.evaluate(() => {
      window.location.hash = '#/collections/announcements/new';
    });

    const editor = page.getByRole('group', { name: 'Content Editor' });

    await expect(editor).toContainText(
      'Creating new entries in this collection is disabled by the administrator.',
    );
    await expect(editor.getByRole('textbox', { name: 'Title' })).toHaveCount(0);
    await editor.getByRole('button', { name: 'Back to Collection' }).click();
    await expect(page.getByRole('row', { name: /Opening Day/ })).toBeVisible();
  });
});

test.describe('with a limit on the number of entries', () => {
  test('creates entries up to the limit, then no more', async ({ cms, page }) => {
    const collection = await openCollection(page, 'FAQs');
    const createButton = collection.getByRole('button', { name: 'Create New Entry' });

    await expect(collection.getByRole('status')).toHaveText(
      /This collection is nearing its limit of 4 entries\. You can only create 1 more entry\./,
    );
    await createButton.click();

    const editor = page.getByRole('group', { name: 'Content Editor' });

    await editor.getByRole('textbox', { name: 'Question' }).fill('Is there parking?');
    await editor.getByRole('textbox', { name: 'Answer' }).fill('On the street.');
    await editor.getByRole('button', { name: 'Save' }).click();
    await expect
      .poll(async () => Object.keys(await cms.readRepo()))
      .toContain('content/faqs/is-there-parking.md');
    await expect(collection.getByRole('row')).toHaveCount(4);
    await expect(createButton).toBeDisabled();
    await expect(collection.getByRole('status')).toHaveText(
      /You cannot add new entries to this collection because it has reached its limit of 4 entries\./,
    );
  });
});

test.describe('hidden collection', () => {
  test('can’t be opened from its URL', async ({ page }) => {
    await openCollection(page, 'Announcements');
    await page.evaluate(() => {
      window.location.hash = '#/collections/plots';
    });

    await expect(page).toHaveURL(/#\/collections\/plots$/);
    await expect(
      page.getByRole('main', { name: 'Content Library' }).getByText('Collection not found.'),
    ).toBeVisible();
    await expect(page.getByRole('row', { name: /North Bed/ })).toHaveCount(0);
  });

  test('still lists its entries in a relation field', async ({ cms, page }) => {
    await openCollection(page, 'Journal');
    await page.getByRole('row', { name: /First Sowing/ }).click();

    const editor = page.getByRole('group', { name: 'Content Editor' });
    const plot = editor.getByRole('radiogroup', { name: 'Plot' });

    await expect(plot.getByRole('radio', { name: 'North Bed' })).toBeChecked();
    await plot.getByRole('radio', { name: 'Herb Spiral' }).click();
    await editor.getByRole('button', { name: 'Save' }).click();

    await expect
      .poll(async () => (await cms.readRepo())['content/journal/2026/0301-first-sowing.md'])
      .toContain('plot: herb-spiral\n');
  });
});
