import { expect, test } from '../fixtures/test.js';
import { getEditor, openEntry } from '../fixtures/ui.js';

/**
 * @import { Locator, Page } from '@playwright/test';
 */

/**
 * Fields of a page: a title and a KeyValue field of redirects, whose keys are host names and
 * version numbers holding dots.
 */
const FIELDS = [
  { name: 'title', label: 'Title' },
  {
    name: 'redirects',
    label: 'Redirects',
    widget: 'keyvalue',
    key_label: 'From',
    value_label: 'To',
    required: false,
  },
];

/**
 * A collection of pages in the given data format.
 * @param {string} extension File extension, also the collection name.
 * @returns {Record<string, any>} Collection.
 */
const collection = (extension) => ({
  name: extension,
  label: extension,
  folder: `content/${extension}`,
  extension,
  create: true,
  fields: FIELDS,
});

const CONFIG = {
  backend: { name: 'test-repo' },
  media_folder: 'static/images',
  collections: [
    collection('yml'),
    collection('toml'),
    collection('json'),
    {
      // A Markdown collection without a format reads YAML, TOML and JSON front matter alike
      name: 'posts',
      label: 'posts',
      folder: 'content/posts',
      create: true,
      fields: [
        { name: 'title', label: 'Title' },
        { name: 'date', label: 'Date', widget: 'datetime' },
        { name: 'body', label: 'Body', widget: 'text' },
      ],
    },
  ],
};

/**
 * Files holding keys with a dot: in a KeyValue field, at the top level and in an object that no
 * field configuration describes.
 */
const FILES = {
  'content/yml/home.yml': [
    'title: Home',
    'redirects:',
    '  example.com: /a',
    '  v1.2: /b',
    'meta:',
    '  og.image: cover.jpg',
    'og.title: Welcome',
    '',
  ].join('\n'),
  'content/toml/home.toml': [
    'title = "Home"',
    '"og.title" = "Welcome"',
    '',
    '[redirects]',
    '"example.com" = "/a"',
    '"v1.2" = "/b"',
    '',
    '[meta]',
    '"og.image" = "cover.jpg"',
    '',
  ].join('\n'),
  'content/json/home.json': [
    '{',
    '  "title": "Home",',
    '  "redirects": {',
    '    "example.com": "/a",',
    '    "v1.2": "/b"',
    '  },',
    '  "meta": {',
    '    "og.image": "cover.jpg"',
    '  },',
    '  "og.title": "Welcome"',
    '}',
    '',
  ].join('\n'),
};

test.use({ config: CONFIG });

test.describe('keys with a dot', () => {
  test.beforeEach(async ({ cms }) => {
    await cms.open();
    await cms.seed(FILES);
    await cms.signIn();
  });

  Object.entries(FILES).forEach(([path, file]) => {
    const extension = /** @type {string} */ (path.split('.').pop());

    test(`are kept as they are in a ${extension.toUpperCase()} file`, async ({ cms, page }) => {
      await openEntry(page, 'Home', { collection: extension, checkTitle: false });

      const editor = getEditor(page);

      // The editor shows the keys as they are
      await expect(editor.getByRole('textbox', { name: 'From' }).first()).toHaveValue(
        'example.com',
      );
      await expect(editor.getByRole('textbox', { name: 'From' }).nth(1)).toHaveValue('v1.2');

      await editor.getByRole('textbox', { name: 'Title' }).fill('Start');
      await editor.getByRole('button', { name: 'Save' }).click();

      await expect
        .poll(async () => (await cms.readRepo())[path])
        .toBe(file.replace('Home', 'Start'));
    });
  });

  test('are kept as they are when added in the editor', async ({ cms, page }) => {
    await openEntry(page, 'Home', { collection: 'yml', checkTitle: false });

    const editor = getEditor(page);
    const redirects = editor.getByRole('group', { name: /Redirects.*Field/ });

    await redirects.getByRole('button', { name: /Add/ }).click();
    await redirects.getByRole('textbox', { name: 'From' }).nth(2).fill('www.example.org');
    await redirects.getByRole('textbox', { name: 'To' }).nth(2).fill('/c');
    // Rename an existing key
    await redirects.getByRole('textbox', { name: 'From' }).nth(1).fill('v1.2.3');
    await editor.getByRole('button', { name: 'Save' }).click();

    await expect
      .poll(async () => (await cms.readRepo())['content/yml/home.yml'])
      .toBe(
        FILES['content/yml/home.yml'].replace('  v1.2: /b', '  v1.2.3: /b\n  www.example.org: /c'),
      );
  });
});

