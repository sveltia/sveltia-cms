import { NESTED_CONFIG, NESTED_FILES } from '../../fixtures/configs/nested.js';
import { expect, test } from '../../fixtures/test.js';

test.use({ config: NESTED_CONFIG });

test.beforeEach(async ({ cms, page }) => {
  await cms.open();
  await cms.seed(NESTED_FILES);
  await cms.signIn();
  await page.getByRole('tree', { name: 'Collection List' }).getByText('Docs').click();
});

test('shows the folders by name and lists the files in each', async ({ page }) => {
  const docs = page
    .getByRole('tree', { name: 'Collection List' })
    .getByRole('treeitem', { name: 'Docs', exact: true });

  const rows = page.getByRole('grid', { name: 'Entries' }).getByRole('row');

  await expect(docs.getByRole('treeitem', { level: 2 })).toHaveText([/guide/, /reference/]);
  await expect(rows).toHaveText([/FAQ/]);

  await docs.getByText('guide').click();
  await expect(rows).toHaveText([/Guide/, /Installation/, /Usage/]);
});

test('creates an entry in the folder being browsed', async ({ cms, page }) => {
  await page.getByRole('tree', { name: 'Collection List' }).getByText('reference').click();
  await page.getByRole('button', { name: 'Create New Entry' }).click();

  const editor = page.getByRole('group', { name: 'Content Editor' });

  await expect(editor.getByRole('button', { name: 'Parent Folder' })).toContainText('reference');
  await editor.getByRole('textbox', { name: 'Title' }).fill('Errors');
  await editor.getByRole('button', { name: 'Save' }).click();

  await expect
    .poll(async () => (await cms.readRepo())['content/docs/reference/errors.md'])
    .toBe('---\ntitle: Errors\n---\n');
});

test('creates an entry in a new folder', async ({ cms, page }) => {
  await page.getByRole('button', { name: 'Create New Entry' }).click();

  const editor = page.getByRole('group', { name: 'Content Editor' });

  await editor.getByRole('button', { name: 'New Folder' }).click();

  const dialog = page.getByRole('dialog', { name: 'New Folder' });

  await dialog.getByRole('textbox', { name: 'Folder Name' }).fill('Tutorials');
  await dialog.getByRole('button', { name: 'Create' }).click();
  await expect(editor.getByRole('button', { name: 'Parent Folder' })).toContainText('tutorials');
  // The docs are 2 levels deep at most, so the new folder can’t hold another one
  await expect(editor.getByRole('button', { name: 'New Folder' })).toBeDisabled();
  await editor.getByRole('textbox', { name: 'Title' }).fill('First Steps');
  await editor.getByRole('button', { name: 'Save' }).click();

  await expect
    .poll(async () => (await cms.readRepo())['content/docs/tutorials/first-steps.md'])
    .toBe('---\ntitle: First Steps\n---\n');
  await expect(
    page
      .getByRole('tree', { name: 'Collection List' })
      .getByRole('treeitem', { name: 'tutorials' }),
  ).toBeVisible();
});

test('moves an entry to another folder', async ({ cms, page }) => {
  await page.getByRole('row', { name: /FAQ/ }).click();

  const editor = page.getByRole('group', { name: 'Content Editor' });
  const tree = page.locator('dialog:not([inert])').getByRole('tree', { name: 'Parent Folder' });

  await editor.getByRole('button', { name: 'Parent Folder' }).click();
  await expect(tree).toBeVisible();
  await tree.getByText('guide', { exact: true }).click();
  await editor.getByRole('button', { name: 'Save' }).click();

  await expect
    .poll(async () =>
      Object.keys(await cms.readRepo())
        .filter((path) => path.startsWith('content/docs/'))
        .sort(),
    )
    .toEqual([
      'content/docs/guide/_index.md',
      'content/docs/guide/faq.md',
      'content/docs/guide/install.md',
      'content/docs/guide/usage.md',
      'content/docs/reference/api.md',
    ]);
});

test('creates the index file with the New button’s menu', async ({ cms, page }) => {
  await cms.chooseMenuItem(
    page.getByRole('button', { name: 'More Options' }),
    page.getByRole('menuitem', { name: 'Section Page' }),
  );

  const editor = page.getByRole('group', { name: 'Content Editor' });

  await editor.getByRole('textbox', { name: 'Title' }).fill('Documentation');
  await editor.getByRole('button', { name: 'Save' }).click();

  await expect
    .poll(async () => (await cms.readRepo())['content/docs/_index.md'])
    .toBe('---\ntitle: Documentation\n---\n');

  // There’s only one index file, so the menu is gone
  await expect(page.getByRole('button', { name: 'Create New Entry' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'More Options' })).toHaveCount(0);
  // The index file is listed with its label rather than its title, first
  await expect(page.getByRole('grid', { name: 'Entries' }).getByRole('row')).toHaveText([
    /Section Page/,
    /FAQ/,
  ]);
});
