import { expect, test } from '../../fixtures/test.js';

import { openCollection } from './helpers.js';

/**
 * @import { Locator, Page } from '@playwright/test';
 * @import { CMS } from '../../fixtures/test.js';
 */

/**
 * A title and a body field of the given name, which a front matter format keeps below the front
 * matter block unless `body_field.inline` is on.
 * @param {string} [bodyName] Name of the body field.
 * @returns {Record<string, any>[]} Fields.
 */
const fields = (bodyName = 'body') => [
  { name: 'title', label: 'Title' },
  { name: bodyName, label: 'Body', widget: 'text' },
];

/**
 * A folder collection with the given name and options. Its folder is `content/{name}`.
 * @param {string} name Collection name.
 * @param {Record<string, any>} [options] More collection options.
 * @returns {Record<string, any>} Collection.
 */
const collection = (name, options = {}) => ({
  name,
  label: name,
  folder: `content/${name}`,
  create: true,
  fields: fields(),
  ...options,
});

/**
 * A blog whose collections each keep the body of an entry in their own way: under another key,
 * inline in the front matter, under another key in TOML front matter, and in a file collection
 * whose files can override the collection’s option.
 */
const CONFIG = {
  backend: { name: 'test-repo' },
  media_folder: 'static/images',
  collections: [
    collection('posts', { body_field: { key: 'content' }, fields: fields('content') }),
    collection('notes', { body_field: { inline: true } }),
    collection('hugo', {
      format: 'toml-frontmatter',
      body_field: { key: 'text', inline: false },
      fields: fields('text'),
    }),
    {
      name: 'pages',
      label: 'pages',
      body_field: { inline: true },
      files: [
        {
          name: 'about',
          label: 'About',
          file: 'content/pages/about.md',
          body_field: { key: 'content' },
          fields: fields('content'),
        },
        {
          name: 'contact',
          label: 'Contact',
          file: 'content/pages/contact.md',
          fields: fields(),
        },
      ],
    },
  ],
};

test.use({ config: CONFIG });

/**
 * Open the CMS, seed the repository with the given files and sign in.
 * @param {CMS} cms CMS fixture.
 * @param {Record<string, string>} [files] Files to seed.
 */
const start = async (cms, files) => {
  await cms.open();

  if (files) {
    await cms.seed(files);
  }

  await cms.signIn();
};

/**
 * Open an entry from the list of a collection, or a file from a file collection, and check the
 * body the editor shows.
 * @param {Page} page Page.
 * @param {string} collectionName Collection name.
 * @param {string} title Entry title or file label.
 * @param {string} body Expected body.
 * @returns {Promise<Locator>} Content editor.
 */
const openEntry = async (page, collectionName, title, body) => {
  await openCollection(page, collectionName);
  await page.getByRole('row', { name: title, exact: true }).click();

  const editor = page.getByRole('group', { name: 'Content Editor' });

  await expect(editor.getByRole('textbox', { name: 'Body' })).toHaveValue(body);

  return editor;
};

/**
 * Change the body of the entry open in the editor and save it, which takes us back to the list.
 * @param {Locator} editor Content editor.
 */
const editBody = async (editor) => {
  await editor.getByRole('textbox', { name: 'Body' }).fill('Edited.');
  await editor.getByRole('button', { name: 'Save' }).click();
  await expect(editor).toBeHidden();
};

/**
 * Create an entry with a title and a body in a collection, and save it.
 * @param {Page} page Page.
 * @param {string} collectionName Collection name.
 */
const createEntry = async (page, collectionName) => {
  await openCollection(page, collectionName);
  await page.getByRole('button', { name: 'Create New Entry' }).first().click();

  const editor = page.getByRole('group', { name: 'Content Editor' });

  await editor.getByRole('textbox', { name: 'Title', exact: true }).fill('Night Sky');
  await editor.getByRole('textbox', { name: 'Body' }).fill('Look up.');
  await editor.getByRole('button', { name: 'Save' }).click();
  await expect(editor).toBeHidden();
};

/**
 * Wait for a file to be written with the given content.
 * @param {CMS} cms CMS fixture.
 * @param {string} path File path.
 * @param {string} content Expected content.
 */
const expectFile = async (cms, path, content) => {
  await expect.poll(async () => (await cms.readRepo())[path]).toBe(content);
};

