import { MONOLINGUAL_CONFIG, MONOLINGUAL_FILES } from '../../fixtures/configs/monolingual.js';
import { expect, test } from '../../fixtures/test.js';

/**
 * @import { Locator, Page } from '@playwright/test';
 */

test.use({ config: MONOLINGUAL_CONFIG });

test.beforeEach(async ({ cms, page }) => {
  // The `{{year}}` and `{{month}}` slug tags come from the time of saving
  await page.clock.install({ time: new Date('2026-05-10T12:00:00Z') });
  await cms.open();
  await cms.seed(MONOLINGUAL_FILES);
  await cms.signIn();
});

/**
 * Open the First Light post and wait for its fields.
 * @param {Page} page Page.
 * @returns {Promise<Locator>} Editor.
 */
const openFirstLight = async (page) => {
  const editor = page.getByRole('group', { name: 'Content Editor' });

  await page.getByRole('row', { name: /First Light/ }).click();
  await expect(editor.getByRole('textbox', { name: 'Title' })).toHaveValue('First Light');

  return editor;
};

test('duplicates an entry', async ({ cms, page }) => {
  const editor = await openFirstLight(page);

  await cms.chooseMenuItem(
    page.getByRole('button', { name: 'Show Editor Options' }),
    page.getByRole('menuitem', { name: 'Duplicate Entry' }),
  );

  await expect(page.getByRole('status').filter({ hasText: 'Entry duplicated' })).toBeVisible();
  await expect(editor.getByRole('textbox', { name: 'Title' })).toHaveValue('First Light');
  await editor.getByRole('textbox', { name: 'Title' }).fill('Second Light');
  await editor.getByRole('button', { name: 'Save' }).click();

  await expect
    .poll(async () => (await cms.readRepo())['content/posts/2026-05-second-light.md'])
    .toBe(
      MONOLINGUAL_FILES['content/posts/2026-01-first-light.md']
        .replace('First Light', 'Second Light')
        .replace('author: jane-doe\n', "author: jane-doe\nrating: null\ncover: ''\nexcerpt: ''\n"),
    );
  // The original is left alone
  expect((await cms.readRepo())['content/posts/2026-01-first-light.md']).toBe(
    MONOLINGUAL_FILES['content/posts/2026-01-first-light.md'],
  );
});

test('renames an entry with Edit Slug', async ({ cms, page }) => {
  const editor = await openFirstLight(page);

  await cms.chooseMenuItem(
    page.getByRole('button', { name: 'Show Editor Options' }),
    page.getByRole('menuitem', { name: 'Edit Slug' }),
  );

  // The menu item opens the Slug panel in the sidebar
  const sidebarPanels = page.getByRole('radiogroup', { name: 'Sidebar Panels' });

  await expect(sidebarPanels.getByRole('radio', { name: 'Slug' })).toBeChecked();

  const panel = page.getByRole('group', { name: 'Slug', exact: true });

  await panel.getByRole('button', { name: 'Edit Slug' }).click();

  const input = panel.getByRole('textbox', { name: 'Slug' });

  await expect(input).toHaveValue('2026-01-first-light');
  await expect(input).toBeFocused();
  // A slug taken by another entry is refused
  await input.fill('2026-02-a-quiet-review');
  await expect(panel.getByRole('button', { name: 'Done' })).toBeDisabled();
  await input.fill('2026-01-opening-night');
  await input.press('Enter');
  await expect(panel.getByText('2026-01-opening-night')).toBeVisible();
  await editor.getByRole('button', { name: 'Save' }).click();

  await expect
    .poll(async () => Object.keys(await cms.readRepo()))
    .toContain('content/posts/2026-01-opening-night.md');

  const files = await cms.readRepo();

  expect(files['content/posts/2026-01-opening-night.md']).toBe(
    MONOLINGUAL_FILES['content/posts/2026-01-first-light.md'].replace(
      'author: jane-doe\n',
      "author: jane-doe\nrating: null\ncover: ''\nexcerpt: ''\n",
    ),
  );
  expect(files).not.toHaveProperty('content/posts/2026-01-first-light.md');
});

