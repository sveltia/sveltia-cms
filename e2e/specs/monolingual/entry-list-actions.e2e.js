import { MONOLINGUAL_CONFIG, MONOLINGUAL_FILES } from '../../fixtures/configs/monolingual.js';
import { createPNG } from '../../fixtures/files.js';
import { expect, GITHUB_CONFIG, test } from '../../fixtures/test.js';

/**
 * @import { Locator, Page } from '@playwright/test';
 */

test.use({ config: MONOLINGUAL_CONFIG });

/**
 * Get the rows of the entry list.
 * @param {Page} page Page.
 * @returns {Locator} Rows.
 */
const getRows = (page) => page.getByRole('grid', { name: 'Entries' }).getByRole('row');

/**
 * Get the button that deletes the selected entries, whose name changes with the selection count.
 * @param {Page} page Page.
 * @returns {Locator} Button.
 */
const getDeleteButton = (page) =>
  page.getByRole('button', { name: /^Delete Selected Entr(y|ies)$/ });

/**
 * Read the entry list view settings the CMS has stored for the GitHub repository.
 * @param {Page} page Page.
 * @returns {Promise<Record<string, any> | undefined>} Settings keyed by collection name.
 */
const readViewSettings = (page) =>
  page.evaluate(async () => {
    /** @type {IDBDatabase} */
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('github:sveltia/e2e-site');

      request.addEventListener('success', () => resolve(request.result));
      request.addEventListener('error', () => reject(request.error));
      request.addEventListener('blocked', () => reject(new Error('The database is blocked')));
    });

    try {
      if (!db.objectStoreNames.contains('ui-settings')) {
        return undefined;
      }

      return await new Promise((resolve) => {
        const request = db
          .transaction('ui-settings')
          .objectStore('ui-settings')
          .get('contents-view');

        request.addEventListener('success', () => resolve(request.result));
      });
    } finally {
      db.close();
    }
  });

