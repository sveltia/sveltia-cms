import { expect, test } from '../../fixtures/test.js';
import { openEntry } from '../../fixtures/ui.js';

/**
 * @import { Locator, Page } from '@playwright/test';
 * @import { CMS } from '../../fixtures/test.js';
 */

/**
 * Fields shared by the collections: a title and a body.
 */
const FIELDS = [
  { name: 'title', label: 'Title' },
  { name: 'body', label: 'Body', widget: 'text' },
];

/**
 * A collection of the blog, with the given name and options. Its folder is `content/{name}`.
 * @param {string} name Collection name.
 * @param {Record<string, any>} [options] More collection options.
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
 * A blog whose collections each handle the URL aliases of a renamed entry in their own way: by
 * default, with a `preview_path` holding a field value as well as the slug, under a custom
 * `aliases_field` name, turned off, without a `preview_path`, and with a field of the same name.
 */
const CONFIG = {
  backend: { name: 'test-repo' },
  media_folder: 'static/images',
  collections: [
    collection('posts', { preview_path: 'blog/{{slug}}' }),
    collection('news', {
      preview_path: '{{fields.category}}/{{slug}}',
      fields: [
        ...FIELDS,
        { name: 'category', label: 'Category', widget: 'select', options: ['local', 'world'] },
      ],
    }),
    collection('notes', { preview_path: 'notes/{{slug}}', aliases_field: 'redirect_from' }),
    collection('drafts', { preview_path: 'drafts/{{slug}}', aliases_field: false }),
    collection('pages'),
    collection('docs', {
      preview_path: 'docs/{{slug}}',
      fields: [...FIELDS, { name: 'aliases', label: 'Aliases', widget: 'list', required: false }],
    }),
  ],
};

test.use({ config: CONFIG });

/**
 * Open the CMS, seed the repository with the given files and sign in.
 * @param {CMS} cms CMS fixture.
 * @param {Record<string, string>} files Files to seed.
 */
const start = async (cms, files) => {
  await cms.open();
  await cms.seed(files);
  await cms.signIn();
};

/**
 * Give the entry open in the editor another slug in the Slug panel.
 * @param {CMS} cms CMS fixture.
 * @param {Page} page Page.
 * @param {string} slug New slug.
 */
const editSlug = async (cms, page, slug) => {
  await cms.chooseMenuItem(
    page.getByRole('button', { name: 'Show Editor Options' }),
    page.getByRole('menuitem', { name: 'Edit Slug' }),
  );

  const panel = page.getByRole('group', { name: 'Slug', exact: true });

  await panel.getByRole('button', { name: 'Edit Slug' }).click();
  await panel.getByRole('textbox', { name: 'Slug' }).fill(slug);
  await panel.getByRole('textbox', { name: 'Slug' }).press('Enter');
  await expect(panel.getByText(slug, { exact: true })).toBeVisible();
};

/**
 * Save the entry open in the editor, which takes us back to the entry list.
 * @param {Locator} editor Content editor.
 */
const save = async (editor) => {
  await editor.getByRole('button', { name: 'Save' }).click();
  await expect(editor).toBeHidden();
};

/**
 * Rename an entry: open it, give it another slug and save it.
 * @param {CMS} cms CMS fixture.
 * @param {Page} page Page.
 * @param {string} collectionName Collection name.
 * @param {string} title Entry title.
 * @param {string} slug New slug.
 */
const rename = async (cms, page, collectionName, title, slug) => {
  const editor = await openEntry(page, title, { collection: collectionName, exact: true });

  await editSlug(cms, page, slug);
  await save(editor);
};

/**
 * Wait for a file to be written with the given content, and check that the old one is gone.
 * @param {CMS} cms CMS fixture.
 * @param {string} path Path of the file to wait for.
 * @param {string} content Expected content.
 * @param {string} [oldPath] Path of the file that should be gone.
 */
const expectFile = async (cms, path, content, oldPath) => {
  await expect.poll(async () => (await cms.readRepo())[path]).toBe(content);

  if (oldPath) {
    expect(await cms.readRepo()).not.toHaveProperty(oldPath);
  }
};