test('reverts all changes', async ({ cms, page }) => {
  const editor = await openFirstLight(page);
  const title = editor.getByRole('textbox', { name: 'Title' });
  const tags = editor.getByRole('textbox', { name: 'Item Value' });
  const save = editor.getByRole('button', { name: 'Save' });
  const menuButton = page.getByRole('button', { name: 'Show Editor Options' });
  const revert = page.getByRole('menuitem', { name: 'Revert All Changes' });

  // Nothing to revert yet
  await menuButton.click();
  await expect(revert).toBeDisabled();
  await page.keyboard.press('Escape');

  await title.fill('Last Light');
  await editor.getByRole('switch', { name: 'Draft' }).click();
  await editor.getByRole('button', { name: 'Remove' }).first().click();
  await expect(tags).toHaveCount(1);
  await expect(save).toBeEnabled();

  await cms.chooseMenuItem(menuButton, revert);

  // Nothing is reverted until confirmed
  const dialog = page.getByRole('alertdialog');

  await expect(dialog).toContainText('revert all the changes made to this entry?');
  await expect(title).toHaveValue('Last Light');
  await dialog.getByRole('button', { name: 'Revert All Changes' }).click();

  await expect(title).toHaveValue('First Light');
  await expect(editor.getByRole('switch', { name: 'Draft' })).not.toBeChecked();
  await expect(tags).toHaveCount(2);
  await expect(tags.first()).toHaveValue('astronomy');
  await expect(save).toBeDisabled();
});

test.describe('panes', () => {
  test('hides and shows the second pane and the preview', async ({ cms, page }) => {
    const editor = await openFirstLight(page);
    const menuButton = page.getByRole('button', { name: 'Show Editor Options' });
    const previewPane = editor.getByRole('group', { name: 'Preview Content' });
    const swapButton = editor.getByRole('button', { name: 'Swap Panes' });
    const showSecondPane = page.getByRole('menuitemcheckbox', { name: 'Show Second Pane' });
    const showPreview = page.getByRole('menuitemcheckbox', { name: 'Show Preview' });
    const syncScrolling = page.getByRole('menuitemcheckbox', { name: 'Sync Scrolling' });

    await expect(previewPane.getByRole('document', { name: 'Content Preview' })).toContainText(
      'The observatory opens its doors.',
    );
    await expect(swapButton).toBeVisible();

    await cms.chooseMenuItem(menuButton, showSecondPane);
    await expect(previewPane).toBeHidden();
    await expect(swapButton).toBeHidden();
    await expect(editor.getByRole('group', { name: 'Edit Content' })).toBeVisible();
    // The preview is shown in the second pane, so its options are unavailable meanwhile
    await menuButton.click();
    await expect(showSecondPane).not.toBeChecked();
    await expect(showPreview).toBeDisabled();
    await expect(syncScrolling).toBeDisabled();
    await page.keyboard.press('Escape');

    await cms.chooseMenuItem(menuButton, showSecondPane);
    await expect(previewPane).toBeVisible();

    await cms.chooseMenuItem(menuButton, showPreview);
    await expect(previewPane).toBeHidden();
    await menuButton.click();
    await expect(showPreview).not.toBeChecked();
    // The preview is all the second pane shows for a single locale, so there’s nothing to sync
    await expect(syncScrolling).toBeDisabled();
    await page.keyboard.press('Escape');

    await cms.chooseMenuItem(menuButton, showPreview);
    await expect(previewPane).toBeVisible();
  });

  test('remembers the hidden preview for the next entry', async ({ cms, page }) => {
    const editor = await openFirstLight(page);
    const previewPane = editor.getByRole('group', { name: 'Preview Content' });

    await cms.chooseMenuItem(
      page.getByRole('button', { name: 'Show Editor Options' }),
      page.getByRole('menuitemcheckbox', { name: 'Show Preview' }),
    );
    await expect(previewPane).toBeHidden();
    await editor.getByRole('button', { name: 'Cancel Editing' }).click();
    await page.getByRole('row', { name: /A Quiet Review/ }).click();
    await expect(editor.getByRole('textbox', { name: 'Title' })).toHaveValue('A Quiet Review');
    await expect(previewPane).toBeHidden();
  });

  test('swaps the panes', async ({ page }) => {
    const editor = await openFirstLight(page);
    const editPane = editor.getByRole('group', { name: 'Edit Content' });
    const previewPane = editor.getByRole('group', { name: 'Preview Content' });
    /**
     * Get the horizontal position of a pane.
     * @param {Locator} pane Pane.
     * @returns {Promise<number>} Left edge.
     */
    const getLeft = async (pane) => (await pane.boundingBox())?.x ?? NaN;

    expect(await getLeft(editPane)).toBeLessThan(await getLeft(previewPane));
    await editor.getByRole('button', { name: 'Swap Panes' }).click();
    await expect
      .poll(async () => (await getLeft(previewPane)) < (await getLeft(editPane)))
      .toBe(true);
    // The fields can still be edited, and the preview follows them
    await editor.getByRole('textbox', { name: 'Title' }).fill('Last Light');
    await expect(previewPane.getByText('Last Light')).toBeVisible();
  });
});