test.describe('with the magazine’s files', () => {
  test.beforeEach(async ({ cms }) => {
    await cms.open();
    await cms.seed(MONOLINGUAL_FILES);
    await cms.signIn();
  });

  test('selects entries one by one and deletes them at once', async ({ cms, page }) => {
    const rows = getRows(page);
    const selectAll = page.getByRole('checkbox', { name: 'Select All' });

    await expect(rows).toHaveCount(3);
    await expect(getDeleteButton(page)).toBeDisabled();

    await page.getByRole('checkbox', { name: /Select.*A Quiet Review/ }).check();
    await expect(page.getByText('1 of 3 selected')).toBeVisible();
    await expect(selectAll).toHaveAttribute('aria-checked', 'mixed');

    await page.getByRole('checkbox', { name: /Select.*Talking to Jane/ }).check();
    await expect(page.getByText('2 of 3 selected')).toBeVisible();

    await getDeleteButton(page).click();

    const dialog = page.getByRole('alertdialog', { name: 'Delete Entries' });

    await expect(dialog).toContainText('Are you sure you want to delete the selected 2 entries?');
    await dialog.getByRole('button', { name: 'Delete' }).click();

    await expect(rows).toHaveText([/First Light/]);
    await expect
      .poll(async () => Object.keys(await cms.readRepo()).filter((path) => path.includes('posts/')))
      .toEqual(['content/posts/2026-01-first-light.md']);
    // The selection is cleared along with the entries
    await expect(page.getByText(/selected$/)).toBeHidden();
    await expect(selectAll).not.toBeChecked();
    await expect(getDeleteButton(page)).toBeDisabled();
  });

  test('selects and clears all the entries with the Select All checkbox', async ({ page }) => {
    const selectAll = page.getByRole('checkbox', { name: 'Select All' });
    const checkboxes = page.getByRole('grid', { name: 'Entries' }).getByRole('checkbox');

    await expect(checkboxes).toHaveCount(3);
    await selectAll.check();
    await expect(page.getByText('3 of 3 selected')).toBeVisible();

    await expect(checkboxes.and(page.getByRole('checkbox', { checked: true }))).toHaveCount(3);

    await expect(getDeleteButton(page)).toBeEnabled();

    await selectAll.uncheck();
    await expect(page.getByText(/selected$/)).toBeHidden();

    await expect(checkboxes.and(page.getByRole('checkbox', { checked: false }))).toHaveCount(3);

    await expect(getDeleteButton(page)).toBeDisabled();
  });

  test('deletes all the entries and shows the empty collection', async ({ cms, page }) => {
    await page.getByRole('checkbox', { name: 'Select All' }).check();
    await getDeleteButton(page).click();

    const dialog = page.getByRole('alertdialog', { name: 'Delete Entries' });

    await expect(dialog).toContainText('Are you sure you want to delete all the entries?');
    await dialog.getByRole('button', { name: 'Delete' }).click();

    await expect(page.getByText('This collection has no entries yet.')).toBeVisible();
    // The empty list offers a Create button of its own
    await expect(
      page
        .getByRole('group', { name: 'Entry List' })
        .getByRole('button', { name: 'Create New Entry' }),
    ).toBeVisible();
    await expect
      .poll(async () => Object.keys(await cms.readRepo()).filter((path) => path.includes('posts/')))
      .toEqual([]);
  });

  test('cancels deleting the selected entries', async ({ cms, page }) => {
    await page.getByRole('checkbox', { name: /Select.*First Light/ }).check();
    await getDeleteButton(page).click();

    const dialog = page.getByRole('alertdialog', { name: 'Delete Entry' });

    await expect(dialog).toContainText('Are you sure you want to delete the selected entry?');
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toBeHidden();

    await expect(getRows(page)).toHaveCount(3);
    // The selection is kept, so the user can change it and try again
    await expect(page.getByText('1 of 3 selected')).toBeVisible();
    expect(Object.keys(await cms.readRepo())).toContain('content/posts/2026-01-first-light.md');
  });

  test('refuses to delete an author a required relation field refers to', async ({ cms, page }) => {
    await page.getByRole('treeitem', { name: 'Authors' }).click();
    await page.getByRole('checkbox', { name: /Select.*Jane Doe/ }).check();
    await getDeleteButton(page).click();

    const dialog = page.getByRole('alertdialog', { name: 'Delete Entry' });

    await expect(dialog.getByRole('alert')).toHaveText(
      'This entry can’t be deleted, because the following fields in other entries would no ' +
        'longer be valid without it. Update those entries first.',
    );
    // Each field is listed with the error it would have
    await expect(dialog.getByRole('listitem')).toHaveText([
      /Posts › Talking to Jane.*Author: This field is required\./,
      /Posts › First Light.*Author: This field is required\./,
    ]);
    await expect(dialog.getByRole('button', { name: 'Delete' })).toBeDisabled();
    await dialog.getByRole('button', { name: 'Cancel' }).click();

    expect(Object.keys(await cms.readRepo())).toContain('content/authors/jane-doe.json');
  });

  test('switches the list to a grid for the collection only', async ({ page }) => {
    const listView = page.getByRole('radio', { name: 'List View' });
    const gridView = page.getByRole('radio', { name: 'Grid View' });

    await expect(listView).toBeChecked();
    await gridView.click();
    await expect(gridView).toBeChecked();
    await expect(getRows(page)).toHaveCount(3);

    // The authors have no image field to show as a thumbnail, hence no grid view, and the posts
    // keep theirs on the way back
    await page.getByRole('treeitem', { name: 'Authors' }).click();
    await expect(getRows(page)).toHaveText([/Jane Doe/, /John Smith/]);
    await expect(gridView).toBeHidden();
    await page.getByRole('treeitem', { name: 'Posts' }).click();
    await expect(gridView).toBeChecked();

    await listView.click();
    await expect(listView).toBeChecked();
  });

  test('keeps the sort order of each collection', async ({ cms, page }) => {
    const sortButton = page.getByRole('button', { name: 'Sort', exact: true });

    await cms.chooseMenuItem(
      sortButton,
      page.getByRole('menuitemradio', { name: /Date.*new to old/ }),
    );
    await expect(getRows(page)).toHaveText([/Talking to Jane/, /A Quiet Review/, /First Light/]);

    await page.getByRole('treeitem', { name: 'Authors' }).click();
    await expect(getRows(page)).toHaveText([/Jane Doe/, /John Smith/]);
    await cms.chooseMenuItem(sortButton, page.getByRole('menuitemradio', { name: /Z to A/ }));
    await expect(getRows(page)).toHaveText([/John Smith/, /Jane Doe/]);

    await page.getByRole('treeitem', { name: 'Posts' }).click();
    await expect(getRows(page)).toHaveText([/Talking to Jane/, /A Quiet Review/, /First Light/]);

    // Choosing the other direction of the same field reverses the list
    await cms.chooseMenuItem(
      sortButton,
      page.getByRole('menuitemradio', { name: /Date.*old to new/ }),
    );
    await expect(getRows(page)).toHaveText([/First Light/, /A Quiet Review/, /Talking to Jane/]);

    await page.getByRole('treeitem', { name: 'Authors' }).click();
    await expect(getRows(page)).toHaveText([/John Smith/, /Jane Doe/]);
  });

  test('clears a view filter and a view group', async ({ cms, page }) => {
    const rows = getRows(page);
    const filterButton = page.getByRole('button', { name: 'Filter', exact: true });
    const groupButton = page.getByRole('button', { name: 'Group', exact: true });
    const grid = page.getByRole('grid', { name: 'Entries' });

    await cms.chooseMenuItem(filterButton, page.getByRole('menuitemcheckbox', { name: 'Drafts' }));
    await expect(rows).toHaveText([/A Quiet Review/]);
    await cms.chooseMenuItem(filterButton, page.getByRole('menuitemcheckbox', { name: 'Drafts' }));
    await expect(rows).toHaveText([/A Quiet Review/, /First Light/, /Talking to Jane/]);

    await cms.chooseMenuItem(groupButton, page.getByRole('menuitemradio', { name: 'Category' }));
    await expect(grid.getByRole('rowgroup', { name: /^news$/i })).toBeVisible();
    await cms.chooseMenuItem(groupButton, page.getByRole('menuitemradio', { name: 'None' }));
    await expect(grid.getByRole('rowgroup', { name: /^news$/i })).toBeHidden();
    await expect(rows).toHaveText([/A Quiet Review/, /First Light/, /Talking to Jane/]);
  });

  test('collapses and expands all the groups', async ({ cms, page }) => {
    const groupButton = page.getByRole('button', { name: 'Group', exact: true });
    const grid = page.getByRole('grid', { name: 'Entries' });

    await cms.chooseMenuItem(groupButton, page.getByRole('menuitemradio', { name: 'Category' }));
    await expect(grid.getByRole('rowgroup')).toHaveCount(3);
    await expect(grid.getByRole('row', { name: /First Light/ })).toBeVisible();

    await cms.chooseMenuItem(groupButton, page.getByRole('menuitem', { name: 'Collapse All' }));
    await expect(grid.getByRole('row', { name: /First Light/ })).toBeHidden();
    await expect(grid.getByRole('row', { name: /Talking to Jane/ })).toBeHidden();

    // The group captions stay, so a group can be expanded again
    await expect(grid.getByRole('rowgroup')).toHaveCount(3);

    await cms.chooseMenuItem(groupButton, page.getByRole('menuitem', { name: 'Expand All' }));
    await expect(grid.getByRole('row', { name: /First Light/ })).toBeVisible();
    await expect(grid.getByRole('row', { name: /Talking to Jane/ })).toBeVisible();
  });
});

