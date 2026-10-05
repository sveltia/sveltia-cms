import { expect, GITHUB_CONFIG, test } from '../../fixtures/test.js';

/**
 * @import { Locator, Page } from '@playwright/test';
 */

/**
 * A UUID in the standard 36-character form.
 */
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}';
/**
 * A UUID encoded with Base32, as the `use_b32_encoding` option saves it.
 */
const B32 = '[0-9a-z]{26}';

/**
 * A collection of notes in YAML files named after their title, with the given fields.
 * @param {Record<string, any>[]} fields Fields after the title.
 * @returns {Record<string, any>} Collection.
 */
const notes = (fields) => ({
  name: 'notes',
  label: 'Notes',
  label_singular: 'Note',
  folder: 'content/notes',
  extension: 'yml',
  create: true,
  slug: '{{title}}',
  fields: [{ name: 'title', label: 'Title' }, ...fields],
});

/**
 * Get a config with the notes collection, using the `test-repo` backend.
 * @param {Record<string, any>[]} fields Fields after the title.
 * @returns {Record<string, any>} Config.
 */
const config = (fields) => ({
  backend: { name: 'test-repo' },
  media_folder: 'static/uploads',
  collections: [notes(fields)],
});

/**
 * Start a new note with the given title.
 * @param {Page} page Page.
 * @param {string} title Title.
 * @returns {Promise<Locator>} Content editor.
 */
const createNote = async (page, title) => {
  await page.getByRole('button', { name: 'Create New Entry' }).first().click();

  const editor = page.getByRole('group', { name: 'Content Editor' });

  await editor.getByRole('textbox', { name: 'Title' }).fill(title);

  return editor;
};

/**
 * Open an existing note by its title.
 * @param {Page} page Page.
 * @param {string} title Title.
 * @returns {Promise<Locator>} Content editor.
 */
const openNote = async (page, title) => {
  await page.getByRole('row', { name: new RegExp(title) }).click();

  const editor = page.getByRole('group', { name: 'Content Editor' });

  await expect(editor.getByRole('textbox', { name: 'Title' })).toHaveValue(title);

  return editor;
};

/**
 * Duplicate the entry open in the editor.
 * @param {any} cms `cms` fixture.
 * @param {Page} page Page.
 */
const duplicate = async (cms, page) => {
  await cms.chooseMenuItem(
    page.getByRole('button', { name: 'Show Editor Options' }),
    page.getByRole('menuitem', { name: 'Duplicate Entry' }),
  );
  await expect(page.getByRole('status').filter({ hasText: 'Entry duplicated' })).toBeVisible();
};

/**
 * Match a whole file, given as lines of regular expression source.
 * @param {string[]} lines Lines.
 * @returns {RegExp} Regular expression.
 */
const file = (lines) => new RegExp(`^${[...lines, ''].join('\\n')}$`);