test.describe('`key`', () => {
  test('reads the text below the front matter into the field, and saves it there', async ({
    cms,
    page,
  }) => {
    await start(cms, { 'content/posts/old.md': '---\ntitle: Old\n---\n\nHello.\n' });
    await editBody(await openEntry(page, 'posts', 'Old', 'Hello.'));
    await expectFile(cms, 'content/posts/old.md', '---\ntitle: Old\n---\n\nEdited.\n');
  });

  test('saves a new entry with the field below the front matter', async ({ cms, page }) => {
    await start(cms);
    await createEntry(page, 'posts');
    await expectFile(cms, 'content/posts/night-sky.md', '---\ntitle: Night Sky\n---\n\nLook up.\n');
  });

  test('keeps a `body` property in the front matter like any other', async ({ cms, page }) => {
    await start(cms, {
      'content/posts/old.md': '---\ntitle: Old\nbody: Summary\n---\n\nHello.\n',
    });
    await editBody(await openEntry(page, 'posts', 'Old', 'Hello.'));
    await expectFile(
      cms,
      'content/posts/old.md',
      '---\ntitle: Old\nbody: Summary\n---\n\nEdited.\n',
    );
  });

  test('moves the field from the front matter below it', async ({ cms, page }) => {
    // The front matter takes precedence over the text below it, which is dropped
    await start(cms, {
      'content/posts/old.md': '---\ntitle: Old\ncontent: Hello.\n---\n\nIgnored.\n',
    });
    await editBody(await openEntry(page, 'posts', 'Old', 'Hello.'));
    await expectFile(cms, 'content/posts/old.md', '---\ntitle: Old\n---\n\nEdited.\n');
  });

  test('works with TOML front matter', async ({ cms, page }) => {
    await start(cms, { 'content/hugo/old.md': '+++\ntitle = "Old"\n+++\n\nHello.\n' });
    await editBody(await openEntry(page, 'hugo', 'Old', 'Hello.'));
    await expectFile(cms, 'content/hugo/old.md', '+++\ntitle = "Old"\n+++\n\nEdited.\n');
    await createEntry(page, 'hugo');
    await expectFile(
      cms,
      'content/hugo/night-sky.md',
      '+++\ntitle = "Night Sky"\n+++\n\nLook up.\n',
    );
  });
});

test.describe('`inline: true`', () => {
  test('reads and saves the body in the front matter', async ({ cms, page }) => {
    await start(cms, { 'content/notes/old.md': '---\ntitle: Old\nbody: Hello.\n---\n' });
    await editBody(await openEntry(page, 'notes', 'Old', 'Hello.'));
    await expectFile(cms, 'content/notes/old.md', '---\ntitle: Old\nbody: Edited.\n---\n');
  });

  test('saves a new entry with the body in the front matter', async ({ cms, page }) => {
    await start(cms);
    await createEntry(page, 'notes');
    await expectFile(
      cms,
      'content/notes/night-sky.md',
      '---\ntitle: Night Sky\nbody: Look up.\n---\n',
    );
  });

  test('drops the text below the front matter (known issue)', async ({ cms, page }) => {
    // The text below the front matter is neither shown nor kept, so a Save deletes it without a
    // warning. Once fixed, it should be kept below the front matter, or at least not be lost
    // silently
    await start(cms, {
      'content/notes/old.md': '---\ntitle: Old\nbody: Hello.\n---\n\nBelow.\n',
    });
    await editBody(await openEntry(page, 'notes', 'Old', 'Hello.'));
    await expectFile(cms, 'content/notes/old.md', '---\ntitle: Old\nbody: Edited.\n---\n');
  });
});

test.describe('file collection', () => {
  test('uses the option of a file over the collection’s', async ({ cms, page }) => {
    await start(cms, {
      'content/pages/about.md': '---\ntitle: About\n---\n\nHello.\n',
      'content/pages/contact.md': '---\ntitle: Contact\nbody: Write to us.\n---\n',
    });
    await editBody(await openEntry(page, 'pages', 'About', 'Hello.'));
    await expectFile(cms, 'content/pages/about.md', '---\ntitle: About\n---\n\nEdited.\n');

    // The other file uses the collection’s option
    await editBody(await openEntry(page, 'pages', 'Contact', 'Write to us.'));
    await expectFile(cms, 'content/pages/contact.md', '---\ntitle: Contact\nbody: Edited.\n---\n');
  });
});
