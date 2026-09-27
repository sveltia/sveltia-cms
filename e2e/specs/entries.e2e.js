import { expect, test } from '../fixtures/test.js';

test.beforeEach(async ({ cms }) => {
  await cms.open();
  await cms.seed({
    'content/posts/first-post.md': '---\ntitle: First Post\n---\n\nHello, world!\n',
    'content/posts/second-post.md': '---\ntitle: Second Post\n---\n\nSee you again.\n',
  });
  await cms.signIn();
});

test('lists the entries in the repository', async ({ page }) => {
  const list = page.getByRole('group', { name: 'Entry List' });

  await expect(list.getByRole('row')).toHaveCount(2);
  await expect(list.getByRole('row', { name: /First Post/ })).toBeVisible();
  await expect(list.getByRole('row', { name: /Second Post/ })).toBeVisible();
});

test('creates an entry', async ({ cms, page }) => {
  await page.getByRole('button', { name: 'Create New Entry' }).first().click();

  const editor = page.getByRole('group', { name: 'Content Editor' });

  await editor.getByRole('textbox', { name: 'Title' }).fill('Third Post');
  await editor.getByRole('textbox', { name: 'Body' }).fill('A new post.');
  await editor.getByRole('button', { name: 'Save' }).click();

  await expect
    .poll(async () => (await cms.readRepo())['content/posts/third-post.md'])
    .toBe('---\ntitle: Third Post\n---\n\nA new post.\n');
  await expect(page.getByRole('group', { name: 'Entry List' }).getByRole('row')).toHaveCount(3);
});

test('updates an entry', async ({ cms, page }) => {
  await page.getByRole('row', { name: /First Post/ }).click();

  const editor = page.getByRole('group', { name: 'Content Editor' });
  const body = editor.getByRole('textbox', { name: 'Body' });

  await expect(body).toHaveValue('Hello, world!');
  await body.fill('Hello again!');
  await editor.getByRole('button', { name: 'Save' }).click();

  await expect
    .poll(async () => (await cms.readRepo())['content/posts/first-post.md'])
    .toBe('---\ntitle: First Post\n---\n\nHello again!\n');
});

test('deletes an entry', async ({ cms, page }) => {
  await page.getByRole('row', { name: /First Post/ }).click();
  await page.getByRole('button', { name: 'Show Editor Options' }).click();
  await page.getByRole('menuitem', { name: 'Delete Entry' }).click();
  await page
    .getByRole('alertdialog', { name: 'Delete Entry' })
    .getByRole('button', { name: 'Delete' })
    .click();

  await expect
    .poll(async () => Object.keys(await cms.readRepo()))
    .toEqual(['content/posts/second-post.md']);
  await expect(page.getByRole('group', { name: 'Entry List' }).getByRole('row')).toHaveCount(1);
});
