import { createPNG } from '../../fixtures/files.js';
import { BASE_CONFIG, expect, test } from '../../fixtures/test.js';
import { getEditor, getEntryRows } from '../../fixtures/ui.js';

/**
 * Entries and collections sharing a folder: what one of them owns, and where each is listed.
 */

test.describe('with entry-relative media in a folder shared by the entries', () => {
  test.use({
    config: {
      ...BASE_CONFIG,
      collections: [
        {
          name: 'posts',
          label: 'Posts',
          folder: 'content/posts',
          create: true,
          media_folder: '',
          public_folder: '',
          fields: [
            { name: 'title', label: 'Title' },
            { name: 'image', label: 'Image', widget: 'image', required: false },
          ],
        },
      ],
    },
  });

  test.beforeEach(async ({ cms }) => {
    await cms.open();
    await cms.seed({
      'content/posts/a.md': '---\ntitle: Alpha\n---\n',
      'content/posts/b.md': '---\ntitle: Bravo\nimage: b.png\n---\n',
      'content/posts/b.png': createPNG({ color: [255, 0, 0] }),
      'content/posts/c.png': createPNG({ color: [0, 0, 255] }),
    });
    await cms.signIn();
  });

  test('deletes an entry without the images of the folder it shares', async ({ cms, page }) => {
    await page.getByRole('row', { name: /Alpha/ }).click();
    await page.getByRole('button', { name: 'Show Editor Options' }).click();
    await page.getByRole('menuitem', { name: 'Delete Entry' }).click();
    await page
      .getByRole('alertdialog', { name: 'Delete Entry' })
      .getByRole('button', { name: 'Delete' })
      .click();

    // Neither image belongs to the deleted entry: one is used by another entry, and the other could
    // be as well
    await expect
      .poll(async () => Object.keys(await cms.readRepo()).sort())
      .toEqual(['content/posts/b.md', 'content/posts/b.png', 'content/posts/c.png']);
  });
});

test.describe('with collections telling the entries of one folder apart', () => {
  const fields = [
    { name: 'title', label: 'Title' },
    { name: 'lang', label: 'Language' },
    { name: 'image', label: 'Image', widget: 'image', required: false },
  ];

  test.use({
    config: {
      ...BASE_CONFIG,
      collections: [
        {
          name: 'en',
          label: 'English',
          folder: 'content/posts',
          filter: { field: 'lang', value: 'en' },
          fields,
        },
        {
          name: 'fr',
          label: 'French',
          folder: 'content/posts',
          filter: { field: 'lang', value: 'fr' },
          fields,
        },
        { name: 'archive', label: 'Archive', folder: 'content/posts', hide: true, fields },
      ],
    },
  });

  test.beforeEach(async ({ cms }) => {
    await cms.open();
    await cms.seed({
      'content/posts/hello.md': '---\ntitle: Hello\nlang: en\nimage: /images/photo.png\n---\n',
      'content/posts/bonjour.md': '---\ntitle: Bonjour\nlang: fr\n---\n',
      'content/posts/hallo.md': '---\ntitle: Hallo\nlang: de\n---\n',
      'static/images/photo.png': createPNG({ color: [0, 128, 0] }),
    });
    await cms.signIn();
  });

  test('links an asset only to the collections listing the entry using it', async ({ page }) => {
    await page.getByRole('radio', { name: 'Assets' }).click();
    await page.getByRole('option', { name: /Global Assets/ }).click();
    await page.getByRole('row', { name: 'photo.png' }).click();

    // The public URL is a link too, so only the links to an entry are picked
    const entryLinks = page.getByRole('group', { name: 'Asset Info' }).getByRole('link', {
      name: /›/,
    });

    // The French collection filters the entry out, and the archive is hidden
    await expect(entryLinks).toHaveText(['English › Hello']);
    await entryLinks.click();
    await expect(getEditor(page).getByRole('textbox', { name: 'Title' })).toHaveValue('Hello');
  });

  test('leaves the hidden collection out of the search results', async ({ page }) => {
    // No collection label has the term in it, so only the titles match
    await page.getByRole('searchbox', { name: 'Search for contents…' }).fill('ll');

    const results = page.getByRole('main').getByRole('grid', { name: 'Entries' }).getByRole('row');

    // “Hallo” is only in the hidden archive, which can’t be opened
    await expect(results).toHaveText([/English.*Hello/]);
    await expect(results.first()).not.toContainText('Archive');
  });
});

