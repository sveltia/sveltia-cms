import { expect, test } from '../fixtures/test.js';

/**
 * @import { Locator, Page } from '@playwright/test';
 */

/**
 * Fields shared by every collection: a title, a list of tags and a body, which a front matter
 * format keeps below the front matter block.
 */
const FIELDS = [
  { name: 'title', label: 'Title' },
  { name: 'tags', label: 'Tags', widget: 'list', required: false },
  { name: 'body', label: 'Body', widget: 'text' },
];

/**
 * A collection in a format, with the given folder name.
 * @param {string} name Collection name, also the folder under `content/`.
 * @param {Record<string, any>} options Format options.
 * @returns {Record<string, any>} Collection.
 */
const collection = (name, options = {}) => ({
  name,
  label: name,
  folder: `content/${name}`,
  create: true,
  fields: FIELDS,
  ...options,
});

/**
 * Open the collection and start a new entry with a title, a tag and a body.
 * @param {Page} page Page.
 * @param {string} name Collection name.
 * @returns {Promise<Locator>} Content editor.
 */
const createEntry = async (page, name) => {
  await page.getByRole('treeitem', { name: new RegExp(`^${name}\\b`) }).click();
  await page.getByRole('button', { name: 'Create New Entry' }).first().click();

  const editor = page.getByRole('group', { name: 'Content Editor' });

  await editor.getByRole('textbox', { name: 'Title' }).fill('Night Sky');
  // A new simple list comes with an empty item
  await editor.getByRole('textbox', { name: 'Item Value' }).fill('stars');
  await editor.getByRole('textbox', { name: 'Body' }).fill('Look up.');

  return editor;
};

/**
 * Open an existing entry, change its body and save it.
 * @param {Page} page Page.
 * @param {string} collectionName Collection name.
 * @param {string} title Entry title.
 */
const editBody = async (page, collectionName, title) => {
  await page.getByRole('treeitem', { name: new RegExp(`^${collectionName}\\b`) }).click();
  await page.getByRole('row', { name: new RegExp(title) }).click();

  const editor = page.getByRole('group', { name: 'Content Editor' });

  await editor.getByRole('textbox', { name: 'Body' }).fill('Edited.');
  await editor.getByRole('button', { name: 'Save' }).click();
  await expect(editor).toBeHidden();
};

