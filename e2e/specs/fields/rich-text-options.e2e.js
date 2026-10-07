import { selectText } from '../../fixtures/rich-text.js';
import { expect, test } from '../../fixtures/test.js';

/**
 * @import { Locator, Page } from '@playwright/test';
 * @import { CMS } from '../../fixtures/test.js';
 */

const NOTE_PATH = 'content/notes/note.md';

/**
 * Build a config with a Notes collection whose body is a rich text field with the given options.
 * @param {Record<string, any>} options Options of the body field.
 * @param {Record<string, any>} [rootOptions] Options at the root of the config, e.g.
 * `field_defaults`.
 * @returns {Record<string, any>} Config.
 */
const noteConfig = (options, rootOptions = {}) => ({
  backend: { name: 'test-repo' },
  media_folder: 'static/uploads',
  public_folder: '/uploads',
  ...rootOptions,
  collections: [
    {
      name: 'notes',
      label: 'Notes',
      label_singular: 'Note',
      folder: 'content/notes',
      create: true,
      fields: [
        { name: 'title', label: 'Title' },
        { name: 'body', label: 'Body', widget: 'richtext', ...options },
      ],
    },
  ],
});

/**
 * Build the file of a note with the given body, as the CMS writes it.
 * @param {string} body Markdown body.
 * @returns {string} File content.
 */
const noteFile = (body) => `---\ntitle: Note\n---\n\n${body}\n`;

/**
 * Seed a note with the given body, sign in and open it in the editor.
 * @param {object} args Arguments.
 * @param {CMS} args.cms CMS.
 * @param {Page} args.page Page.
 * @param {string} args.body Markdown body of the note.
 * @returns {Promise<{ editor: Locator, field: Locator, body: Locator }>} The editor, the body
 * field and its text box, which is the rich text editor or the Markdown source editor.
 */
const openNote = async ({ cms, page, body }) => {
  await cms.open();
  await cms.seed({ [NOTE_PATH]: noteFile(body) });
  await cms.signIn();
  await page.getByRole('row', { name: /Note/ }).click();

  const editor = page.getByRole('group', { name: 'Content Editor' });
  const field = editor.getByRole('group', { name: /Body.*Field/ });

  // The first one, as an image in the body, once rendered, has a Title field too
  await expect(editor.getByRole('textbox', { name: 'Title' }).first()).toHaveValue('Note');

  return { editor, field, body: field.getByRole('textbox', { name: 'Body' }) };
};

/**
 * Move the caret to the end of a rich text editor. The End key doesn’t do that on macOS, so set the
 * selection directly, which the editor picks up.
 * @param {Locator} textbox Editor.
 */
const moveCaretToEnd = async (textbox) => {
  await textbox.evaluate((element) => {
    /** @type {HTMLElement} */ (element).focus();
    window.getSelection()?.selectAllChildren(element);
    window.getSelection()?.collapseToEnd();
  });
};

/**
 * Save the entry and wait for the note file to have been written with the given body.
 * @param {object} args Arguments.
 * @param {CMS} args.cms CMS.
 * @param {Locator} args.editor Content editor.
 * @param {string} args.body Markdown body expected in the file.
 */
const saveAndExpect = async ({ cms, editor, body }) => {
  await editor.getByRole('button', { name: 'Save' }).click();
  await expect.poll(async () => (await cms.readRepo())[NOTE_PATH]).toBe(noteFile(body));
};

