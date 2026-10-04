import { expect, test } from '../../fixtures/test.js';

/**
 * Blog whose posts refer to an author with an optional Relation field, from which an author can be
 * added on the fly.
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
      fields: [{ name: 'name', label: 'Name' }],
    },
  ],
};

test.use({ config: CONFIG });

test.beforeEach(async ({ cms }) => {
  await cms.open();
  await cms.signIn();
});

test('doesn’t add an author once the dialog is closed while it’s being prepared', async ({
  cms,
  page,
}) => {
  // Hold the entry being prepared with a slow `preSave` event listener, which runs for the new
  // author too, until the test lets it go
  await page.evaluate(() => {
    /** @type {any} */
    const win = window;

    win.preSaveGate = Promise.withResolvers();
    win.preSaveCalled = false;
    win.CMS.registerEventListener({
      name: 'preSave',
      // eslint-disable-next-line jsdoc/require-jsdoc
      handler: async () => {
        win.preSaveCalled = true;
        await win.preSaveGate.promise;
      },
    });
  });

  await page.getByRole('button', { name: 'Create New Entry' }).first().click();

  const editor = page.getByRole('group', { name: 'Content Editor' });

  await editor.getByRole('textbox', { name: 'Title' }).fill('Hello');
  await editor.getByRole('button', { name: /Add.*Author/ }).click();

  const dialog = page.getByRole('dialog', { name: /Creating.*Author/ });

  await dialog.getByRole('textbox', { name: 'Name' }).fill('Ada');
  await dialog.getByRole('button', { name: 'Add', exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => /** @type {any} */ (window).preSaveCalled))
    .toBe(true);

  // The footer buttons are disabled meanwhile, but the Escape key still closes the dialog
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();

  // Let the author be prepared, then save the post without any listener holding it
  await page.evaluate(() => {
    /** @type {any} */
    const win = window;

    win.preSaveGate.resolve();
  });
  await editor.getByRole('button', { name: 'Save' }).click();

  await expect.poll(async () => (await cms.readRepo())['content/posts/hello.md']).toBeDefined();
  // The author isn’t selected, nor saved along with the post
  expect(await cms.readRepo()).toEqual({
    'content/posts/hello.md': "---\ntitle: Hello\nauthor: ''\n---\n",
  });
});