test.describe('YAML strings a YAML 1.1 parser misreads', () => {
  test('are quoted', async ({ cms, page }) => {
    await cms.open();
    await cms.signIn();
    await page.getByRole('treeitem', { name: /^yml\b/ }).click();
    await page.getByRole('button', { name: 'Create New Entry' }).first().click();

    const editor = getEditor(page);
    const redirects = editor.getByRole('group', { name: /Redirects.*Field/ });

    // Jekyll and go-yaml v2 would read `yes` and `no` as booleans and `1:20` as 80
    await editor.getByRole('textbox', { name: 'Title' }).fill('yes');
    await redirects.getByRole('textbox', { name: 'From' }).fill('no');
    await redirects.getByRole('textbox', { name: 'To' }).fill('1:20');
    await editor.getByRole('button', { name: 'Save' }).click();

    await expect
      .poll(async () => (await cms.readRepo())['content/yml/yes.yml'])
      .toBe("title: 'yes'\nredirects:\n  'no': '1:20'\n");
  });
});

test.describe('TOML front matter', () => {
  test('keeps a native date', async ({ cms, page }) => {
    const path = 'content/posts/dated.md';

    await cms.open();
    await cms.seed({
      [path]: '+++\ntitle = "Dated"\ndate = 2024-01-02T03:04:05.000Z\n+++\n\nHello.\n',
    });
    await cms.signIn();
    await openEntry(page, 'Dated', { collection: 'posts', checkTitle: false });

    const editor = getEditor(page);

    await editor.getByRole('textbox', { name: 'Body' }).fill('Edited.');
    await editor.getByRole('button', { name: 'Save' }).click();

    await expect
      .poll(async () => (await cms.readRepo())[path])
      .toBe('+++\ntitle = "Dated"\ndate = 2024-01-02T03:04:05.000Z\n+++\n\nEdited.\n');
  });

  test('keeps a date that is not a TOML date as a string', async ({ cms, page }) => {
    const path = 'content/posts/undated.md';

    await cms.open();
    await cms.seed({ [path]: '+++\ntitle = "Undated"\ndate = "TBD"\n+++\n\nHello.\n' });
    await cms.signIn();
    await openEntry(page, 'Undated', { collection: 'posts', checkTitle: false });

    const editor = getEditor(page);

    await editor.getByRole('textbox', { name: 'Body' }).fill('Edited.');
    await editor.getByRole('button', { name: 'Save' }).click();

    // The date was dropped
    await expect
      .poll(async () => (await cms.readRepo())[path])
      .toBe('+++\ntitle = "Undated"\ndate = "TBD"\n+++\n\nEdited.\n');
  });
});

test.describe('leading whitespace', () => {
  test('is kept in a text body', async ({ cms, page }) => {
    const path = 'content/posts/indented.md';

    const file =
      '---\ntitle: Indented\ndate: 2024-01-02T03:04:05.000Z\n---\n\n    const code = true;\n\nText.\n';

    await cms.open();
    await cms.seed({ [path]: file });
    await cms.signIn();
    await openEntry(page, 'Indented', { collection: 'posts', checkTitle: false });

    const editor = getEditor(page);

    await editor.getByRole('textbox', { name: 'Title' }).fill('Code');
    await editor.getByRole('button', { name: 'Save' }).click();

    // The indented code block became a paragraph
    await expect
      .poll(async () => (await cms.readRepo())[path])
      .toBe(file.replace('Indented', 'Code'));
  });
});

test.describe('keys that look like list indexes', () => {
  /**
   * Files holding objects whose keys look like list indexes: in a KeyValue field, and in objects
   * that no field configuration describes.
   */
  const NUMERIC_KEY_FILES = {
    'content/yml/stats.yml': [
      'title: Stats',
      'redirects:',
      "  '404': /not-found",
      'years:',
      "  '2023': a",
      "  '2024': b",
      'zero:',
      "  '0': x",
      "  '1': 'y'",
      '',
    ].join('\n'),
    'content/toml/stats.toml': [
      'title = "Stats"',
      '',
      '[redirects]',
      '404 = "/not-found"',
      '',
      '[years]',
      '2023 = "a"',
      '2024 = "b"',
      '',
    ].join('\n'),
    'content/json/stats.json': [
      '{',
      '  "title": "Stats",',
      '  "redirects": {',
      '    "404": "/not-found"',
      '  },',
      '  "years": {',
      '    "10": "a"',
      '  }',
      '}',
      '',
    ].join('\n'),
  };

  test.beforeEach(async ({ cms }) => {
    await cms.open();
    await cms.seed(NUMERIC_KEY_FILES);
    await cms.signIn();
  });

  Object.entries(NUMERIC_KEY_FILES).forEach(([path, file]) => {
    const extension = /** @type {string} */ (path.split('.').pop());

    test(`are kept as object keys in a ${extension.toUpperCase()} file`, async ({ cms, page }) => {
      await openEntry(page, 'Stats', { collection: extension, checkTitle: false });

      const editor = getEditor(page);

      await expect(editor.getByRole('textbox', { name: 'From' })).toHaveValue('404');
      await editor.getByRole('textbox', { name: 'Title' }).fill('Numbers');
      await editor.getByRole('button', { name: 'Save' }).click();

      // The objects were saved as sparse lists, e.g. 2,023 `null` items followed by `a` and `b`
      await expect
        .poll(async () => (await cms.readRepo())[path])
        .toBe(file.replace('Stats', 'Numbers'));
    });
  });
});

