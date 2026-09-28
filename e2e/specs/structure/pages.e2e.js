import { NESTED_CONFIG, NESTED_FILES } from '../../fixtures/configs/nested.js';
import { expect, test } from '../../fixtures/test.js';

/**
 * @import { Page } from '@playwright/test';
 */

test.use({ config: NESTED_CONFIG });

test.beforeEach(async ({ cms }) => {
  await cms.open();
  await cms.seed(NESTED_FILES);
  await cms.signIn();
});

/**
 * Choose a folder with the path editor of the open entry.
 * @param {Page} page Page.
 * @param {string} label Folder label.
 */
const chooseParentFolder = async (page, label) => {
  const tree = page.locator('dialog:not([inert])').getByRole('tree', { name: 'Parent Folder' });

  await page.getByRole('button', { name: 'Parent Folder' }).click();
  await expect(tree).toBeVisible();
  await tree.getByText(label, { exact: true }).click();
};

test('shows the folders in the sidebar and lists the entries in each', async ({ page }) => {
  const collections = page.getByRole('tree', { name: 'Collection List' });
  const pages = collections.getByRole('treeitem', { name: 'Pages', exact: true });
  const rows = page.getByRole('grid', { name: 'Entries' }).getByRole('row');

  // A page that holds no other page is an entry, not a folder. The alumni page is deeper than the
  // collection’s `depth`, so it isn’t part of the collection at all
  await expect(pages.getByRole('treeitem', { level: 2 })).toHaveText([/About Us/]);
  await expect(pages).toContainText('5');
  await expect(rows).toHaveText([/About Us/, /Contact/, /Home/]);

  await pages.getByRole('treeitem', { name: 'About Us' }).click();
  await expect(rows).toHaveText([/Our Team/]);
  await expect(page).toHaveURL(/#\/collections\/pages\/filter\/about$/);

  await pages.getByRole('treeitem', { name: 'Our Team', level: 3 }).getByText('Our Team').click();
  await expect(rows).toHaveText([/Alumni/]);

  await pages.getByText('Pages', { exact: true }).click();
  await expect(rows).toHaveText([/About Us/, /Contact/, /Home/]);
});

test('shows the summary and the thumbnail of each entry', async ({ page }) => {
  const rows = page.getByRole('grid', { name: 'Entries' }).getByRole('row');

  await expect(rows).toHaveText([
    /About Us – Who we are/,
    /Contact – Get in touch/,
    /Home – Welcome/,
  ]);
  // The thumbnail is decorative, so it has no role to query by
  await expect(rows.filter({ hasText: 'About Us' }).locator('img')).toHaveAttribute(
    'src',
    /^blob:/,
  );
  await expect(rows.filter({ hasText: 'About Us' }).locator('img')).toHaveJSProperty(
    'complete',
    true,
  );
  await expect(rows.filter({ hasText: 'Contact' }).locator('img')).toHaveCount(0);
});

test('creates an entry in the folder being browsed', async ({ cms, page }) => {
  await page.getByRole('tree', { name: 'Collection List' }).getByText('About Us').click();
  await page.getByRole('button', { name: 'Create New Entry' }).click();

  const editor = page.getByRole('group', { name: 'Content Editor' });

  await expect(editor.getByRole('button', { name: 'Parent Folder' })).toContainText('About Us');
  await editor.getByRole('textbox', { name: 'Title' }).fill('History');
  await editor.getByRole('button', { name: 'Save' }).click();

  await expect
    .poll(async () => (await cms.readRepo())['content/pages/about/history/index.md'])
    .toBe("---\ntitle: History\ndescription: ''\ncover: ''\n---\n");
});

test('creates an entry in another folder chosen with the path editor', async ({ cms, page }) => {
  await page.getByRole('button', { name: 'Create New Entry' }).click();

  const editor = page.getByRole('group', { name: 'Content Editor' });

  await expect(editor.getByRole('button', { name: 'Parent Folder' })).toContainText('Pages');
  await chooseParentFolder(page, 'Contact');
  await expect(editor.getByRole('button', { name: 'Parent Folder' })).toContainText('Contact');
  await editor.getByRole('textbox', { name: 'Title' }).fill('Map');
  await editor.getByRole('button', { name: 'Save' }).click();

  await expect
    .poll(async () => Object.keys(await cms.readRepo()))
    .toContain('content/pages/contact/map/index.md');

  // The contact page now holds another page, so it becomes a folder in the sidebar
  await expect(
    page
      .getByRole('tree', { name: 'Collection List' })
      .getByRole('treeitem', { name: 'Pages', exact: true })
      .getByRole('treeitem'),
  ).toHaveText([/About Us/, /Contact/]);
});

test('moves an entry along with the pages below it', async ({ cms, page }) => {
  await page.getByRole('tree', { name: 'Collection List' }).getByText('About Us').click();
  await page.getByRole('row', { name: /Our Team/ }).click();

  const editor = page.getByRole('group', { name: 'Content Editor' });

  await expect(editor.getByRole('button', { name: 'Parent Folder' })).toContainText('About Us');
  await chooseParentFolder(page, 'Pages');
  await editor.getByRole('button', { name: 'Save' }).click();

  await expect
    .poll(async () =>
      Object.keys(await cms.readRepo())
        .filter((path) => path.startsWith('content/pages/'))
        .sort(),
    )
    .toEqual([
      'content/pages/about/index.md',
      // Deeper than the collection’s `depth`, so the CMS doesn’t know about it
      'content/pages/about/team/alumni/2020/index.md',
      'content/pages/contact/index.md',
      'content/pages/index.md',
      'content/pages/team/alumni/index.md',
      'content/pages/team/index.md',
    ]);
});

test('offers no folder that would put an entry deeper than the collection’s depth', async ({
  page,
}) => {
  const tree = page.locator('dialog:not([inert])').getByRole('tree', { name: 'Parent Folder' });

  await page.getByRole('button', { name: 'Create New Entry' }).click();
  await chooseParentFolder(page, 'About Us');
  await chooseParentFolder(page, 'Our Team');
  await page.getByRole('button', { name: 'Parent Folder' }).click();

  // A new page in the alumni page’s folder would be 5 levels down, beyond the depth of 4, where
  // the CMS would no longer find it
  await expect(tree.getByRole('treeitem', { name: 'Our Team' })).toBeVisible();
  await expect(tree.getByRole('treeitem', { name: 'Alumni' })).toHaveCount(0);
});

test('offers no folder too deep for the pages below the entry being moved', async ({ page }) => {
  const editor = page.getByRole('group', { name: 'Content Editor' });

  await page.getByRole('row', { name: /About Us/ }).click();
  await expect(editor.getByRole('textbox', { name: 'Title' })).toHaveValue('About Us');

  // The alumni page is 4 levels down already, so the about page can’t go any deeper, which leaves
  // the top level as the only choice, and nothing for the path editor to offer
  await expect(editor.getByRole('button', { name: 'Parent Folder' })).toHaveCount(0);
});