test.describe('default `aliases` property', () => {
  test('adds the previous path of a renamed entry to a new `aliases` list', async ({
    cms,
    page,
  }) => {
    await start(cms, { 'content/posts/hello.md': '---\ntitle: Hello\n---\n\nHi.\n' });
    await rename(cms, page, 'posts', 'Hello', 'hello-world');

    // The list goes to the top, with a site-relative path
    await expectFile(
      cms,
      'content/posts/hello-world.md',
      '---\naliases:\n  - /blog/hello\ntitle: Hello\n---\n\nHi.\n',
      'content/posts/hello.md',
    );
  });

  test('appends each previous path, and drops the alias of the path the entry goes back to', async ({
    cms,
    page,
  }) => {
    await start(cms, { 'content/posts/hello.md': '---\ntitle: Hello\n---\n\nHi.\n' });
    await rename(cms, page, 'posts', 'Hello', 'hello-world');
    await expectFile(
      cms,
      'content/posts/hello-world.md',
      '---\naliases:\n  - /blog/hello\ntitle: Hello\n---\n\nHi.\n',
    );
    await rename(cms, page, 'posts', 'Hello', 'greetings');
    await expectFile(
      cms,
      'content/posts/greetings.md',
      '---\naliases:\n  - /blog/hello\n  - /blog/hello-world\ntitle: Hello\n---\n\nHi.\n',
      'content/posts/hello-world.md',
    );

    // An alias pointing at the entry’s own path would conflict with it on the site
    await rename(cms, page, 'posts', 'Hello', 'hello');
    await expectFile(
      cms,
      'content/posts/hello.md',
      '---\naliases:\n  - /blog/hello-world\n  - /blog/greetings\ntitle: Hello\n---\n\nHi.\n',
      'content/posts/greetings.md',
    );
  });

  test('moves an alias already listed to the end rather than adding it again', async ({
    cms,
    page,
  }) => {
    await start(cms, {
      'content/posts/hello.md':
        '---\ntitle: Hello\naliases:\n  - /blog/hello\n  - /old/hello\n---\n\nHi.\n',
    });
    await rename(cms, page, 'posts', 'Hello', 'hello-world');
    await expectFile(
      cms,
      'content/posts/hello-world.md',
      '---\naliases:\n  - /old/hello\n  - /blog/hello\ntitle: Hello\n---\n\nHi.\n',
      'content/posts/hello.md',
    );
  });

  test('leaves an `aliases` property that isn’t a list alone', async ({ cms, page }) => {
    await start(cms, {
      'content/posts/hello.md': '---\ntitle: Hello\naliases: /old/hello\n---\n\nHi.\n',
    });
    await rename(cms, page, 'posts', 'Hello', 'hello-world');
    await expectFile(
      cms,
      'content/posts/hello-world.md',
      '---\naliases: /old/hello\ntitle: Hello\n---\n\nHi.\n',
      'content/posts/hello.md',
    );
  });

  test('adds no alias to a new entry, or to an entry saved under the same slug', async ({
    cms,
    page,
  }) => {
    await start(cms, {
      'content/posts/hello.md': '---\naliases:\n  - /old/hello\ntitle: Hello\n---\n\nHi.\n',
    });

    const editor = await openEntry(page, 'Hello', { collection: 'posts', exact: true });

    await editor.getByRole('textbox', { name: 'Body' }).fill('Edited.');
    await save(editor);
    await expectFile(
      cms,
      'content/posts/hello.md',
      '---\naliases:\n  - /old/hello\ntitle: Hello\n---\n\nEdited.\n',
    );

    await page.getByRole('button', { name: 'Create New Entry' }).first().click();
    await editor.getByRole('textbox', { name: 'Title', exact: true }).fill('Fresh');
    await editor.getByRole('textbox', { name: 'Body' }).fill('New.');
    await save(editor);
    await expectFile(cms, 'content/posts/fresh.md', '---\ntitle: Fresh\n---\n\nNew.\n');
  });

  test('leaves the aliases out of a duplicate', async ({ cms, page }) => {
    await start(cms, {
      'content/posts/hello.md': '---\naliases:\n  - /old/hello\ntitle: Hello\n---\n\nHi.\n',
    });

    const editor = await openEntry(page, 'Hello', { collection: 'posts', exact: true });

    await cms.chooseMenuItem(
      page.getByRole('button', { name: 'Show Editor Options' }),
      page.getByRole('menuitem', { name: 'Duplicate Entry' }),
    );
    await expect(page.getByRole('status').filter({ hasText: 'Entry duplicated' })).toBeVisible();
    await save(editor);

    // An alias can only redirect to one page
    await expectFile(cms, 'content/posts/hello-1.md', '---\ntitle: Hello\n---\n\nHi.\n');
    expect((await cms.readRepo())['content/posts/hello.md']).toBe(
      '---\naliases:\n  - /old/hello\ntitle: Hello\n---\n\nHi.\n',
    );
  });

  test('fills the previous path with the field values the entry had before the Save', async ({
    cms,
    page,
  }) => {
    await start(cms, {
      'content/news/flood.md': '---\ntitle: Flood\ncategory: local\n---\n\nRain.\n',
    });

    const editor = await openEntry(page, 'Flood', { collection: 'news', exact: true });

    await editor.getByRole('radio', { name: 'world' }).click();
    await editSlug(cms, page, 'great-flood');
    await save(editor);
    await expectFile(
      cms,
      'content/news/great-flood.md',
      '---\naliases:\n  - /local/flood\ntitle: Flood\ncategory: world\n---\n\nRain.\n',
      'content/news/flood.md',
    );
  });

  test('adds no alias when only a field value changes the path', async ({ cms, page }) => {
    await start(cms, {
      'content/news/flood.md': '---\ntitle: Flood\ncategory: local\n---\n\nRain.\n',
    });

    const editor = await openEntry(page, 'Flood', { collection: 'news', exact: true });

    // The aliases follow a change of slug only
    await editor.getByRole('radio', { name: 'world' }).click();
    await save(editor);
    await expectFile(
      cms,
      'content/news/flood.md',
      '---\ntitle: Flood\ncategory: world\n---\n\nRain.\n',
    );
  });
});

