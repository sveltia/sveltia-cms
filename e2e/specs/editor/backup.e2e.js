import { expect, test } from '../../fixtures/test.js';
import { getEditor } from '../../fixtures/ui.js';

const POST_PATH = 'content/posts/first-post.md';
const FIRST_POST = '---\ntitle: First Post\n---\n\nHello, world!\n';

test.beforeEach(async ({ cms }) => {
  await cms.open();
  await cms.seed({ [POST_PATH]: FIRST_POST });
  await cms.signIn();
});

// The test backend has no repository to name the backup database after, like on the demo site
test('restores a draft backup with the test backend after a reload', async ({ cms, page }) => {
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

  const dialog = page.getByRole('alertdialog', { name: 'Restore Draft' });

  await expect(dialog).toContainText('This entry has a backup from');
  await dialog.getByRole('button', { name: 'Restore' }).click();
  await expect(title).toHaveValue('Backed-up Post');
  // Nothing is saved until the user does
  expect((await cms.readRepo())[POST_PATH]).toBe(FIRST_POST);
});