// The view settings are stored per repository, which the `test-repo` backend doesn’t have, so
// remembering them across a reload needs a Git backend
test.describe('on GitHub', () => {
  test.use({ config: { ...MONOLINGUAL_CONFIG, backend: GITHUB_CONFIG.backend } });

  test.beforeEach(async ({ github }) => {
    github.commit(MONOLINGUAL_FILES);
  });

  test('remembers the view of each collection after a reload', async ({ cms, page }) => {
    const grid = page.getByRole('grid', { name: 'Entries' });
    const gridView = page.getByRole('radio', { name: 'Grid View' });
    const groupButton = page.getByRole('button', { name: 'Group', exact: true });

    await cms.open();
    await expect(getRows(page)).toHaveCount(3);

    await gridView.click();
    await expect(gridView).toBeChecked();
    await cms.chooseMenuItem(
      page.getByRole('button', { name: 'Sort', exact: true }),
      page.getByRole('menuitemradio', { name: /Date.*new to old/ }),
    );
    await cms.chooseMenuItem(groupButton, page.getByRole('menuitemradio', { name: 'Category' }));
    await expect(grid.getByRole('rowgroup')).toHaveCount(3);
    await grid
      .getByRole('rowgroup', { name: /^news$/i })
      .getByRole('button')
      .click();
    await expect(grid.getByRole('row', { name: /First Light/ })).toBeHidden();

    await page.getByRole('treeitem', { name: 'Authors' }).click();
    await cms.chooseMenuItem(
      page.getByRole('button', { name: 'Sort', exact: true }),
      page.getByRole('menuitemradio', { name: /Z to A/ }),
    );
    await expect(getRows(page)).toHaveText([/John Smith/, /Jane Doe/]);

    // The view settings are written to IndexedDB in the background, and a reload a moment after
    // a change would cancel the write, which a user can’t do as fast
    await expect
      .poll(async () => (await readViewSettings(page))?.authors?.sort)
      .toEqual({ key: 'name', order: 'descending' });
    await page.reload();
    await expect(getRows(page)).toHaveText([/John Smith/, /Jane Doe/]);

    await page.getByRole('treeitem', { name: 'Posts' }).click();
    await expect(gridView).toBeChecked();
    await expect(grid.getByRole('rowgroup')).toHaveCount(3);
    // The collapsed group stays collapsed
    await expect(
      grid.getByRole('rowgroup', { name: /^news$/i }).getByRole('button'),
    ).toHaveAttribute('aria-expanded', 'false');
    await expect(grid.getByRole('row', { name: /First Light/ })).toBeHidden();
    await expect(grid.getByRole('row', { name: /Talking to Jane/ })).toBeVisible();
  });
});

