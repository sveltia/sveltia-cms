import { addScripts, BASE_CONFIG, expect, test } from '../fixtures/test.js';
import { getEditor } from '../fixtures/ui.js';

test.describe('custom format without a formatter', () => {
  test.use({
    config: {
      ...BASE_CONFIG,
      collections: [{ ...BASE_CONFIG.collections[0], format: 'keyvalue', extension: 'txt' }],
    },
  });

  const FILE = 'title=First Post\nbody=Hello, world!\n';

  /**
   * Script registering a custom file format with a parser but no formatter, the way an admin page
   * would after the CMS `<script>`. The format name isn’t a built-in one, so there is no formatter
   * to fall back to.
   */
  const REGISTRATION_SCRIPT = `
    CMS.registerCustomFormat('keyvalue', 'txt', {
      fromFile: (text) =>
        Object.fromEntries(text.split('\\n').map((line) => line.split('=')).filter(([key]) => key)),
    });
  `;

  test.beforeEach(async ({ cms, page }) => {
    await addScripts(page, { after: REGISTRATION_SCRIPT });

    await cms.open();
    await cms.seed({ 'content/posts/first-post.txt': FILE });
    await cms.signIn();
  });

  test('fails to save an entry in a custom format without a formatter, leaving the file intact', async ({
    cms,
    page,
  }) => {
    await page.getByRole('row', { name: /First Post/ }).click();

    const editor = getEditor(page);
    const body = editor.getByRole('textbox', { name: 'Body' });

    await expect(body).toHaveValue('Hello, world!');
    await body.fill('Hello again!');
    await editor.getByRole('button', { name: 'Save' }).click();

    const dialog = page.getByRole('alertdialog', { name: 'Error' });

    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(
      'Entries in the custom “keyvalue” format can’t be saved, as no `toFile` method was ' +
        'registered for it with `CMS.registerCustomFormat()`',
    );
    // The file was written empty before the fix
    expect((await cms.readRepo())['content/posts/first-post.txt']).toBe(FILE);
  });
});

test.describe('custom formatter for the `frontmatter` format', () => {
  test.use({
    config: {
      ...BASE_CONFIG,
      collections: [{ ...BASE_CONFIG.collections[0], format: 'frontmatter', extension: 'md' }],
    },
  });

  /**
   * Script registering a formatter that post-processes the output of the built-in one, without a
   * parser, so the built-in one detects the front matter format of each file.
   */
  const REGISTRATION_SCRIPT = `
    CMS.registerCustomFormat('frontmatter', 'md', {
      toFile: async (data, { serialize }) => \`\${await serialize(data)}\\n<!-- formatted -->\`,
    });
  `;

  test.beforeEach(async ({ cms, page }) => {
    await addScripts(page, { after: REGISTRATION_SCRIPT });

    await cms.open();
    await cms.seed({
      'content/posts/first-post.md': '+++\ntitle = "First Post"\n+++\n\nHello, world!\n',
    });
    await cms.signIn();
  });

  test('formats an existing file in the front matter format it was read in', async ({
    cms,
    page,
  }) => {
    await page.getByRole('row', { name: /First Post/ }).click();

    const editor = getEditor(page);
    const body = editor.getByRole('textbox', { name: 'Body' });

    await expect(body).toHaveValue('Hello, world!');
    await body.fill('Hello again!');
    await editor.getByRole('button', { name: 'Save' }).click();

    // The custom formatter was skipped for an existing file before the fix
    await expect
      .poll(async () => (await cms.readRepo())['content/posts/first-post.md'])
      .toBe('+++\ntitle = "First Post"\n+++\n\nHello again!\n\n<!-- formatted -->\n');
  });
});