test.describe('modes', () => {
  test.describe('default', () => {
    test.use({ config: noteConfig({}) });

    test('opens in rich text, with a toggle to edit the Markdown', async ({ cms, page }) => {
      const { field, body } = await openNote({ cms, page, body: '## Hello' });

      await expect(body.getByRole('heading', { name: 'Hello' })).toBeVisible();
      await expect(field.getByRole('button', { name: 'Edit in Markdown' })).toHaveAttribute(
        'aria-pressed',
        'false',
      );
    });
  });

  test.describe('rich text only', () => {
    test.use({ config: noteConfig({ modes: ['rich_text'] }) });

    test('offers no Markdown editor', async ({ cms, page }) => {
      const { field, body } = await openNote({ cms, page, body: '## Hello' });

      await expect(body.getByRole('heading', { name: 'Hello' })).toBeVisible();
      await expect(field.getByRole('button', { name: 'Bold' })).toBeVisible();
      await expect(field.getByRole('button', { name: 'Edit in Markdown' })).toHaveCount(0);
    });
  });

  test.describe('Markdown only', () => {
    test.use({ config: noteConfig({ widget: 'markdown', modes: ['raw'] }) });

    test('edits the Markdown source, with the toolbar inserting Markdown', async ({
      cms,
      page,
    }) => {
      const { editor, field, body } = await openNote({ cms, page, body: '## Hello' });

      // A single text box, holding the source, and no toggle
      await expect(body).toHaveCount(1);
      await expect(body).toHaveValue('## Hello');
      await expect(field.getByRole('button', { name: 'Edit in Markdown' })).toHaveCount(0);

      await body.fill('## Hello\n\nWorld\n\n');
      // The image component inserts its Markdown at the caret, to be filled in
      await body.evaluate((/** @type {HTMLTextAreaElement} */ textarea) => {
        textarea.setSelectionRange(textarea.value.length, textarea.value.length);
      });
      await field.getByRole('button', { name: 'Image', exact: true }).click();
      await expect(body).toHaveValue('## Hello\n\nWorld\n\n![]()');
      await body.fill('## Hello\n\nWorld\n\n![Dome](/uploads/dome.png)');

      await saveAndExpect({ cms, editor, body: '## Hello\n\nWorld\n\n![Dome](/uploads/dome.png)' });
    });
  });

  test.describe('Markdown first', () => {
    test.use({ config: noteConfig({ modes: ['raw', 'rich_text'] }) });

    test('opens in the Markdown editor, which can be switched to rich text', async ({
      cms,
      page,
    }) => {
      const { field, body } = await openNote({ cms, page, body: '## Hello' });
      const toggle = field.getByRole('button', { name: 'Edit in Markdown' });

      await expect(toggle).toHaveAttribute('aria-pressed', 'true');
      await expect(body).toHaveValue('## Hello');

      await toggle.click();
      await expect(toggle).toHaveAttribute('aria-pressed', 'false');
      await expect(body.getByRole('heading', { name: 'Hello' })).toBeVisible();
    });
  });
});

test.describe('buttons', () => {
  test.describe('inline formatting only', () => {
    test.use({
      config: noteConfig({ buttons: ['bold', 'link'], editor_components: ['image'] }),
    });

    test('shows only the listed buttons, which format the text', async ({ cms, page }) => {
      const { editor, field, body } = await openNote({ cms, page, body: 'The dome opens.' });

      await expect(field.getByRole('button', { name: 'Bold' })).toBeVisible();
      await expect(field.getByRole('button', { name: 'Link' })).toBeVisible();
      await expect(field.getByRole('button', { name: 'Italic' })).toHaveCount(0);
      await expect(field.getByRole('button', { name: 'Strikethrough' })).toHaveCount(0);
      await expect(field.getByRole('button', { name: 'Code', exact: true })).toHaveCount(0);
      // Without a block type to choose, there’s no text style menu
      await expect(field.getByRole('button', { name: 'Show Text Style Options' })).toHaveCount(0);

      await selectText(body, 'dome');
      await field.getByRole('button', { name: 'Bold' }).click();
      await expect(body.locator('strong')).toHaveText('dome');

      await saveAndExpect({ cms, editor, body: 'The **dome** opens.' });
    });
  });

  test.describe('block types only', () => {
    test.use({
      config: noteConfig({ buttons: ['heading-two', 'quote'], editor_components: [] }),
    });

    test('offers only the listed block types, which change the block', async ({ cms, page }) => {
      const { editor, field, body } = await openNote({ cms, page, body: 'The dome opens.' });
      const menuButton = field.getByRole('button', { name: 'Show Text Style Options' });

      await expect(field.getByRole('button', { name: 'Bold' })).toHaveCount(0);
      await expect(field.getByRole('button', { name: 'Link' })).toHaveCount(0);

      await body.getByText('The dome opens.').click();
      await cms.openPopup(menuButton, page.getByRole('menu', { name: 'Text Style Options' }));
      await expect(
        page.getByRole('menu', { name: 'Text Style Options' }).getByRole('menuitemcheckbox'),
      ).toHaveText([/Paragraph/, /Heading 2/, /Block Quote/]);
      await page.getByRole('menuitemcheckbox', { name: 'Block Quote' }).click();
      await expect(body.locator('blockquote')).toHaveText('The dome opens.');

      await saveAndExpect({ cms, editor, body: '> The dome opens.' });
    });
  });
});