test.describe('UUID field', () => {
  test.use({
    config: config([
      { name: 'id', label: 'ID', widget: 'uuid' },
      { name: 'ref', label: 'Reference', widget: 'uuid', prefix: 'note-', use_b32_encoding: true },
      // The deprecated option and the common one both unlock the field
      { name: 'handle', label: 'Handle', widget: 'uuid', read_only: false },
      { name: 'code', label: 'Code', widget: 'uuid', prefix: 'c-', readonly: false },
    ]),
  });

  test.beforeEach(async ({ cms }) => {
    await cms.open();
    await cms.seed({
      'content/notes/saved.yml': [
        'title: Saved',
        'id: 11111111-1111-4111-8111-111111111111',
        'ref: note-abcdefghijklmnopqrstuvwxyz',
        'handle: my-handle',
        'code: c-0001',
        '',
      ].join('\n'),
      // The UUID fields were added to the config after this note was saved
      'content/notes/older.yml': 'title: Older\n',
    });
    await cms.signIn();
  });

  test('generates a value for a new entry, which can only be edited when unlocked', async ({
    cms,
    page,
  }) => {
    const editor = await createNote(page, 'Fresh');
    const id = editor.getByRole('textbox', { name: 'ID' });
    const ref = editor.getByRole('textbox', { name: 'Reference' });
    const handle = editor.getByRole('textbox', { name: 'Handle' });
    const code = editor.getByRole('textbox', { name: 'Code' });

    await expect(id).toHaveValue(new RegExp(`^${UUID}$`));
    await expect(ref).toHaveValue(new RegExp(`^note-${B32}$`));
    await expect(handle).toHaveValue(new RegExp(`^${UUID}$`));
    await expect(code).toHaveValue(new RegExp(`^c-${UUID}$`));
    await expect(id).toHaveAttribute('aria-readonly', 'true');
    await expect(ref).toHaveAttribute('aria-readonly', 'true');
    await expect(handle).not.toHaveAttribute('aria-readonly', 'true');
    await expect(code).not.toHaveAttribute('aria-readonly', 'true');

    const idValue = await id.inputValue();
    const refValue = await ref.inputValue();

    await handle.fill('fresh-handle');
    await editor.getByRole('button', { name: 'Save' }).click();

    await expect
      .poll(async () => (await cms.readRepo())['content/notes/fresh.yml'])
      .toMatch(
        file([
          'title: Fresh',
          `id: ${idValue}`,
          `ref: ${refValue}`,
          'handle: fresh-handle',
          `code: c-${UUID}`,
        ]),
      );
  });

  test('keeps the values of an existing entry', async ({ cms, page }) => {
    const editor = await openNote(page, 'Saved');

    await expect(editor.getByRole('textbox', { name: 'ID' })).toHaveValue(
      '11111111-1111-4111-8111-111111111111',
    );
    await expect(editor.getByRole('textbox', { name: 'Reference' })).toHaveValue(
      'note-abcdefghijklmnopqrstuvwxyz',
    );
    await editor.getByRole('textbox', { name: 'Title' }).fill('Saved!');
    await editor.getByRole('button', { name: 'Save' }).click();

    await expect
      .poll(async () => (await cms.readRepo())['content/notes/saved.yml'])
      .toBe(
        [
          'title: Saved!',
          'id: 11111111-1111-4111-8111-111111111111',
          'ref: note-abcdefghijklmnopqrstuvwxyz',
          'handle: my-handle',
          'code: c-0001',
          '',
        ].join('\n'),
      );
  });

  test('fills in the values an existing entry lacks', async ({ cms, page }) => {
    const editor = await openNote(page, 'Older');

    await expect(editor.getByRole('textbox', { name: 'ID' })).toHaveValue(new RegExp(`^${UUID}$`));
    await editor.getByRole('textbox', { name: 'Title' }).fill('Older!');
    await editor.getByRole('button', { name: 'Save' }).click();

    await expect
      .poll(async () => (await cms.readRepo())['content/notes/older.yml'])
      .toMatch(
        file([
          'title: Older!',
          `id: ${UUID}`,
          `ref: note-${B32}`,
          `handle: ${UUID}`,
          `code: c-${UUID}`,
        ]),
      );
  });

  test('generates new values for a duplicate', async ({ cms, page }) => {
    const editor = await openNote(page, 'Saved');

    await duplicate(cms, page);
    await expect(editor.getByRole('textbox', { name: 'ID' })).toHaveValue(new RegExp(`^${UUID}$`));
    await expect(editor.getByRole('textbox', { name: 'Reference' })).toHaveValue(
      new RegExp(`^note-${B32}$`),
    );
    await editor.getByRole('textbox', { name: 'Title' }).fill('Copy');
    await editor.getByRole('button', { name: 'Save' }).click();

    // Even the values that were edited by hand are replaced, as they have to be unique
    await expect
      .poll(async () => (await cms.readRepo())['content/notes/copy.yml'])
      .toMatch(
        file([
          'title: Copy',
          `id: (?!11111111)${UUID}`,
          `ref: note-(?!abcdefghijklmnopqrstuvwxyz)${B32}`,
          `handle: ${UUID}`,
          `code: c-${UUID}`,
        ]),
      );
    // The original is left alone
    expect((await cms.readRepo())['content/notes/saved.yml']).toContain('handle: my-handle\n');
  });
});