test.describe('with a cover image', () => {
  test.beforeEach(async ({ cms }) => {
    await cms.open();
    await cms.seed({
      ...MONOLINGUAL_FILES,
      'content/posts/2026-01-first-light.md': MONOLINGUAL_FILES[
        'content/posts/2026-01-first-light.md'
      ].replace('author: jane-doe\n', 'author: jane-doe\ncover: /uploads/first-light.png\n'),
      'static/uploads/first-light.png': createPNG({ color: [0, 128, 255] }),
    });
    await cms.signIn();
  });

  test('shows the entry’s image as its thumbnail in both views', async ({ page }) => {
    const row = page.getByRole('row', { name: /First Light/ });

    await expect(row.locator('img')).toBeVisible();
    await expect(page.getByRole('row', { name: /A Quiet Review/ }).locator('img')).toHaveCount(0);

    await page.getByRole('radio', { name: 'Grid View' }).click();
    await expect(row.locator('img')).toBeVisible();
    await expect(page.getByRole('row', { name: /Talking to Jane/ }).locator('img')).toHaveCount(0);
  });
});

test.describe('with an optional relation field', () => {
  test.use({
    config: {
      ...MONOLINGUAL_CONFIG,
      collections: MONOLINGUAL_CONFIG.collections.map((collection) =>
        collection.name === 'posts'
          ? {
              ...collection,
              fields: collection.fields?.map((field) =>
                field.name === 'author' ? { ...field, required: false } : field,
              ),
            }
          : collection,
      ),
    },
  });

  test.beforeEach(async ({ cms }) => {
    await cms.open();
    await cms.seed(MONOLINGUAL_FILES);
    await cms.signIn();
  });

  test('removes the references to a deleted author from the posts', async ({ cms, page }) => {
    await page.getByRole('treeitem', { name: 'Authors' }).click();
    await page.getByRole('checkbox', { name: /Select.*Jane Doe/ }).check();
    await getDeleteButton(page).click();

    const dialog = page.getByRole('alertdialog', { name: 'Delete Entry' });

    await expect(dialog).toContainText(
      'The references to it in 2 other entries will be removed as well.',
    );
    await dialog.getByRole('button', { name: 'Delete' }).click();

    await expect(getRows(page)).toHaveText([/John Smith/]);

    await expect
      .poll(async () => Object.keys(await cms.readRepo()))
      .not.toContain('content/authors/jane-doe.json');

    // The field is left empty, the way the editor leaves it when nothing is selected, and the rest
    // of the file is kept as it was
    await expect
      .poll(async () => (await cms.readRepo())['content/posts/2026-01-first-light.md'])
      .toBe(
        MONOLINGUAL_FILES['content/posts/2026-01-first-light.md'].replace(
          'author: jane-doe',
          "author: ''",
        ),
      );

    const files = await cms.readRepo();

    expect(files['content/posts/2026-03-talking-to-jane.md']).toBe(
      MONOLINGUAL_FILES['content/posts/2026-03-talking-to-jane.md'].replace(
        'author: jane-doe',
        "author: ''",
      ),
    );
    expect(files['content/posts/2026-02-a-quiet-review.md']).toBe(
      MONOLINGUAL_FILES['content/posts/2026-02-a-quiet-review.md'],
    );
  });
});