test.describe('editor components', () => {
  /**
   * Open the text style menu of a field, which lists the block types it offers.
   * @param {CMS} cms CMS.
   * @param {Page} page Page.
   * @param {Locator} field Field.
   * @returns {Promise<Locator>} Menu.
   */
  const openBlockTypes = async (cms, page, field) => {
    const menu = page.getByRole('menu', { name: 'Text Style Options' });

    await cms.openPopup(field.getByRole('button', { name: 'Show Text Style Options' }), menu);

    return menu;
  };

  test.describe('default', () => {
    test.use({ config: noteConfig({}) });

    test('offers the image and the code block', async ({ cms, page }) => {
      const { field } = await openNote({ cms, page, body: 'The dome opens.' });

      await expect(field.getByRole('button', { name: 'Image', exact: true })).toBeVisible();

      const menu = await openBlockTypes(cms, page, field);

      await expect(menu.getByRole('menuitemcheckbox', { name: 'Code Block' })).toBeVisible();
    });
  });

  test.describe('image only', () => {
    test.use({ config: noteConfig({ editor_components: ['image'] }) });

    test('offers the image but not the code block', async ({ cms, page }) => {
      const { field } = await openNote({ cms, page, body: 'The dome opens.' });

      await expect(field.getByRole('button', { name: 'Image', exact: true })).toBeVisible();

      const menu = await openBlockTypes(cms, page, field);

      await expect(menu.getByRole('menuitemcheckbox', { name: 'Heading 2' })).toBeVisible();
      await expect(menu.getByRole('menuitemcheckbox', { name: 'Code Block' })).toHaveCount(0);
    });
  });

  test.describe('code block only', () => {
    test.use({ config: noteConfig({ editor_components: ['code-block'] }) });

    test('offers the code block but not the image', async ({ cms, page }) => {
      const { editor, field, body } = await openNote({ cms, page, body: 'const x = 1;' });

      await expect(field.getByRole('button', { name: 'Image', exact: true })).toHaveCount(0);

      await body.getByText('const x = 1;').click();
      await cms.chooseMenuItem(
        field.getByRole('button', { name: 'Show Text Style Options' }),
        page.getByRole('menuitemcheckbox', { name: 'Code Block' }),
      );
      await expect(field.getByRole('combobox', { name: 'Language' })).toBeVisible();
      await expect(body.locator('code')).toHaveText('const x = 1;');

      await editor.getByRole('button', { name: 'Save' }).click();
      await expect
        .poll(async () => (await cms.readRepo())[NOTE_PATH])
        .toMatch(/\n```\w*\nconst x = 1;\n```\n$/);
    });
  });

  test.describe('none', () => {
    test.use({ config: noteConfig({ editor_components: [] }) });

    test('offers no component', async ({ cms, page }) => {
      const { field } = await openNote({ cms, page, body: 'The dome opens.' });

      await expect(field.getByRole('button', { name: 'Bold' })).toBeVisible();
      await expect(field.getByRole('button', { name: 'Image', exact: true })).toHaveCount(0);
      await expect(field.getByRole('button', { name: 'Insert' })).toHaveCount(0);

      const menu = await openBlockTypes(cms, page, field);

      await expect(menu.getByRole('menuitemcheckbox', { name: 'Heading 2' })).toBeVisible();
      await expect(menu.getByRole('menuitemcheckbox', { name: 'Code Block' })).toHaveCount(0);
    });
  });
});

