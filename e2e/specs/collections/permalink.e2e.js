import { test } from '../../fixtures/test.js';
import { expectFile, getEditor, openCollection, openEntry, saveEntry } from '../../fixtures/ui.js';

/**
 * @import { Page } from '@playwright/test';
 * @import { CMS } from '../../fixtures/test.js';
 */

/**
 * A collection with a title, whose folder is `content/{name}`.
 * @param {string} name Collection name.
 * @param {Record<string, any>} [options] More collection options.
 * @returns {Record<string, any>} Collection.
 */
const collection = (name, options = {}) => ({
  name,
  label: name,
  folder: `content/${name}`,
  create: true,
  preview_path: `${name}/{{slug}}/index.html`,
  fields: [{ name: 'title', label: 'Title' }],
  ...options,
});

/**
 * A site whose collections each handle the permalink in their own way: under the default name,
 * under a custom name, not at all, and with a field of the same name.
 */
const CONFIG = {
  backend: { name: 'test-repo' },
  media_folder: 'static/images',
  collections: [
    collection('portfolio', { permalink_field: true }),
    collection('notes', { permalink_field: 'url_path' }),
    collection('posts'),
    collection('docs', {
      permalink_field: true,
      fields: [
        { name: 'title', label: 'Title' },
        { name: 'permalink', widget: 'hidden', default: 'custom/' },
      ],
    }),
  ],
};

test.use({ config: CONFIG });

/**
 * Create an entry in the given collection.
 * @param {Page} page Page.
 * @param {string} collectionName Collection name.
 * @param {string} title Entry title.
 */
const createEntry = async (page, collectionName, title) => {
  await openCollection(page, collectionName);
  await page.getByRole('button', { name: 'Create New Entry' }).first().click();

  const editor = getEditor(page);

  await editor.getByRole('textbox', { name: 'Title', exact: true }).fill(title);
  await saveEntry(editor);
};

/**
 * Open an entry, change its title and save it.
 * @param {Page} page Page.
 * @param {string} collectionName Collection name.
 * @param {string} title Entry title.
 * @param {string} newTitle New entry title.
 */
const retitle = async (page, collectionName, title, newTitle) => {
  const editor = await openEntry(page, title, { collection: collectionName, exact: true });

  await editor.getByRole('textbox', { name: 'Title', exact: true }).fill(newTitle);
  await saveEntry(editor);
};

test('stores the path of a new entry at the top of the front matter', async ({ cms, page }) => {
  await cms.start();
  await createEntry(page, 'portfolio', 'Hello World');
  await expectFile(
    cms,
    'content/portfolio/hello-world.md',
    '---\npermalink: /portfolio/hello-world/index.html\ntitle: Hello World\n---\n',
  );
});

test('stores the path of an existing entry, replacing an earlier one', async ({ cms, page }) => {
  await cms.start({
    'content/portfolio/hello.md': '---\npermalink: old/index.html\ntitle: Hello\n---\n',
  });
  await retitle(page, 'portfolio', 'Hello', 'Hello again');
  await expectFile(
    cms,
    'content/portfolio/hello.md',
    '---\npermalink: /portfolio/hello/index.html\ntitle: Hello again\n---\n',
  );
});

test('leaves `permalink: false` alone', async ({ cms, page }) => {
  await cms.start({
    'content/portfolio/hello.md': '---\npermalink: false\ntitle: Hello\n---\n',
  });
  await retitle(page, 'portfolio', 'Hello', 'Hello again');
  await expectFile(
    cms,
    'content/portfolio/hello.md',
    '---\npermalink: false\ntitle: Hello again\n---\n',
  );
});

test('uses a custom property name', async ({ cms, page }) => {
  await cms.start();
  await createEntry(page, 'notes', 'Hello');
  await expectFile(
    cms,
    'content/notes/hello.md',
    '---\nurl_path: /notes/hello/index.html\ntitle: Hello\n---\n',
  );
});

test('stores nothing without the option', async ({ cms, page }) => {
  await cms.start();
  await createEntry(page, 'posts', 'Hello');
  await expectFile(cms, 'content/posts/hello.md', '---\ntitle: Hello\n---\n');
});

test('leaves a configured field of the same name to the editor', async ({ cms, page }) => {
  await cms.start();
  await createEntry(page, 'docs', 'Hello');
  await expectFile(cms, 'content/docs/hello.md', '---\ntitle: Hello\npermalink: custom/\n---\n');
});
