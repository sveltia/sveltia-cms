import { expect, test } from '../../fixtures/test.js';
import { getEditor } from '../../fixtures/ui.js';

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
      // A custom format, whose formatter can hold an author being prepared, see below
      format: 'name-only',
      extension: 'txt',
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
  // Hold the entry being prepared with a slow formatter, until the test lets it go
  await page.evaluate(() => {
    /** @type {any} */
    const win = window;

    win.formatGate = Promise.withResolvers();
    win.formatCalled = false;
    win.CMS.registerCustomFormat('name-only', 'txt', {
      // eslint-disable-next-line jsdoc/require-jsdoc
      fromFile: (/** @type {string} */ text) => ({ name: text.trim() }),
      // eslint-disable-next-line jsdoc/require-jsdoc
      toFile: async (/** @type {any} */ { name }) => {
        win.formatCalled = true;
        await win.formatGate.promise;

        return name;
      },
    });
  });

  await page.getByRole('button', { name: 'Create New Entry' }).first().click();

  const editor = getEditor(page);

  await editor.getByRole('textbox', { name: 'Title' }).fill('Hello');
  await editor.getByRole('button', { name: /Add.*Author/ }).click();

  const dialog = page.getByRole('dialog', { name: /Creating.*Author/ });

  await dialog.getByRole('textbox', { name: 'Name' }).fill('Ada');
  await dialog.getByRole('button', { name: 'Add', exact: true }).click();
  await expect.poll(() => page.evaluate(() => /** @type {any} */ (window).formatCalled)).toBe(true);

  // The footer buttons are disabled meanwhile, but the Escape key still closes the dialog
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();

  // Let the author be prepared, then save the post without any listener holding it
  await page.evaluate(() => {
    /** @type {any} */
    const win = window;

    win.formatGate.resolve();
  });
  await editor.getByRole('button', { name: 'Save' }).click();

  await expect.poll(async () => (await cms.readRepo())['content/posts/hello.md']).toBeDefined();
  // The author isn’t selected, nor saved along with the post
  expect(await cms.readRepo()).toEqual({
    'content/posts/hello.md': "---\ntitle: Hello\nauthor: ''\n---\n",
  });
});

test('calls the event listeners for an added author when the post is saved', async ({
  cms,
  page,
}) => {
  await page.evaluate(() => {
    /** @type {any} */
    const win = window;

    win.events = [];
    win.CMS.registerCustomFormat('name-only', 'txt', {
      // eslint-disable-next-line jsdoc/require-jsdoc
      fromFile: (/** @type {string} */ text) => ({ name: text.trim() }),
      // eslint-disable-next-line jsdoc/require-jsdoc
      toFile: (/** @type {any} */ { name }) => name,
    });
    ['preSave', 'postSave'].forEach((name) => {
      win.CMS.registerEventListener({
        name,
        // eslint-disable-next-line jsdoc/require-jsdoc
        handler: ({ entry }) => {
          win.events.push(`${name} ${entry.get('collection')} ${entry.get('slug')}`);

          // The change made by a `preSave` listener is what’s written for the author too
          return name === 'preSave' && entry.get('collection') === 'authors'
            ? entry.get('data').set('name', entry.getIn(['data', 'name']).toUpperCase())
            : undefined;
        },
      });
    });
  });

  await page.getByRole('button', { name: 'Create New Entry' }).first().click();

  const editor = getEditor(page);

  await editor.getByRole('textbox', { name: 'Title' }).fill('Hello');
  await editor.getByRole('button', { name: /Add.*Author/ }).click();

  const dialog = page.getByRole('dialog', { name: /Creating.*Author/ });

  await dialog.getByRole('textbox', { name: 'Name' }).fill('Ada');
  await dialog.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(dialog).toBeHidden();

  // Nothing is saved yet, so no listener has been called
  expect(await page.evaluate(() => /** @type {any} */ (window).events)).toEqual([]);

  await editor.getByRole('button', { name: 'Save' }).click();

  await expect.poll(async () => (await cms.readRepo())['content/authors/ada.txt']).toBe('ADA\n');
  expect(await page.evaluate(() => /** @type {any} */ (window).events)).toEqual([
    'preSave posts hello',
    'preSave authors ada',
    'postSave posts hello',
    'postSave authors ada',
  ]);
});
