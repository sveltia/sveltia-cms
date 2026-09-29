import { BASE_CONFIG, expect, test } from '../fixtures/test.js';

test.use({
  config: {
    ...BASE_CONFIG,
    collections: [{ ...BASE_CONFIG.collections[0], format: 'keyvalue', extension: 'txt' }],
  },
});

const FILE = 'title=First Post\nbody=Hello, world!\n';

/**
 * Script registering a custom file format with a parser but no formatter, the way an admin page
 * would after the CMS `<script>`. The format name isn’t a built-in one, so there is no formatter to
 * fall back to.
 */
const REGISTRATION_SCRIPT = `
  CMS.registerCustomFormat('keyvalue', 'txt', {
    fromFile: (text) =>
      Object.fromEntries(text.split('\\n').map((line) => line.split('=')).filter(([key]) => key)),
  });
`;

test.beforeEach(async ({ cms, page }) => {
  await page.route('**/admin/', async (route) => {
    const response = await route.fetch();
    const html = await response.text();

    await route.fulfill({
      response,
      body: html.replace('</body>', `<script>${REGISTRATION_SCRIPT}</script></body>`),
    });
  });

  await cms.open();
  await cms.seed({ 'content/posts/first-post.txt': FILE });
  await cms.signIn();
});

test('fails to save an entry in a custom format without a formatter, leaving the file intact', async ({
  cms,
  page,
}) => {
  await page.getByRole('row', { name: /First Post/ }).click();

  const editor = page.getByRole('group', { name: 'Content Editor' });
  const body = editor.getByRole('textbox', { name: 'Body' });

  await expect(body).toHaveValue('Hello, world!');
  await body.fill('Hello again!');
  await editor.getByRole('button', { name: 'Save' }).click();

  const dialog = page.getByRole('alertdialog', { name: 'Error' });

  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText(
    'Entries in the custom “keyvalue” format can’t be saved, as no `toFile` method was registered ' +
      'for it with `CMS.registerCustomFormat()`',
  );
  // The file was written empty before the fix
  expect((await cms.readRepo())['content/posts/first-post.txt']).toBe(FILE);
});