test.describe('Hidden field', () => {
  const SAVED = 'content/notes/saved.yml';

  /**
   * Get the lines a new note gets from the defaults, as regular expression source.
   * @param {string} created Expected value of the `{{datetime}}` tag.
   * @returns {string[]} Lines.
   */
  const getDefaults = (created) => [
    `created: ${created}`,
    `key: ${UUID}`,
    'short: n-[0-9a-f]{12}',
    // A value of digits only would be quoted to stay a string
    "shorter: '?[0-9a-f]{8}'?",
    'author: MONA LISA <mona@example.com> @mona',
    'tags:',
    '  - news',
    '  - draft',
    'featured: false',
    'priority: 3',
    'kind: note',
  ];

  // The author tags need a signed-in user, which the GitHub mock has
  test.use({
    config: {
      ...GITHUB_CONFIG,
      collections: [
        notes([
          { name: 'created', widget: 'hidden', default: '{{datetime}}' },
          { name: 'key', widget: 'hidden', default: '{{uuid}}' },
          { name: 'short', widget: 'hidden', default: 'n-{{uuid_short}}' },
          { name: 'shorter', widget: 'hidden', default: '{{uuid_shorter}}' },
          {
            name: 'author',
            widget: 'hidden',
            default: '{{author-name | upper}} <{{author-email}}> @{{author-login}}',
          },
          { name: 'tags', widget: 'hidden', default: ['news', 'draft'] },
          { name: 'featured', widget: 'hidden', default: false },
          { name: 'priority', widget: 'hidden', default: 3 },
          { name: 'kind', widget: 'hidden', default: 'note' },
        ]),
      ],
    },
  });

  test.beforeEach(async ({ cms, github, page }) => {
    await page.clock.install({ time: new Date('2026-09-28T12:34:56.789Z') });
    github.commit({
      [SAVED]: [
        'title: Saved',
        'created: 2020-01-01T00:00:00.000Z',
        'key: 11111111-1111-4111-8111-111111111111',
        'short: n-aaaaaaaaaaaa',
        'shorter: bbbbbbbb',
        'author: Someone Else',
        'tags:',
        '  - old',
        'featured: true',
        'priority: 1',
        'kind: memo',
        '',
      ].join('\n'),
      // The hidden fields were added to the config after this note was saved
      'content/notes/older.yml': 'title: Older\n',
    });
    await cms.open();
  });

  test('fills in the template tags for a new entry, without showing the fields', async ({
    github,
    page,
  }) => {
    const editor = await createNote(page, 'Fresh');

    await expect(editor.getByRole('textbox')).toHaveCount(1);
    await editor.getByRole('button', { name: 'Save' }).click();

    // `{{datetime}}` leaves out the seconds
    await expect
      .poll(() => github.readFile('content/notes/fresh.yml'))
      .toMatch(file(['title: Fresh', ...getDefaults('2026-09-28T12:34:00.000Z')]));
  });

  test('keeps the values of an existing entry', async ({ github, page }) => {
    const editor = await openNote(page, 'Saved');

    await editor.getByRole('textbox', { name: 'Title' }).fill('Saved!');
    await editor.getByRole('button', { name: 'Save' }).click();

    // The list stays where it is, although its items have no field of their own
    await expect
      .poll(() => github.readFile(SAVED))
      .toBe(
        [
          'title: Saved!',
          'created: 2020-01-01T00:00:00.000Z',
          'key: 11111111-1111-4111-8111-111111111111',
          'short: n-aaaaaaaaaaaa',
          'shorter: bbbbbbbb',
          'author: Someone Else',
          'tags:',
          '  - old',
          'featured: true',
          'priority: 1',
          'kind: memo',
          '',
        ].join('\n'),
      );
  });

  test('fills in the values an existing entry lacks', async ({ github, page }) => {
    const editor = await openNote(page, 'Older');

    await editor.getByRole('textbox', { name: 'Title' }).fill('Older!');
    await editor.getByRole('button', { name: 'Save' }).click();

    await expect
      .poll(() => github.readFile('content/notes/older.yml'))
      .toMatch(file(['title: Older!', ...getDefaults('2026-09-28T12:34:00.000Z')]));
  });

  test('fills in the defaults again for a duplicate', async ({ cms, github, page }) => {
    const editor = await openNote(page, 'Saved');

    await page.clock.setSystemTime(new Date('2026-10-01T08:00:00Z'));
    await duplicate(cms, page);
    await editor.getByRole('textbox', { name: 'Title' }).fill('Copy');
    await editor.getByRole('button', { name: 'Save' }).click();

    // Even the list and the static values are reset, and the UUIDs are new
    await expect
      .poll(() => github.readFile('content/notes/copy.yml'))
      .toMatch(file(['title: Copy', ...getDefaults('2026-10-01T08:00:00.000Z')]));
    expect(await github.readFile('content/notes/copy.yml')).not.toMatch(
      /11111111-1111|n-aaaaaaaaaaaa|bbbbbbbb/,
    );
  });
});

