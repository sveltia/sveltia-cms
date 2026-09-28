import { MONOLINGUAL_CONFIG, MONOLINGUAL_FILES } from '../../fixtures/configs/monolingual.js';
import { expect, test } from '../../fixtures/test.js';

test.use({ config: MONOLINGUAL_CONFIG });

test.beforeEach(async ({ cms }) => {
  await cms.open();
  await cms.seed(MONOLINGUAL_FILES);
  await cms.signIn();
});

test('lists the files of a file collection', async ({ page }) => {
  await page.getByRole('treeitem', { name: 'Pages' }).click();
  await expect(page.getByRole('grid', { name: 'Files' }).getByRole('row')).toHaveText([
    /About Page/,
    /Contact Page/,
  ]);
});

test('edits a nested field in a YAML file', async ({ cms, page }) => {
  await page.getByRole('treeitem', { name: 'Pages' }).click();
  await page.getByRole('row', { name: 'Contact Page' }).click();

  const editor = page.getByRole('group', { name: 'Content Editor' });
  const city = editor.getByRole('group', { name: /Office/ }).getByRole('textbox', { name: 'City' });

  await expect(city).toHaveValue('Toronto');
  await city.fill('Vancouver');
  await editor.getByRole('button', { name: 'Save' }).click();

  await expect
    .poll(async () => (await cms.readRepo())['content/pages/contact.yml'])
    .toBe(MONOLINGUAL_FILES['content/pages/contact.yml'].replace('Toronto', 'Vancouver'));
});

test('edits a Markdown file of a file collection', async ({ cms, page }) => {
  await page.getByRole('treeitem', { name: 'Pages' }).click();
  await page.getByRole('row', { name: 'About Page' }).click();

  const editor = page.getByRole('group', { name: 'Content Editor' });

  await expect(editor.getByRole('textbox', { name: 'Title' })).toHaveValue('About Us');
  await editor.getByRole('textbox', { name: 'Title' }).fill('About the Magazine');
  await editor.getByRole('button', { name: 'Save' }).click();

  await expect
    .poll(async () => (await cms.readRepo())['content/pages/about.md'])
    .toBe('---\ntitle: About the Magazine\n---\n\nWe write about the sky.\n');
});

test('edits the singleton’s fields of different types', async ({ cms, page }) => {
  await page.getByRole('treeitem', { name: 'Site Settings' }).click();

  const editor = page.getByRole('group', { name: 'Content Editor' });

  await expect(editor.getByRole('textbox', { name: 'Site Name' })).toHaveValue('Night Sky');
  await editor.getByRole('textbox', { name: 'Accent Color' }).fill('#aa3300');
  await editor.getByRole('spinbutton', { name: 'Posts per Page' }).fill('12');
  await editor.getByRole('switch', { name: 'Show Comments' }).click();
  await editor.getByRole('button', { name: 'Save' }).click();

  // The number and the boolean keep their types in the JSON file. It can be read while it’s being
  // written, so keep polling until it parses
  await expect
    .poll(async () => {
      try {
        return JSON.parse((await cms.readRepo())['data/settings.json']);
      } catch {
        return undefined;
      }
    })
    .toEqual({
      site_name: 'Night Sky',
      accent_color: '#aa3300',
      posts_per_page: 12,
      show_comments: false,
    });
});
