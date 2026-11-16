import { expect, test } from '../../fixtures/test.js';
import { getEditor } from '../../fixtures/ui.js';

/**
 * Blog whose posts refer to an author with a Relation field, from which the selected author can be
 * edited on the fly.
 * @see https://github.com/sveltia/sveltia-cms/issues/1129
 */
const CONFIG = {
  backend: { name: 'test-repo' },
  media_folder: 'static/images',
  public_folder: '/images',
  collections: [
    {
      name: 'posts',
      label: 'Posts',
      label_singular: 'Post',
      folder: 'content/posts',
      create: true,
      fields: [
        { name: 'title', label: 'Title' },
        {
          name: 'author',
          label: 'Author',
          widget: 'relation',
          collection: 'authors',
          value_field: '{{slug}}',
          search_fields: ['name'],
          display_fields: ['name'],
          required: false,
        },
      ],
    },
    {
      name: 'authors',
      label: 'Authors',
      label_singular: 'Author',
      folder: 'content/authors',
      create: true,
      identifier_field: 'name',
      fields: [
        { name: 'name', label: 'Name' },
        { name: 'bio', label: 'Bio', required: false },
      ],
    },
  ],
};

test.use({ config: CONFIG });

test.beforeEach(async ({ cms }) => {
  await cms.open();
});

test('saves the changes to the selected author along with the post', async ({ cms, page }) => {
  const post = '---\ntitle: Hello\nauthor: ada\n---\n';

  await cms.seed({
    'content/posts/hello.md': post,
    'content/authors/ada.md': '---\nname: Ada\nbio: Mathematician\n---\n',
    'content/authors/alan.md': '---\nname: Alan\nbio: Logician\n---\n',
  });
  await cms.signIn();
  await page.getByRole('row').filter({ hasText: 'Hello' }).click();

  const editor = getEditor(page);

  await editor.getByRole('button', { name: /Edit.*Ada/ }).click();

  const dialog = page.getByRole('dialog', { name: /Editing.*Author/ });

  await expect(dialog.getByRole('textbox', { name: 'Name' })).toHaveValue('Ada');
  await dialog.getByRole('textbox', { name: 'Bio' }).fill('Mathematician and writer');
  await dialog.getByRole('button', { name: 'Update' }).click();
  await expect(dialog).toBeHidden();

  // Nothing is saved yet
  expect((await cms.readRepo())['content/authors/ada.md']).toBe(
    '---\nname: Ada\nbio: Mathematician\n---\n',
  );

  // The post itself is unchanged, but the author is saved along with it
  await editor.getByRole('button', { name: 'Save' }).click();

  await expect
    .poll(async () => (await cms.readRepo())['content/authors/ada.md'])
    .toBe('---\nname: Ada\nbio: Mathematician and writer\n---\n');

  const repo = await cms.readRepo();

  expect(repo['content/posts/hello.md']).toBe(post);
  expect(repo['content/authors/alan.md']).toBe('---\nname: Alan\nbio: Logician\n---\n');
});

test('changes an author added from the field before the post is saved', async ({ cms, page }) => {
  await cms.signIn();
  await page.getByRole('button', { name: 'Create New Entry' }).first().click();

  const editor = getEditor(page);

  await editor.getByRole('textbox', { name: 'Title' }).fill('Hello');
  await editor.getByRole('button', { name: /Add.*Author/ }).click();

  const createDialog = page.getByRole('dialog', { name: /Creating.*Author/ });

  await createDialog.getByRole('textbox', { name: 'Name' }).fill('Ada');
  await createDialog.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(createDialog).toBeHidden();

  // The new author is selected, and can be opened again
  await editor.getByRole('button', { name: /Edit.*Ada/ }).click();

  const editDialog = page.getByRole('dialog', { name: /Editing.*Author/ });

  await expect(editDialog.getByRole('textbox', { name: 'Name' })).toHaveValue('Ada');
  await editDialog.getByRole('textbox', { name: 'Name' }).fill('Ada Lovelace');
  await editDialog.getByRole('button', { name: 'Update' }).click();
  await expect(editDialog).toBeHidden();

  // The slug follows the new name, and the field follows the slug
  await expect(editor.getByRole('button', { name: /Edit.*Ada Lovelace/ })).toBeVisible();
  await editor.getByRole('button', { name: 'Save' }).click();

  await expect
    .poll(async () => (await cms.readRepo())['content/posts/hello.md'])
    .toBe('---\ntitle: Hello\nauthor: ada-lovelace\n---\n');
  // The earlier version of the author is not saved
  expect(await cms.readRepo()).toEqual({
    'content/posts/hello.md': '---\ntitle: Hello\nauthor: ada-lovelace\n---\n',
    'content/authors/ada-lovelace.md': "---\nname: Ada Lovelace\nbio: ''\n---\n",
  });
});