test.describe('Hidden field with the locale tag', () => {
  test.use({ config: config([{ name: 'lang', widget: 'hidden', default: '{{locale}}' }]) });

  test.beforeEach(async ({ cms }) => {
    await cms.open();
    await cms.signIn();
  });

  test('writes the internal locale key without i18n (known issue)', async ({ cms, page }) => {
    const editor = await createNote(page, 'Fresh');

    await editor.getByRole('button', { name: 'Save' }).click();

    // The tag is replaced with `_default`, the key the CMS uses internally for the content of a
    // site without i18n, which means nothing to the site. Once fixed, expect an empty value, or
    // whatever the tag is decided to stand for without i18n
    await expect
      .poll(async () => (await cms.readRepo())['content/notes/fresh.yml'])
      .toBe('title: Fresh\nlang: _default\n');
  });
});

test.describe('Compute field', () => {
  const SAVED = 'content/notes/saved.yml';

  test.use({
    config: config([
      { name: 'first', label: 'First Name' },
      { name: 'last', label: 'Last Name' },
      {
        name: 'full',
        label: 'Full Name',
        widget: 'compute',
        value: '{{fields.first}} {{fields.last}}',
      },
      { name: 'shout', label: 'Shout', widget: 'compute', value: '{{fields.title | upper}}!' },
      {
        name: 'permalink',
        label: 'Permalink',
        widget: 'compute',
        value: '/notes/{{fields.title | slugify}}-{{uuid_short}}',
      },
      {
        name: 'steps',
        label: 'Steps',
        label_singular: 'Step',
        widget: 'list',
        required: false,
        fields: [
          { name: 'text', label: 'Text' },
          { name: 'position', label: 'Position', widget: 'compute', value: '{{index}}' },
          {
            name: 'caption',
            label: 'Caption',
            widget: 'compute',
            value: 'Step {{index}} of {{fields.title}}',
          },
        ],
      },
    ]),
  });

  test.beforeEach(async ({ cms }) => {
    await cms.open();
    await cms.seed({
      [SAVED]: [
        'title: Saved',
        'first: Ada',
        'last: Lovelace',
        'full: Old Value',
        'shout: OLD!',
        'permalink: /notes/old-0123456789ab',
        'steps:',
        '  - text: One',
        '  - text: Two',
        '',
      ].join('\n'),
    });
    await cms.signIn();
  });

  test('computes the values from the other fields as they change', async ({ cms, page }) => {
    const editor = await createNote(page, 'Hello World');
    const preview = editor.getByRole('document', { name: 'Content Preview' });

    // The fields are hidden in the editor, and shown in the preview
    await expect(editor.getByRole('textbox', { name: 'Full Name' })).toHaveCount(0);
    await editor.getByRole('textbox', { name: 'First Name' }).fill('Mona');
    await editor.getByRole('textbox', { name: 'Last Name' }).fill('Lisa');
    await expect(preview.getByText('Mona Lisa')).toBeVisible();
    await expect(preview.getByText('HELLO WORLD!')).toBeVisible();
    await editor.getByRole('textbox', { name: 'Last Name' }).fill('Lisa II');
    await expect(preview.getByText('Mona Lisa II')).toBeVisible();

    const steps = editor.getByRole('group', { name: /Steps.*Field/ });

    await steps.getByRole('button', { name: /Add.*Step/ }).click();
    await steps.getByRole('textbox', { name: 'Text' }).last().fill('One');
    await steps.getByRole('button', { name: /Add.*Step/ }).click();
    await steps.getByRole('textbox', { name: 'Text' }).last().fill('Two');
    await editor.getByRole('button', { name: 'Save' }).click();

    await expect
      .poll(async () => (await cms.readRepo())['content/notes/hello-world.yml'])
      .toMatch(
        file([
          'title: Hello World',
          'first: Mona',
          'last: Lisa II',
          'full: Mona Lisa II',
          'shout: HELLO WORLD!',
          'permalink: /notes/hello-world-[0-9a-f]{12}',
          'steps:',
          '  - text: One',
          '    position: 0',
          '    caption: Step 0 of Hello World',
          '  - text: Two',
          '    position: 1',
          '    caption: Step 1 of Hello World',
        ]),
      );
  });

  test('computes the values of an existing entry again, keeping the UUID', async ({
    cms,
    page,
  }) => {
    const editor = await openNote(page, 'Saved');

    await editor.getByRole('textbox', { name: 'Title' }).fill('Saved Again');

    const steps = editor.getByRole('group', { name: /Steps.*Field/ });

    // The positions follow the items as they’re removed
    await steps.getByRole('button', { name: 'Remove' }).first().click();
    await editor.getByRole('button', { name: 'Save' }).click();

    await expect
      .poll(async () => (await cms.readRepo())[SAVED])
      .toBe(
        [
          'title: Saved Again',
          'first: Ada',
          'last: Lovelace',
          'full: Ada Lovelace',
          'shout: SAVED AGAIN!',
          'permalink: /notes/saved-again-0123456789ab',
          'steps:',
          '  - text: Two',
          '    position: 0',
          '    caption: Step 0 of Saved Again',
          '',
        ].join('\n'),
      );
  });

  test('generates a new UUID for a duplicate', async ({ cms, page }) => {
    const editor = await openNote(page, 'Saved');

    await duplicate(cms, page);
    await editor.getByRole('textbox', { name: 'Title' }).fill('Copy');
    await editor.getByRole('button', { name: 'Save' }).click();

    await expect
      .poll(async () => (await cms.readRepo())['content/notes/copy.yml'])
      .toMatch(/^permalink: \/notes\/copy-(?!0123456789ab)[0-9a-f]{12}$/m);
  });
});