test.describe('front matter formats', () => {
  test.use({
    config: {
      backend: { name: 'test-repo' },
      media_folder: 'static/images',
      collections: [
        // A Markdown collection without a format reads YAML, TOML and JSON front matter alike
        collection('posts'),
        collection('notes', { extension: 'toml', format: 'toml' }),
        collection('hugo', { format: 'toml-frontmatter' }),
        collection('jsonfm', { format: 'json-frontmatter' }),
        collection('tilde', { format: 'yaml-frontmatter', frontmatter_delimiter: '~~~' }),
      ],
    },
  });

  test.beforeEach(async ({ cms }) => {
    await cms.open();
    await cms.seed({
      'content/posts/yaml-post.md': '---\ntitle: YAML Post\n---\n\nHello.\n',
      'content/posts/toml-post.md': '+++\ntitle = "TOML Post"\n+++\n\nHello.\n',
      'content/posts/json-post.md': '{\n  "title": "JSON Post"\n}\n\nHello.\n',
      'content/notes/old-note.toml':
        'title = "Old Note"\ntags = [ "moon" ]\nbody = "Hello."\nrating = 5\n',
    });
    await cms.signIn();
  });

  test('saves an existing entry in the front matter format it was read in', async ({
    cms,
    page,
  }) => {
    await editBody(page, 'posts', 'TOML Post');
    await editBody(page, 'posts', 'JSON Post');
    await editBody(page, 'posts', 'YAML Post');

    const files = await cms.readRepo();

    expect(files['content/posts/toml-post.md']).toBe(
      '+++\ntitle = "TOML Post"\ntags = []\n+++\n\nEdited.\n',
    );
    expect(files['content/posts/json-post.md']).toBe(
      '{\n  "title": "JSON Post",\n  "tags": []\n}\n\nEdited.\n',
    );
    expect(files['content/posts/yaml-post.md']).toBe(
      '---\ntitle: YAML Post\ntags: []\n---\n\nEdited.\n',
    );
  });

  test('saves a new entry of the same collection with YAML front matter', async ({ cms, page }) => {
    const editor = await createEntry(page, 'posts');

    await editor.getByRole('button', { name: 'Save' }).click();

    await expect
      .poll(async () => (await cms.readRepo())['content/posts/night-sky.md'])
      .toBe('---\ntitle: Night Sky\ntags:\n  - stars\n---\n\nLook up.\n');
  });

  test('saves a TOML file', async ({ cms, page }) => {
    const editor = await createEntry(page, 'notes');

    await editor.getByRole('button', { name: 'Save' }).click();

    // The body is a field like any other in a data file
    await expect
      .poll(async () => (await cms.readRepo())['content/notes/night-sky.toml'])
      .toBe('title = "Night Sky"\ntags = [ "stars" ]\nbody = "Look up."\n');
  });

  test('keeps the other keys of a TOML file', async ({ cms, page }) => {
    await editBody(page, 'notes', 'Old Note');

    expect((await cms.readRepo())['content/notes/old-note.toml']).toBe(
      'title = "Old Note"\ntags = [ "moon" ]\nbody = "Edited."\nrating = 5\n',
    );
  });

  test('saves TOML front matter between `+++` lines', async ({ cms, page }) => {
    const editor = await createEntry(page, 'hugo');

    await editor.getByRole('button', { name: 'Save' }).click();

    await expect
      .poll(async () => (await cms.readRepo())['content/hugo/night-sky.md'])
      .toBe('+++\ntitle = "Night Sky"\ntags = [ "stars" ]\n+++\n\nLook up.\n');
  });

  test('saves JSON front matter, whose braces are the delimiters', async ({ cms, page }) => {
    const editor = await createEntry(page, 'jsonfm');

    await editor.getByRole('button', { name: 'Save' }).click();

    await expect
      .poll(async () => (await cms.readRepo())['content/jsonfm/night-sky.md'])
      .toBe('{\n  "title": "Night Sky",\n  "tags": [\n    "stars"\n  ]\n}\n\nLook up.\n');
  });

  test('saves front matter between custom delimiters', async ({ cms, page }) => {
    const editor = await createEntry(page, 'tilde');

    await editor.getByRole('button', { name: 'Save' }).click();

    await expect
      .poll(async () => (await cms.readRepo())['content/tilde/night-sky.md'])
      .toBe('~~~\ntitle: Night Sky\ntags:\n  - stars\n~~~\n\nLook up.\n');
  });
});

test.describe('output options', () => {
  test.use({
    config: {
      backend: { name: 'test-repo' },
      media_folder: 'static/images',
      output: {
        yaml: { quote: 'double', indent_size: 4 },
        json: { indent_style: 'tab' },
      },
      collections: [
        collection('pages', { extension: 'yml' }),
        collection('data', { extension: 'json' }),
      ],
    },
  });

  test.beforeEach(async ({ cms }) => {
    await cms.open();
    await cms.signIn();
  });

  test('quotes and indents YAML as configured', async ({ cms, page }) => {
    const editor = await createEntry(page, 'pages');

    await editor.getByRole('button', { name: 'Save' }).click();

    await expect
      .poll(async () => (await cms.readRepo())['content/pages/night-sky.yml'])
      .toBe('title: "Night Sky"\ntags:\n    - "stars"\nbody: "Look up."\n');
  });

  test('indents JSON with tabs as configured', async ({ cms, page }) => {
    const editor = await createEntry(page, 'data');

    await editor.getByRole('button', { name: 'Save' }).click();

    await expect
      .poll(async () => (await cms.readRepo())['content/data/night-sky.json'])
      .toBe(
        '{\n\t"title": "Night Sky",\n\t"tags": [\n\t\t"stars"\n\t],\n\t"body": "Look up."\n}\n',
      );
  });
});
