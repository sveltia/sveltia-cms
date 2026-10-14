import { expect, GITHUB_CONFIG, test } from '../fixtures/test.js';
import { openCollection } from '../fixtures/ui.js';

/**
 * @import { Locator, Page } from '@playwright/test';
 * @import { CMS } from '../fixtures/test.js';
 */

/**
 * Get the bulk editor table.
 * @param {Page} page Page.
 * @returns {Locator} Table.
 */
const getTable = (page) => page.getByRole('table', { name: 'Bulk Editor' });
/**
 * Get the name of a cell control, whose values are wrapped in bidi isolates.
 * @param {string} field Field label.
 * @param {string} entry Entry title.
 * @returns {RegExp} Accessible name.
 */
const cellName = (field, entry) => new RegExp(`^\\W?${field}\\W? of \\W?${entry}\\W?$`);

/**
 * Read the files in a folder of the repository.
 * @param {CMS} cms CMS.
 * @param {string} folder Folder path, ending with a slash.
 * @returns {Promise<Record<string, string>>} File content keyed by path.
 */
const readFolder = async (cms, folder) =>
  Object.fromEntries(
    Object.entries(await cms.readRepo()).filter(([path]) => path.startsWith(folder)),
  );

test.describe('multilingual posts', () => {
  /**
   * Posts in English and French, with a translatable title and a draft flag duplicated in every
   * locale. The body is a Text field, which can’t be edited in bulk.
   */
  const CONFIG = {
    backend: { name: 'test-repo' },
    media_folder: 'static/images',
    i18n: { structure: 'multiple_files', locales: ['en', 'fr'], default_locale: 'en' },
    collections: [
      {
        name: 'posts',
        label: 'Posts',
        label_singular: 'Post',
        folder: 'content/posts',
        extension: 'yml',
        create: true,
        i18n: true,
        bulk_edit: true,
        fields: [
          { name: 'title', label: 'Title', i18n: true },
          { name: 'draft', label: 'Draft', widget: 'boolean', i18n: 'duplicate' },
          { name: 'body', label: 'Body', widget: 'text', i18n: true },
        ],
      },
    ],
  };

  const FILES = {
    'content/posts/hello.en.yml': 'title: Hello\ndraft: false\nbody: Hi.\n',
    'content/posts/hello.fr.yml': 'title: Bonjour\ndraft: false\nbody: Salut.\n',
    'content/posts/world.en.yml': 'title: World\ndraft: true\nbody: Earth.\n',
    'content/posts/world.fr.yml': 'title: Monde\ndraft: true\nbody: Terre.\n',
    // The keys aren’t in the configured order, so a Save rewriting the files would reorder them
    'content/posts/third.en.yml': 'body: Three.\ndraft: false\ntitle: Third\n',
    'content/posts/third.fr.yml': 'body: Trois.\ndraft: false\ntitle: Troisième\n',
  };

  /** Files the edits below are expected to write. */
  const EDITED_FILES = {
    'content/posts/hello.en.yml': 'title: Hello Again\ndraft: true\nbody: Hi.\n',
    'content/posts/hello.fr.yml': 'title: Bonjour\ndraft: true\nbody: Salut.\n',
    'content/posts/world.en.yml': 'title: World\ndraft: false\nbody: Earth.\n',
    'content/posts/world.fr.yml': 'title: Monde\ndraft: false\nbody: Terre.\n',
  };

  /**
   * Edit the Hello and World posts in the bulk editor and save them.
   * @param {Page} page Page.
   */
  const editAndSave = async (page) => {
    await openCollection(page, 'Posts');
    await page.getByRole('button', { name: 'Edit Entries in Bulk' }).click();

    const table = getTable(page);

    await expect(table).toBeVisible();
    // The Text field isn’t a column
    await expect(table.getByRole('columnheader')).toHaveText(['Entry', 'Title', 'Draft']);
    await expect(table.getByRole('textbox', { name: cellName('Title', 'Hello') })).toHaveValue(
      'Hello',
    );

    await table.getByRole('textbox', { name: cellName('Title', 'Hello') }).fill('Hello Again');
    await table.getByRole('switch', { name: cellName('Draft', 'Hello') }).click();
    await table.getByRole('switch', { name: cellName('Draft', 'World') }).click();
    await expect(page.getByRole('status').filter({ hasText: /changes?$/ })).toHaveText('3 changes');
    await page.getByRole('button', { name: 'Save Bulk Edits' }).click();

    await expect(table).toBeHidden();
    await expect(page.getByRole('button', { name: 'Edit Entries in Bulk' })).toBeVisible();
  };

  test.describe('on the test repository', () => {
    test.use({ config: CONFIG });

    test('saves the edited fields of several entries in every locale', async ({ cms, page }) => {
      await cms.open();
      await cms.seed(FILES);
      await cms.signIn();
      await editAndSave(page);

      // The translatable title is only changed in English, the duplicated draft flag in both
      // locales, and the entry that wasn’t edited is left alone
      await expect
        .poll(() => readFolder(cms, 'content/posts/'))
        .toEqual({
          ...EDITED_FILES,
          'content/posts/third.en.yml': FILES['content/posts/third.en.yml'],
          'content/posts/third.fr.yml': FILES['content/posts/third.fr.yml'],
        });
    });
  });

  test.describe('on GitHub', () => {
    test.use({ config: { ...CONFIG, backend: GITHUB_CONFIG.backend } });

    test('saves the edits in a single commit', async ({ cms, github, page }) => {
      github.commit(FILES, { message: 'Add posts' });
      await cms.open();
      await editAndSave(page);

      await expect.poll(() => github.received.length).toBe(1);

      const [{ fileChanges }] = github.received;

      expect(
        fileChanges.additions.map((/** @type {{ path: string }} */ { path }) => path).sort(),
      ).toEqual(Object.keys(EDITED_FILES).sort());
      expect(fileChanges.deletions ?? []).toEqual([]);
      Object.entries(EDITED_FILES).forEach(([path, content]) => {
        expect(github.readFile(path)).toBe(content);
      });
      expect(github.readFile('content/posts/third.en.yml')).toBe(
        FILES['content/posts/third.en.yml'],
      );
    });
  });
});