test.describe('Code field', () => {
  const SAVED = 'content/notes/saved.yml';

  test.use({
    config: config([
      { name: 'snippet', label: 'Snippet', widget: 'code', default_language: 'js' },
      {
        name: 'style',
        label: 'Style',
        widget: 'code',
        default_language: 'css',
        output_code_only: true,
      },
      {
        name: 'script',
        label: 'Script',
        widget: 'code',
        default_language: 'python',
        keys: { code: 'source', lang: 'language' },
      },
      {
        name: 'markup',
        label: 'Markup',
        widget: 'code',
        default_language: 'html',
        allow_language_selection: false,
      },
    ]),
  });

  test.beforeEach(async ({ cms }) => {
    await cms.open();
    await cms.seed({
      [SAVED]: [
        'title: Saved',
        'snippet:',
        '  code: puts 1',
        '  lang: ruby',
        'style: "p { margin: 0; }"',
        'script:',
        '  source: SELECT 1;',
        '  language: sql',
        'markup:',
        '  code: <p>Hi</p>',
        '  lang: html',
        '',
      ].join('\n'),
    });
    await cms.signIn();
  });

  /**
   * Get the language selector of a Code field.
   * @param {Locator} editor Content editor.
   * @param {string} label Field label.
   * @returns {Locator} Combobox.
   */
  const getLanguage = (editor, label) =>
    editor
      .getByRole('group', { name: new RegExp(label) })
      .getByRole('combobox', { name: 'Language' });

  test('selects the default language, saving the code with the language chosen', async ({
    cms,
    page,
  }) => {
    const editor = await createNote(page, 'Fresh');

    await expect(getLanguage(editor, 'Snippet')).toHaveText('JavaScript');
    await expect(getLanguage(editor, 'Style')).toHaveText('CSS');
    await expect(getLanguage(editor, 'Script')).toHaveText('Python');
    await expect(getLanguage(editor, 'Markup')).toHaveCount(0);

    await editor.getByRole('textbox', { name: 'Snippet' }).click();
    await page.keyboard.type('let x = 1;');
    await editor.getByRole('textbox', { name: 'Style' }).click();
    await page.keyboard.type('a { color: red; }');
    await editor.getByRole('textbox', { name: 'Script' }).click();
    await page.keyboard.type('print(1)');
    // Choosing a language gives the code the focus back
    await cms.chooseMenuItem(
      getLanguage(editor, 'Script'),
      page.getByRole('option', { name: 'Ruby', exact: true }),
    );
    await expect(editor.getByRole('textbox', { name: 'Script' })).toBeFocused();
    // Moving on right away, while the highlighter for the language may still be loading, which
    // leaves the focus where the user moved it
    await editor.getByRole('textbox', { name: 'Markup' }).click();
    await page.keyboard.type('<b>Hi</b>');
    await expect(getLanguage(editor, 'Script')).toHaveText('Ruby');
    await expect(editor.getByRole('textbox', { name: 'Markup' })).toBeFocused();
    // Saved right after typing: the code editor passes on what was typed 100 ms later, which the
    // Save waits for
    await page.keyboard.press('ControlOrMeta+s');

    await expect
      .poll(async () => (await cms.readRepo())['content/notes/fresh.yml'])
      .toBe(
        [
          'title: Fresh',
          'snippet:',
          '  code: let x = 1;',
          '  lang: js',
          "style: 'a { color: red; }'",
          'script:',
          '  source: print(1)',
          '  language: ruby',
          'markup:',
          '  code: <b>Hi</b>',
          '  lang: html',
          '',
        ].join('\n'),
      );
  });

  test('shows the code and language of an existing entry, keeping them', async ({ cms, page }) => {
    const editor = await openNote(page, 'Saved');

    await expect(editor.getByRole('textbox', { name: 'Snippet' })).toHaveText('puts 1');
    await expect(getLanguage(editor, 'Snippet')).toHaveText('Ruby');
    await expect(editor.getByRole('textbox', { name: 'Style' })).toHaveText('p { margin: 0; }');
    await expect(getLanguage(editor, 'Style')).toHaveText('CSS');
    await expect(editor.getByRole('textbox', { name: 'Script' })).toHaveText('SELECT 1;');
    await expect(getLanguage(editor, 'Script')).toHaveText('SQL');
    await editor.getByRole('textbox', { name: 'Title' }).fill('Saved!');
    await editor.getByRole('button', { name: 'Save' }).click();

    await expect
      .poll(async () => (await cms.readRepo())[SAVED])
      .toBe(
        [
          'title: Saved!',
          'snippet:',
          '  code: puts 1',
          '  lang: ruby',
          "style: 'p { margin: 0; }'",
          'script:',
          '  source: SELECT 1;',
          '  language: sql',
          'markup:',
          '  code: <p>Hi</p>',
          '  lang: html',
          '',
        ].join('\n'),
      );
  });
});
