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