test.describe('linked images', () => {
  test.describe('default', () => {
    test.use({ config: noteConfig({}) });

    test('edits the link of an image, which is saved around it', async ({ cms, page }) => {
      const { editor, field } = await openNote({
        cms,
        page,
        body: '[![Dome](/uploads/dome.png)](https://example.com/dome)',
      });

      const component = field.getByRole('group', { name: 'Image', exact: true });
      const link = component.getByRole('textbox', { name: 'Link' });

      await expect(component.getByRole('textbox', { name: 'Alt Text' })).toHaveValue('Dome');
      await expect(link).toHaveValue('https://example.com/dome');
      await link.fill('https://example.com/night');

      await saveAndExpect({
        cms,
        editor,
        body: '[![Dome](/uploads/dome.png)](https://example.com/night)',
      });
    });
  });

  test.describe('turned off', () => {
    test.use({ config: noteConfig({ linked_images: false }) });

    test('offers no link for an image', async ({ cms, page }) => {
      const { editor, field } = await openNote({
        cms,
        page,
        body: '![Dome](/uploads/dome.png)',
      });

      const component = field.getByRole('group', { name: 'Image', exact: true });
      const alt = component.getByRole('textbox', { name: 'Alt Text' });

      await expect(alt).toHaveValue('Dome');
      await expect(component.getByRole('textbox', { name: 'Link' })).toHaveCount(0);
      await alt.fill('The dome');

      await saveAndExpect({ cms, editor, body: '![The dome](/uploads/dome.png)' });
    });
  });
});

