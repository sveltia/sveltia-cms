import { expect, test } from '../../fixtures/test.js';
import { getEditor } from '../../fixtures/ui.js';

/**
 * @import { Page } from '@playwright/test';
 */

const POST_PATH = 'content/posts/first-post.md';
const FIRST_POST = '---\ntitle: First Post\n---\n\nHello, world!\n';

/**
 * Back up an edit of the post, reload the page, and open the post again, which offers to restore
 * the backup.
 * @param {Page} page Page.
 */
const openWithBackup = async (page) => {
  const editor = getEditor(page);
  const title = editor.getByRole('textbox', { name: 'Title' });

  await page.getByRole('row', { name: /First Post/ }).click();
  // A change is only backed up once the user has interacted with the editor
  await title.click();
  await title.fill('Backed-up Post');
  // The draft is backed up 500 ms after the last change
  await page.waitForTimeout(1000);
  await editor.getByRole('button', { name: 'Cancel Editing' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Draft backup saved.' })).toBeVisible();

  await page.goto(page.url().split('#')[0]);
  await page.getByRole('row', { name: /First Post/ }).click();
};

test.beforeEach(async ({ cms }) => {
  await cms.open();
  await cms.seed({ [POST_PATH]: FIRST_POST });
  await cms.signIn();
});

// The test backend has no repository to name the backup database after, like on the demo site
test('restores a draft backup with the test backend after a reload', async ({ cms, page }) => {
  const editor = getEditor(page);
  const title = editor.getByRole('textbox', { name: 'Title' });

  await openWithBackup(page);

  const dialog = page.getByRole('alertdialog', { name: 'Restore Draft' });

  await expect(dialog).toContainText('This entry has a backup from');
  await dialog.getByRole('button', { name: 'Restore' }).click();
  await expect(title).toHaveValue('Backed-up Post');
  // Nothing is saved until the user does
  expect((await cms.readRepo())[POST_PATH]).toBe(FIRST_POST);
});

test('lets the user look through the read-only entry before deciding', async ({ cms, page }) => {
  // @see https://github.com/sveltia/sveltia-cms/issues/566
  const editor = getEditor(page);
  const title = editor.getByRole('textbox', { name: 'Title' });

  await openWithBackup(page);

  const dialog = page.getByRole('alertdialog', { name: 'Restore Draft' });

  await expect(dialog).toBeVisible();
  // The entry as it is now can be read, with nothing in the way, but not changed yet
  await expect(title).toHaveValue('First Post');
  await title.click();
  await expect(title).toHaveAttribute('aria-readonly', 'true');
  await expect(editor.getByRole('button', { name: 'Save' })).toBeHidden();

  // The dialog can be moved out of the way by its header
  const header = dialog.getByText('Restore Draft', { exact: true });
  const { x, y } = /** @type {{ x: number, y: number }} */ (await header.boundingBox());

  await page.mouse.move(x + 5, y + 5);
  await page.mouse.down();
  await page.mouse.move(x + 5, y + 105, { steps: 5 });
  await page.mouse.up();
  await expect.poll(async () => (await header.boundingBox())?.y).toBeCloseTo(y + 100, 0);

  await dialog.getByRole('button', { name: 'Discard' }).click();
  await expect(dialog).toBeHidden();
  await expect(title).not.toHaveAttribute('aria-readonly', 'true');
  await title.fill('Edited Post');
  await expect(title).toHaveValue('Edited Post');
  await expect(editor.getByRole('button', { name: 'Save' })).toBeEnabled();
  expect((await cms.readRepo())[POST_PATH]).toBe(FIRST_POST);
});