test.describe('products with a unique position', () => {
  const CONFIG = {
    backend: { name: 'test-repo' },
    media_folder: 'static/uploads',
    collections: [
      {
        name: 'products',
        label: 'Products',
        label_singular: 'Product',
        folder: 'content/products',
        extension: 'yml',
        create: true,
        identifier_field: 'name',
        bulk_edit: { fields: ['position', 'name'] },
        fields: [
          { name: 'name', label: 'Name' },
          { name: 'sku', label: 'SKU' },
          { name: 'position', label: 'Position', widget: 'number', unique: true },
        ],
      },
    ],
  };

  const FILES = {
    'content/products/mug.yml': 'name: Mug\nsku: MUG-1\nposition: 1\n',
    'content/products/cup.yml': 'name: Cup\nsku: CUP-1\nposition: 2\n',
    'content/products/bowl.yml': 'name: Bowl\nsku: BOWL-1\nposition: 3\n',
  };

  test.use({ config: CONFIG });

  test.beforeEach(async ({ cms, page }) => {
    await cms.open();
    await cms.seed(FILES);
    await cms.signIn();
    await openCollection(page, 'Products');
    await page.getByRole('button', { name: 'Edit Entries in Bulk' }).click();
    // The columns follow the `fields` option
    await expect(getTable(page).getByRole('columnheader')).toHaveText([
      'Entry',
      'Position',
      'Name',
    ]);
  });

  test('refuses a duplicate value, and saves two entries swapping theirs', async ({
    cms,
    page,
  }) => {
    const table = getTable(page);
    const mugPosition = table.getByRole('spinbutton', { name: cellName('Position', 'Mug') });
    const mugRow = table.getByRole('row', { name: /^Mug / });

    await mugPosition.fill('2');
    await page.getByRole('button', { name: 'Save Bulk Edits' }).click();

    await expect(
      page.getByRole('alert').filter({ hasText: /Some of the values aren’t valid/ }),
    ).toBeVisible();
    await expect(mugRow.getByRole('alert')).toHaveText('This value is used for another entry.');
    await expect(table).toBeVisible();
    expect(await readFolder(cms, 'content/products/')).toEqual(FILES);

    // Giving the Cup the Mug’s position makes both values unique again
    await table.getByRole('spinbutton', { name: cellName('Position', 'Cup') }).fill('1');
    await page.getByRole('button', { name: 'Save Bulk Edits' }).click();

    await expect(table).toBeHidden();
    await expect
      .poll(() => readFolder(cms, 'content/products/'))
      .toEqual({
        'content/products/mug.yml': 'name: Mug\nsku: MUG-1\nposition: 2\n',
        'content/products/cup.yml': 'name: Cup\nsku: CUP-1\nposition: 1\n',
        'content/products/bowl.yml': FILES['content/products/bowl.yml'],
      });
  });

  test('discards the edits on Cancel after asking, leaving the files untouched', async ({
    cms,
    page,
  }) => {
    const table = getTable(page);

    await table.getByRole('textbox', { name: cellName('Name', 'Mug') }).fill('Big Mug');
    await table.getByRole('spinbutton', { name: cellName('Position', 'Bowl') }).fill('4');
    await expect(page.getByRole('status').filter({ hasText: /changes?$/ })).toHaveText('2 changes');
    await page.getByRole('button', { name: 'Cancel Bulk Edits' }).click();

    const dialog = page.getByRole('alertdialog', { name: 'Cancel Bulk Edits' });

    await expect(dialog).toContainText('Discard the changes made to the entries?');
    await dialog.getByRole('button', { name: 'Discard' }).click();

    await expect(table).toBeHidden();
    expect(await readFolder(cms, 'content/products/')).toEqual(FILES);

    // The edits are gone when the bulk editor is opened again
    await page.getByRole('button', { name: 'Edit Entries in Bulk' }).click();
    await expect(table.getByRole('textbox', { name: cellName('Name', 'Mug') })).toHaveValue('Mug');
    await expect(page.getByRole('button', { name: 'Save Bulk Edits' })).toBeDisabled();
  });
});