test.describe('with collections creating entries in one folder', () => {
  /**
   * Create a collection listing the entries in one language.
   * @param {string} lang Language code, which the entries have in the `lang` field.
   * @param {string} label Collection label.
   * @returns {object} Collection definition.
   */
  const collection = (lang, label) => ({
    name: lang,
    label,
    folder: 'content/posts',
    create: true,
    filter: { field: 'lang', value: lang },
    fields: [
      { name: 'title', label: 'Title' },
      { name: 'lang', label: 'Language', widget: 'hidden', default: lang },
    ],
  });

  test.use({
    config: {
      ...BASE_CONFIG,
      collections: [collection('en', 'English'), collection('fr', 'French')],
    },
  });

  test.beforeEach(async ({ cms }) => {
    await cms.open();
    await cms.seed({ 'content/posts/hello.md': '---\ntitle: Hello\nlang: en\n---\n' });
    await cms.signIn();
  });

  test('names a new entry after another collection’s entry under a new name', async ({
    cms,
    page,
  }) => {
    await page
      .getByRole('tree', { name: 'Collection List' })
      .getByRole('treeitem', { name: 'French' })
      .click();
    // The empty entry list has a button of its own
    await page
      .getByRole('toolbar', { name: 'Collection' })
      .getByRole('button', { name: 'Create New Entry' })
      .click();

    const editor = getEditor(page);

    await editor.getByRole('textbox', { name: 'Title' }).fill('Hello');
    await editor.getByRole('button', { name: 'Save' }).click();

    await expect
      .poll(async () => (await cms.readRepo())['content/posts/hello-1.md'])
      .toBe('---\ntitle: Hello\nlang: fr\n---\n');
    // The English entry, which the French collection doesn’t list, is left alone
    expect((await cms.readRepo())['content/posts/hello.md']).toBe(
      '---\ntitle: Hello\nlang: en\n---\n',
    );
  });
});

test.describe('with a file collection’s file in an entry collection’s folder', () => {
  test.use({
    config: {
      ...BASE_CONFIG,
      collections: [
        {
          name: 'blog',
          label: 'Blog',
          folder: 'content/blog',
          create: true,
          fields: [{ name: 'title', label: 'Title' }],
        },
        {
          name: 'pages',
          label: 'Pages',
          files: [
            {
              name: 'blog-index',
              label: 'Blog Index',
              file: 'content/blog/_index.md',
              fields: [{ name: 'title', label: 'Title' }],
            },
          ],
        },
      ],
    },
  });

  test.beforeEach(async ({ cms }) => {
    await cms.open();
    await cms.seed({
      'content/blog/_index.md': '---\ntitle: All Posts\n---\n',
      'content/blog/first.md': '---\ntitle: First\n---\n',
    });
    await cms.signIn();
  });

  test('names a new entry after the file under a new name', async ({ cms, page }) => {
    await page.getByRole('button', { name: 'Create New Entry' }).click();

    const editor = getEditor(page);

    await editor.getByRole('textbox', { name: 'Title' }).fill('_index');
    await editor.getByRole('button', { name: 'Save' }).click();

    await expect
      .poll(async () => (await cms.readRepo())['content/blog/_index-1.md'])
      .toBe('---\ntitle: _index\n---\n');
    // The file collection’s file, which the entry collection doesn’t list, is left alone
    expect((await cms.readRepo())['content/blog/_index.md']).toBe('---\ntitle: All Posts\n---\n');
  });

  test('lists the file in the file collection only', async ({ page }) => {
    await expect(page).toHaveURL(/#\/collections\/blog$/);
    await expect(getEntryRows(page)).toHaveText([/First/]);

    await page
      .getByRole('tree', { name: 'Collection List' })
      .getByRole('treeitem', { name: 'Pages' })
      .click();
    await expect(page.getByRole('grid', { name: 'Files' }).getByRole('row')).toHaveText([
      /Blog Index/,
    ]);
  });
});