test.describe('integers a number can’t represent exactly', () => {
  const BIG_INTEGER_FILES = {
    'content/yml/big.yml': 'title: Big\nredirects: {}\nid: 12345678901234567890\n',
    'content/toml/big.toml': 'title = "Big"\nid = 9007199254740993\n\n[redirects]\n',
    'content/json/big.json':
      '{\n  "title": "Big",\n  "redirects": {},\n  "id": 12345678901234567890\n}\n',
  };

  test.beforeEach(async ({ cms }) => {
    await cms.open();
    await cms.seed(BIG_INTEGER_FILES);
    await cms.signIn();
  });

  Object.entries(BIG_INTEGER_FILES).forEach(([path, file]) => {
    const extension = /** @type {string} */ (path.split('.').pop());

    test(`are kept as they are in a ${extension.toUpperCase()} file`, async ({ cms, page }) => {
      await openEntry(page, 'Big', { collection: extension, checkTitle: false });

      const editor = getEditor(page);

      await editor.getByRole('textbox', { name: 'Title' }).fill('Large');
      await editor.getByRole('button', { name: 'Save' }).click();

      // The integer was rounded, e.g. to `12345678901234567000`, and the TOML file couldn’t be read
      await expect
        .poll(async () => (await cms.readRepo())[path])
        .toBe(file.replace('Big', 'Large'));
    });
  });
});

test.describe('names of `Object.prototype` members', () => {
  test.use({
    config: {
      backend: { name: 'test-repo' },
      media_folder: 'static/images',
      collections: [
        {
          name: 'notes',
          label: 'Notes',
          folder: 'content/notes',
          create: true,
          fields: [
            { name: 'title', label: 'Title' },
            { name: 'constructor', label: 'Constructor', required: false },
            { name: 'toString', label: 'To String', required: false },
          ],
        },
      ],
    },
  });

  test('work as field names in a new entry', async ({ cms, page }) => {
    await cms.open();
    await cms.signIn();
    await page.getByRole('treeitem', { name: /^Notes\b/ }).click();
    await page.getByRole('button', { name: 'Create New Entry' }).first().click();

    const editor = getEditor(page);

    await editor.getByRole('textbox', { name: 'Title' }).fill('New');
    await editor.getByRole('textbox', { name: 'Constructor' }).fill('Ada');
    await editor.getByRole('button', { name: 'Save' }).click();

    // The editor couldn’t be opened, as the default values couldn’t be filled in
    await expect
      .poll(async () => (await cms.readRepo())['content/notes/new.md'])
      .toBe("---\ntitle: New\nconstructor: Ada\ntoString: ''\n---\n");
  });

  test('work as field names and keys in an existing entry', async ({ cms, page }) => {
    const path = 'content/notes/old.md';

    await cms.open();
    // The fields are missing, and the file holds a key that no field configuration describes
    await cms.seed({ [path]: '---\ntitle: Old\nvalueOf: kept\n---\n' });
    await cms.signIn();
    await openEntry(page, 'Old', { collection: 'Notes', checkTitle: false });

    const editor = getEditor(page);

    await expect(editor.getByRole('textbox', { name: 'Constructor' })).toHaveValue('');
    await editor.getByRole('textbox', { name: 'Title' }).fill('Older');
    await editor.getByRole('button', { name: 'Save' }).click();

    // The fields held the source of `Object` and `Object.prototype.toString`, and the Save failed
    // as the `toString` key was looked up as a comment
    await expect
      .poll(async () => (await cms.readRepo())[path])
      .toBe("---\ntitle: Older\nconstructor: ''\ntoString: ''\nvalueOf: kept\n---\n");
  });
});