test.describe('in a rich text editor component', () => {
  test.use({
    config: {
      ...CONFIG,
      collections: [
        {
          ...CONFIG.collections[0],
          fields: [
            { name: 'title', label: 'Title' },
            { name: 'body', label: 'Body', widget: 'markdown', editor_components: ['byline'] },
          ],
        },
        CONFIG.collections[1],
      ],
    },
  });

  test.beforeEach(async ({ page }) => {
    // The editor reads the components when it’s opened
    await page.evaluate(`
      CMS.registerEditorComponent({
        id: 'byline',
        label: 'Byline',
        fields: [
          {
            name: 'author',
            label: 'Author',
            widget: 'relation',
            collection: 'authors',
            value_field: '{{slug}}',
            search_fields: ['name'],
            display_fields: ['name'],
          },
        ],
        pattern: /^{{< byline "([^"]*)" >}}$/,
        fromBlock: (match) => ({ author: match[1] }),
        toBlock: ({ author }) => '{{< byline "' + author + '" >}}',
      });
    `);
  });

  test('opens the selected author with its values', async ({ cms, page }) => {
    const post = '---\ntitle: Hello\n---\n\n{{< byline "ada" >}}\n';

    await cms.seed({
      'content/posts/hello.md': post,
      'content/authors/ada.md': '---\nname: Ada\nbio: Mathematician\n---\n',
    });
    await cms.signIn();
    await page.getByRole('row').filter({ hasText: 'Hello' }).click();
    await getEditor(page)
      .getByRole('button', { name: /Edit.*Ada/ })
      .click();

    const dialog = page.getByRole('dialog', { name: /Editing.*Author/ });

    // The fields of the author aren’t taken for those of the component, which are stored apart
    await expect(dialog.getByRole('textbox', { name: 'Name' })).toHaveValue('Ada');
    await dialog.getByRole('textbox', { name: 'Bio' }).fill('Mathematician and writer');
    await dialog.getByRole('button', { name: 'Update' }).click();
    await expect(dialog).toBeHidden();
    await getEditor(page).getByRole('button', { name: 'Save' }).click();

    await expect
      .poll(async () => (await cms.readRepo())['content/authors/ada.md'])
      .toBe('---\nname: Ada\nbio: Mathematician and writer\n---\n');
    expect((await cms.readRepo())['content/posts/hello.md']).toBe(post);
  });
});

test.describe('with a rich text editor component in the selected author', () => {
  test.use({
    config: {
      ...CONFIG,
      collections: [
        CONFIG.collections[0],
        {
          ...CONFIG.collections[1],
          fields: [
            { name: 'name', label: 'Name' },
            { name: 'body', label: 'Body', widget: 'markdown', editor_components: ['note'] },
          ],
        },
      ],
    },
  });

  test.beforeEach(async ({ page }) => {
    // The editor reads the components when it’s opened
    await page.evaluate(`
      CMS.registerEditorComponent({
        id: 'note',
        label: 'Note',
        fields: [{ name: 'text', label: 'Note Text', widget: 'markdown' }],
        pattern: /^<aside>\\n([\\s\\S]*?)\\n<\\/aside>$/,
        fromBlock: (match) => ({ text: match[1] }),
        toBlock: ({ text }) => '<aside>\\n' + text + '\\n</aside>',
      });
    `);
  });

  test('edits the fields of the component', async ({ cms, page }) => {
    const post = '---\ntitle: Hello\nauthor: ada\n---\n';

    await cms.seed({
      'content/posts/hello.md': post,
      'content/authors/ada.md':
        '---\nname: Ada\n---\n\nIntro\n\n<aside>\nMathematician\n</aside>\n',
    });
    await cms.signIn();
    await page.getByRole('row').filter({ hasText: 'Hello' }).click();
    await getEditor(page)
      .getByRole('button', { name: /Edit.*Ada/ })
      .click();

    const dialog = page.getByRole('dialog', { name: /Editing.*Author/ });
    const noteText = dialog.getByRole('textbox', { name: 'Note Text' });

    // The component finds the locale it’s edited in, so its fields are rendered
    await expect(noteText).toHaveText('Mathematician');
    await noteText.click();
    await expect(noteText).toBeFocused();
    await page.keyboard.press('ControlOrMeta+A');
    await page.keyboard.type('Mathematician and writer');
    await expect(noteText).toHaveText('Mathematician and writer');
    // Right away: the dialog waits for the text to reach the body through both rich text editors
    await dialog.getByRole('button', { name: 'Update' }).click();
    await expect(dialog).toBeHidden();
    await getEditor(page).getByRole('button', { name: 'Save' }).click();

    await expect
      .poll(async () => (await cms.readRepo())['content/authors/ada.md'])
      .toBe('---\nname: Ada\n---\n\nIntro\n\n<aside>\nMathematician and writer\n</aside>\n');
    expect((await cms.readRepo())['content/posts/hello.md']).toBe(post);
  });
});