test.describe('sync scrolling', () => {
  // A post long enough to scroll, with every paragraph numbered so the panes can be compared
  const LONG_POST = [
    '---',
    'title: Long Night',
    'date: 2026-04-01',
    'draft: false',
    'category: news',
    'author: jane-doe',
    '---',
    '',
    ...Array.from({ length: 80 }, (_, index) => `Paragraph ${index + 1}.\n`),
  ].join('\n');

  /**
   * Open the long post, and get the scrolling areas of its panes.
   * @param {Page} page Page.
   * @returns {Promise<{ editArea: Locator, previewArea: Locator }>} Scrolling areas.
   */
  const openLongNight = async (page) => {
    await page.getByRole('row', { name: /Long Night/ }).click();

    const editor = page.getByRole('group', { name: 'Content Editor' });

    await expect(editor.getByRole('textbox', { name: 'Body' })).toContainText('Paragraph 80.');

    // The panes scroll their content area, which has no role
    return {
      editArea: editor.getByRole('group', { name: 'Edit Content' }).locator('.content'),
      previewArea: editor.getByRole('group', { name: 'Preview Content' }).locator('.content'),
    };
  };

  /**
   * Scroll the edit pane down with the mouse wheel, which is what the preview follows.
   * @param {Page} page Page.
   * @param {Locator} editArea Scrolling area of the edit pane.
   */
  const scrollEditPane = async (page, editArea) => {
    await editArea.hover();
    await page.mouse.wheel(0, 2000);
    await expect.poll(() => editArea.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  };

  test.beforeEach(async ({ cms }) => {
    await cms.seed({ 'content/posts/2026-04-long-night.md': LONG_POST });
    // Reload the page so the backend lists the new file
    await cms.open();
  });

  test('scrolls the preview along with the editor', async ({ page }) => {
    const { editArea, previewArea } = await openLongNight(page);

    // A single turn of the wheel is enough: the preview used to follow the position before the
    // scroll, as the wheel event comes first
    await scrollEditPane(page, editArea);
    await expect
      .poll(() => previewArea.evaluate((element) => element.scrollTop))
      .toBeGreaterThan(0);

    // And back to the top
    await page.mouse.wheel(0, -5000);
    await expect.poll(() => editArea.evaluate((element) => element.scrollTop)).toBe(0);
    await expect.poll(() => previewArea.evaluate((element) => element.scrollTop)).toBe(0);
  });

  test('leaves the preview alone once turned off', async ({ cms, page }) => {
    const { editArea, previewArea } = await openLongNight(page);

    await cms.chooseMenuItem(
      page.getByRole('button', { name: 'Show Editor Options' }),
      page.getByRole('menuitemcheckbox', { name: 'Sync Scrolling' }),
    );
    await scrollEditPane(page, editArea);
    // Proving that something doesn’t happen takes a wait, longer than the preview takes to follow
    await page.waitForTimeout(500);
    expect(await previewArea.evaluate((element) => element.scrollTop)).toBe(0);
  });
});

/**
 * Seeded entries of every kind, with the collection they’re in and a field value to wait for.
 */
const UNCHANGED_ENTRIES = {
  'a post with tags': { collection: 'Posts', row: /First Light/, field: 'Title' },
  'an author with links': { collection: 'Authors', row: /Jane Doe/, field: 'Name' },
  'a YAML file with an object': { collection: 'Pages', row: /Contact Page/, field: 'Email' },
  'a singleton': { collection: 'Site Settings', row: undefined, field: 'Site Name' },
};

Object.entries(UNCHANGED_ENTRIES).forEach(([name, { collection, row, field }]) => {
  test(`doesn’t count opening ${name} as a change`, async ({ page }) => {
    await page.getByRole('treeitem', { name: collection }).click();

    if (row) {
      await page.getByRole('row', { name: row }).click();
    }

    const editor = page.getByRole('group', { name: 'Content Editor' });

    await expect(editor.getByRole('textbox', { name: field }).first()).not.toHaveValue('');
    // A post’s tags used to count as a change, as the list editor rewrote them when it was shown.
    // There’s nothing to wait for when nothing changes, so wait longer than a change would take
    await page.waitForTimeout(1000);
    await expect(editor.getByRole('button', { name: 'Save' })).toBeDisabled();
  });
});
