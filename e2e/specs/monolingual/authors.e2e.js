import { MONOLINGUAL_CONFIG, MONOLINGUAL_FILES } from '../../fixtures/configs/monolingual.js';
import { expect, test } from '../../fixtures/test.js';
import { getEditor } from '../../fixtures/ui.js';

test.use({ config: MONOLINGUAL_CONFIG });

test.beforeEach(async ({ cms, page }) => {
  await cms.open();
  await cms.seed(MONOLINGUAL_FILES);
  await cms.signIn();
  await page.getByRole('treeitem', { name: 'Authors' }).click();
});

test('creates an author with a list of objects, in JSON', async ({ cms, page }) => {
  await page.getByRole('button', { name: 'Create New Entry' }).first().click();

  const editor = getEditor(page);
  const links = editor.getByRole('group', { name: /Links.*Field/ });

  await editor.getByRole('textbox', { name: 'Name' }).fill('Ana Lima');
  await editor.getByRole('textbox', { name: 'Email' }).fill('ana@example.com');
  await links.getByRole('button', { name: /Add.*Links/ }).click();
  await links.getByRole('textbox', { name: 'Label' }).fill('Blog');
  await links.getByRole('textbox', { name: 'URL' }).fill('https://ana.example.com');
  await links.getByRole('button', { name: /Add.*Links/ }).click();
  await links.getByRole('textbox', { name: 'Label' }).nth(1).fill('Mastodon');
  await links.getByRole('textbox', { name: 'URL' }).nth(1).fill('https://social.example/@ana');
  await editor.getByRole('button', { name: 'Save' }).click();

  // The slug comes from the `identifier_field`
  await expect
    .poll(async () => (await cms.readRepo())['content/authors/ana-lima.json'])
    .toBe(
      `${JSON.stringify(
        {
          name: 'Ana Lima',
          email: 'ana@example.com',
          bio: '',
          links: [
            { label: 'Blog', url: 'https://ana.example.com' },
            { label: 'Mastodon', url: 'https://social.example/@ana' },
          ],
        },
        null,
        2,
      )}\n`,
    );
});

test('validates a field against its pattern', async ({ cms, page }) => {
  await page.getByRole('button', { name: 'Create New Entry' }).first().click();

  const editor = getEditor(page);
  const email = editor.getByRole('group', { name: /Email/ });

  await editor.getByRole('textbox', { name: 'Name' }).fill('Ana Lima');
  await email.getByRole('textbox').fill('ana@');
  await editor.getByRole('button', { name: 'Save' }).click();

  await expect(email.getByRole('alert')).toContainText('Enter a valid email address');
  expect(Object.keys(await cms.readRepo())).not.toContain('content/authors/ana-lima.json');

  await email.getByRole('textbox').fill('ana@example.com');
  await editor.getByRole('button', { name: 'Save' }).click();
  await expect
    .poll(async () => Object.keys(await cms.readRepo()))
    .toContain('content/authors/ana-lima.json');
});

test('offers a new author in a post’s relation field', async ({ cms, page }) => {
  await page.getByRole('button', { name: 'Create New Entry' }).first().click();

  const editor = getEditor(page);

  await editor.getByRole('textbox', { name: 'Name' }).fill('Ana Lima');
  await editor.getByRole('textbox', { name: 'Email' }).fill('ana@example.com');
  await editor.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('row', { name: /Ana Lima/ })).toBeVisible();

  await page.getByRole('treeitem', { name: 'Posts' }).click();
  await page.getByRole('row', { name: /First Light/ }).click();

  const author = getEditor(page).getByRole('radiogroup', { name: 'Author' });

  await expect(author.getByRole('radio')).toHaveCount(3);
  await expect(author.getByRole('radio', { name: 'Ana Lima' })).not.toBeChecked();
  await expect(author.getByRole('radio', { name: 'Jane Doe' })).toBeChecked();
  await author.getByRole('radio', { name: 'Ana Lima' }).click();
  await getEditor(page).getByRole('button', { name: 'Save' }).click();

  // The relation stores the author’s slug
  await expect
    .poll(async () => (await cms.readRepo())['content/posts/2026-01-first-light.md'])
    .toContain('author: ana-lima\n');
});