test.describe('other `aliases_field` options', () => {
  test.beforeEach(async ({ cms }) => {
    await start(cms, {
      'content/notes/hello.md': '---\ntitle: Hello\n---\n\nHi.\n',
      'content/drafts/hello.md': '---\ntitle: Hello\n---\n\nHi.\n',
      'content/pages/hello.md': '---\ntitle: Hello\n---\n\nHi.\n',
      'content/docs/hello.md': '---\ntitle: Hello\naliases:\n  - /old/hello\n---\n\nHi.\n',
    });
  });

  test('stores the aliases under a custom property name', async ({ cms, page }) => {
    await rename(cms, page, 'notes', 'Hello', 'hello-world');
    await expectFile(
      cms,
      'content/notes/hello-world.md',
      '---\nredirect_from:\n  - /notes/hello\ntitle: Hello\n---\n\nHi.\n',
      'content/notes/hello.md',
    );
  });

  test('adds no alias with `aliases_field: false`', async ({ cms, page }) => {
    await rename(cms, page, 'drafts', 'Hello', 'hello-world');
    await expectFile(
      cms,
      'content/drafts/hello-world.md',
      '---\ntitle: Hello\n---\n\nHi.\n',
      'content/drafts/hello.md',
    );
  });

  test('adds no alias without a `preview_path`', async ({ cms, page }) => {
    await rename(cms, page, 'pages', 'Hello', 'hello-world');
    await expectFile(
      cms,
      'content/pages/hello-world.md',
      '---\ntitle: Hello\n---\n\nHi.\n',
      'content/pages/hello.md',
    );
  });

  test('leaves a configured `aliases` field to the editor', async ({ cms, page }) => {
    await rename(cms, page, 'docs', 'Hello', 'hello-world');
    // The field keeps its place among the configured fields
    await expectFile(
      cms,
      'content/docs/hello-world.md',
      '---\ntitle: Hello\naliases:\n  - /old/hello\n---\n\nHi.\n',
      'content/docs/hello.md',
    );
  });
});