test.describe('team members stored in one file', () => {
  /**
   * Every entry is an object in the same JSON file, so the edits to several entries have to be
   * combined into one rewrite of that file.
   */
  const CONFIG = {
    backend: { name: 'test-repo' },
    media_folder: 'static/images',
    collections: [
      {
        name: 'team',
        label: 'Team',
        label_singular: 'Member',
        file: 'data/team.json',
        identifier_field: 'name',
        bulk_edit: true,
        fields: [
          { name: 'name', label: 'Name' },
          { name: 'active', label: 'Active', widget: 'boolean', required: false },
        ],
      },
    ],
  };

  const MEMBERS = [
    { name: 'Ada', active: true },
    { name: 'Bob', active: true },
    { name: 'Cy', active: false },
  ];

  test.use({ config: CONFIG });

  test('saves the edits to several entries in the same file', async ({ cms, page }) => {
    await cms.open();
    await cms.seed({ 'data/team.json': `${JSON.stringify(MEMBERS, null, 2)}\n` });
    await cms.signIn();
    await openCollection(page, 'Team');
    await page.getByRole('button', { name: 'Edit Entries in Bulk' }).click();

    const table = getTable(page);

    await table.getByRole('textbox', { name: cellName('Name', 'Ada') }).fill('Ada L.');
    await table.getByRole('switch', { name: cellName('Active', 'Bob') }).click();
    await table.getByRole('switch', { name: cellName('Active', 'Cy') }).click();
    await page.getByRole('button', { name: 'Save Bulk Edits' }).click();
    await expect(table).toBeHidden();

    await expect
      .poll(async () => JSON.parse((await cms.readRepo())['data/team.json']))
      .toEqual([
        { name: 'Ada L.', active: true },
        { name: 'Bob', active: false },
        { name: 'Cy', active: true },
      ]);
  });
});