test.describe('minimal', () => {
  const LONG_BODY = Array.from({ length: 30 }, (_, index) => `Paragraph ${index + 1}.`).join(
    '\n\n',
  );

  test.describe('default', () => {
    test.use({ config: noteConfig({}) });

    test('grows the editor with its content', async ({ cms, page }) => {
      const { body } = await openNote({ cms, page, body: LONG_BODY });

      await expect(body).toContainText('Paragraph 30.');
      expect((await body.boundingBox())?.height).toBeGreaterThan(240);
    });
  });

  test.describe('turned on', () => {
    test.use({ config: noteConfig({ minimal: true }) });

    test('limits the editor height, scrolling the content', async ({ cms, page }) => {
      const { body } = await openNote({ cms, page, body: LONG_BODY });

      await expect(body).toContainText('Paragraph 30.');
      expect((await body.boundingBox())?.height).toBeLessThanOrEqual(240);
      expect(await body.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(
        true,
      );
    });
  });
});

test.describe('Markdown shortcuts', () => {
  test.describe('default', () => {
    test.use({ config: noteConfig({}) });

    test('turns a Markdown prefix into a heading', async ({ cms, page }) => {
      const { editor, body } = await openNote({ cms, page, body: 'The dome opens.' });

      await moveCaretToEnd(body);
      await page.keyboard.press('Enter');
      await page.keyboard.type('## Hours');
      await expect(body.getByRole('heading', { name: 'Hours' })).toBeVisible();

      await saveAndExpect({ cms, editor, body: 'The dome opens.\n\n## Hours' });
    });
  });

  test.describe('turned off', () => {
    test.use({ config: noteConfig({ use_markdown_shortcuts: false }) });

    test('keeps a Markdown prefix as text, saving it escaped', async ({ cms, page }) => {
      const { editor, body } = await openNote({ cms, page, body: 'The dome opens.' });

      await moveCaretToEnd(body);
      await page.keyboard.press('Enter');
      await page.keyboard.type('## Hours');
      await expect(body.locator('p').last()).toHaveText('## Hours');
      await expect(body.getByRole('heading')).toHaveCount(0);

      // Escaped, so the paragraph isn’t read back as a heading the next time the entry is opened
      await saveAndExpect({ cms, editor, body: 'The dome opens.\n\n\\## Hours' });
    });
  });
});

test.describe('escaped Markdown syntax', () => {
  test.use({ config: noteConfig({}) });

  test('keeps escaped block syntax as text when another paragraph changes', async ({
    cms,
    page,
  }) => {
    const { editor, body } = await openNote({
      cms,
      page,
      body: '\\## Hours\n\n1\\. Daily\n\nThe dome opens.',
    });

    await expect(body.getByRole('heading')).toHaveCount(0);
    await expect(body.getByRole('list')).toHaveCount(0);
    await expect(body.locator('p').first()).toHaveText('## Hours');

    await moveCaretToEnd(body);
    await page.keyboard.type(' Weather permitting.');

    // The escapes are written back, or the entry would get a heading and a list
    await saveAndExpect({
      cms,
      editor,
      body: '\\## Hours\n\n1\\. Daily\n\nThe dome opens. Weather permitting.',
    });
  });
});

test.describe('emoji autocomplete', () => {
  test.describe('default', () => {
    test.use({ config: noteConfig({}) });

    test('suggests emojis for a word after a colon', async ({ cms, page }) => {
      const { editor, body } = await openNote({ cms, page, body: 'The dome opens' });
      const suggestions = page.getByRole('listbox', { name: 'Emoji Suggestions' });

      await moveCaretToEnd(body);
      await page.keyboard.type(' :tada');
      await expect(suggestions.getByRole('option').first()).toBeVisible();
      await page.keyboard.press('Enter');
      await expect(suggestions).toBeHidden();

      await saveAndExpect({ cms, editor, body: 'The dome opens 🎉' });
    });
  });

  test.describe('turned off', () => {
    test.use({ config: noteConfig({ use_emoji_autocomplete: false }) });

    test('suggests nothing', async ({ cms, page }) => {
      const { editor, body } = await openNote({ cms, page, body: 'The dome opens' });

      await moveCaretToEnd(body);
      await page.keyboard.type(' :tada');
      await expect(body).toContainText('The dome opens :tada');
      await page.keyboard.press('Enter');
      await page.keyboard.type('Next');
      await expect(page.getByRole('listbox', { name: 'Emoji Suggestions' })).toHaveCount(0);

      await saveAndExpect({ cms, editor, body: 'The dome opens :tada\n\nNext' });
    });
  });
});

test.describe('preview sanitization', () => {
  const BODY = 'Press <button type="button">Go</button> to start.';

  test.describe('default', () => {
    test.use({ config: noteConfig({}) });

    test('removes unsafe HTML from the preview', async ({ cms, page }) => {
      const { editor } = await openNote({ cms, page, body: BODY });
      const preview = editor.getByRole('document', { name: 'Content Preview' });

      await expect(preview).toContainText('to start.');
      await expect(preview.getByRole('button', { name: 'Go' })).toHaveCount(0);
    });
  });

  test.describe('turned off', () => {
    test.use({ config: noteConfig({ sanitize_preview: false }) });

    test('renders the HTML as is in the preview', async ({ cms, page }) => {
      const { editor } = await openNote({ cms, page, body: BODY });
      const preview = editor.getByRole('document', { name: 'Content Preview' });

      await expect(preview).toContainText('to start.');
      await expect(preview.getByRole('button', { name: 'Go' })).toBeVisible();
    });
  });
});

test.describe('field defaults', () => {
  test.use({
    config: noteConfig(
      { buttons: ['bold'] },
      { field_defaults: { richtext: { modes: ['raw', 'rich_text'], buttons: ['italic'] } } },
    ),
  });

  test('applies the global defaults, overridden by the field’s own options', async ({
    cms,
    page,
  }) => {
    const { field, body } = await openNote({ cms, page, body: 'The dome opens.' });

    await expect(field.getByRole('button', { name: 'Edit in Markdown' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(body).toHaveValue('The dome opens.');
    await expect(field.getByRole('button', { name: 'Bold' })).toBeVisible();
    await expect(field.getByRole('button', { name: 'Italic' })).toHaveCount(0);
  });
});
