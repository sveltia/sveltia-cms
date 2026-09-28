import { MONOLINGUAL_CONFIG, MONOLINGUAL_FILES } from '../../fixtures/configs/monolingual.js';
import { createPNG } from '../../fixtures/files.js';
import { selectText } from '../../fixtures/rich-text.js';
import { expect, test } from '../../fixtures/test.js';

/**
 * @import { Locator, Page } from '@playwright/test';
 */

test.use({ config: MONOLINGUAL_CONFIG });

/**
 * Front matter of the posts seeded here, with every field present, so a save only changes the body.
 */
const FRONT_MATTER = [
  '---',
  'title: Rich Post',
  'date: 2026-04-01',
  'draft: false',
  'category: news',
  'tags: []',
  'author: jane-doe',
  'rating: 3',
  "cover: ''",
  "excerpt: ''",
  '---',
  '',
  '',
].join('\n');

/**
 * Markdown in the style the rich text editor writes, which it reads and writes back unchanged.
 */
const CANONICAL_BODY = [
  '# Heading One',
  '',
  'Some **bold**, _italic_, ~~struck~~ and `code` text with a [link](https://example.com "Title").',
  '',
  '## Lists',
  '',
  '- One',
  '- Two',
  '    - Nested',
  '- Three',
  '',
  '1. First',
  '2. Second',
  '',
  '> A quote',
  '> on two lines',
  '',
  '```js',
  'const x = 1;',
  '```',
  '',
  '| A | B |',
  '| --- | --- |',
  '| 1 | 2 |',
  '',
  'Line with a hard  ',
  'break.',
  '',
  '***',
  '',
  'The end.',
  '',
].join('\n');

const RICH_POST_PATH = 'content/posts/2026-04-rich-post.md';

/**
 * Move the caret to the end of a rich text editor. The End key does that on Linux and Windows but
 * not on macOS, so set the selection directly, which the editor picks up.
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
 * Open the First Light post and wait for its body in the rich text editor.
 * @param {Page} page Page.
 */
const openFirstLight = async (page) => {
  await page.getByRole('row', { name: /First Light/ }).click();
  await expect(
    page.getByRole('group', { name: /Body.*Field/ }).getByRole('textbox', { name: 'Body' }),
  ).toContainText('The observatory opens its doors.');
};

test.describe('editing', () => {
  test.beforeEach(async ({ cms, page }) => {
    await cms.open();
    await cms.seed(MONOLINGUAL_FILES);
    await cms.signIn();
    await openFirstLight(page);
  });

  test('formats the selected text with the toolbar', async ({ cms, page }) => {
    const editor = page.getByRole('group', { name: 'Content Editor' });
    const field = editor.getByRole('group', { name: /Body.*Field/ });
    const body = field.getByRole('textbox', { name: 'Body' });

    await body.getByText(/observatory/).dblclick({ position: { x: 60, y: 8 } });
    await field.getByRole('button', { name: 'Italic' }).click();
    await body.getByText(/opens/).dblclick({ position: { x: 20, y: 8 } });
    await field.getByRole('button', { name: 'Bold' }).click();
    await body.getByText(/doors/).dblclick({ position: { x: 45, y: 8 } });
    await field.getByRole('button', { name: 'Link' }).click();

    const dialog = page.getByRole('dialog', { name: 'Insert Link' });

    await dialog.getByRole('textbox', { name: 'URL' }).fill('https://example.com/doors');
    await dialog.getByRole('button', { name: 'Insert' }).click();

    // The preview follows the editor
    const preview = editor.getByRole('document', { name: 'Content Preview' });

    await expect(preview.locator('strong')).toHaveText('opens');
    await expect(preview.getByRole('link', { name: 'doors' })).toHaveAttribute(
      'href',
      'https://example.com/doors',
    );

    await editor.getByRole('button', { name: 'Save' }).click();
    await expect
      .poll(async () => (await cms.readRepo())['content/posts/2026-01-first-light.md'])
      .toContain('\nThe _observatory_ **opens** its [doors](https://example.com/doors).\n');
  });

  test('changes the block style with the text style menu', async ({ cms, page }) => {
    const editor = page.getByRole('group', { name: 'Content Editor' });
    const field = editor.getByRole('group', { name: /Body.*Field/ });

    await field
      .getByRole('textbox', { name: 'Body' })
      .getByText(/observatory/)
      .click();
    await cms.chooseMenuItem(
      field.getByRole('button', { name: 'Show Text Style Options' }),
      page.getByRole('menuitemcheckbox', { name: 'Heading 2' }),
    );
    await expect(field.getByRole('textbox', { name: 'Body' }).getByRole('heading')).toHaveText(
      'The observatory opens its doors.',
    );
    // Wait for the change to reach the preview, like a user would see it before saving
    await expect(
      editor
        .getByRole('document', { name: 'Content Preview' })
        .getByRole('heading', { name: 'The observatory opens its doors.' }),
    ).toBeVisible();

    await editor.getByRole('button', { name: 'Save' }).click();
    await expect
      .poll(async () => (await cms.readRepo())['content/posts/2026-01-first-light.md'])
      .toContain('\n## The observatory opens its doors.\n');
  });

  test('turns Markdown typed in the editor into formatting', async ({ cms, page }) => {
    const editor = page.getByRole('group', { name: 'Content Editor' });

    const body = editor.getByRole('group', { name: /Body.*Field/ }).getByRole('textbox', {
      name: 'Body',
    });

    await moveCaretToEnd(body);
    await page.keyboard.press('Enter');
    await page.keyboard.type('## Visiting Hours');
    await page.keyboard.press('Enter');
    await page.keyboard.type('- Friday');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Saturday');

    await expect(body.getByRole('heading')).toHaveText('Visiting Hours');
    await expect(body.getByRole('listitem')).toHaveText(['Friday', 'Saturday']);

    await editor.getByRole('button', { name: 'Save' }).click();
    await expect
      .poll(async () => (await cms.readRepo())['content/posts/2026-01-first-light.md'])
      .toContain(
        '\nThe observatory opens its doors.\n\n## Visiting Hours\n\n- Friday\n- Saturday\n',
      );
  });

  test('edits the Markdown source and switches back', async ({ cms, page }) => {
    const editor = page.getByRole('group', { name: 'Content Editor' });
    const field = editor.getByRole('group', { name: /Body.*Field/ });
    const markdownButton = field.getByRole('button', { name: 'Edit in Markdown' });

    await markdownButton.click();
    await expect(markdownButton).toHaveAttribute('aria-pressed', 'true');

    const source = field.getByRole('textbox', { name: 'Body' });

    await expect(source).toHaveValue('The observatory opens its doors.');
    await source.fill('# Open House\n\nThe observatory opens its doors.');

    // The formatting tools edit the source too
    await source.evaluate((/** @type {HTMLTextAreaElement} */ textarea) => {
      const start = textarea.value.indexOf('doors');

      textarea.setSelectionRange(start, start + 'doors'.length);
    });
    await field.getByRole('button', { name: 'Bold' }).click();
    await expect(source).toHaveValue('# Open House\n\nThe observatory opens its **doors**.');
    await markdownButton.click();

    await expect(source.getByRole('heading')).toHaveText('Open House');
    await expect(source.locator('strong')).toHaveText('doors');

    await editor.getByRole('button', { name: 'Save' }).click();
    await expect
      .poll(async () => (await cms.readRepo())['content/posts/2026-01-first-light.md'])
      .toContain('\n# Open House\n\nThe observatory opens its **doors**.\n');
  });

  test('inserts an image with the image component', async ({ cms, page }) => {
    const image = createPNG({ color: [200, 180, 40] });
    const editor = page.getByRole('group', { name: 'Content Editor' });
    const field = editor.getByRole('group', { name: /Body.*Field/ });

    // Start a new paragraph, as an image is inserted inline at the caret
    await moveCaretToEnd(field.getByRole('textbox', { name: 'Body' }));
    await page.keyboard.press('Enter');
    await field.getByRole('button', { name: 'Image', exact: true }).click();

    const component = field.getByRole('group', { name: 'Image', exact: true });

    await component
      .getByRole('group', { name: /Source/ })
      .locator('input[type="file"]')
      .first()
      .setInputFiles({ name: 'dome.png', mimeType: 'image/png', buffer: image });
    await component.getByRole('textbox', { name: 'Alt Text' }).fill('The dome at night');
    await editor.getByRole('button', { name: 'Save' }).click();

    await expect
      .poll(async () => (await cms.readRepo())['content/posts/2026-01-first-light.md'])
      .toContain('\nThe observatory opens its doors.\n\n![The dome at night](/uploads/dome.png)\n');
    expect(await cms.readRepoFile('static/uploads/dome.png')).toEqual(image);
  });
});

test.describe('existing Markdown', () => {
  test('keeps Markdown in the editor’s style unchanged', async ({ cms, page }) => {
    await cms.open();
    await cms.seed({ ...MONOLINGUAL_FILES, [RICH_POST_PATH]: `${FRONT_MATTER}${CANONICAL_BODY}` });
    await cms.signIn();
    await page.getByRole('row', { name: /Rich Post/ }).click();

    const editor = page.getByRole('group', { name: 'Content Editor' });
    const title = editor.getByRole('textbox', { name: 'Title' }).first();

    await expect(editor.getByRole('textbox', { name: 'Body' })).toContainText('The end.');
    // Loading the body in the editor doesn’t count as a change. The Save button starts disabled,
    // and would only be enabled once the editor has converted the body, a moment later. There’s
    // nothing to wait for when that doesn’t happen, so wait longer than the conversion takes
    await page.waitForTimeout(1000);
    await expect(editor.getByRole('button', { name: 'Save' })).toBeDisabled();

    await title.fill('Rich Post, Revised');
    await editor.getByRole('button', { name: 'Save' }).click();

    await expect
      .poll(async () => (await cms.readRepo())[RICH_POST_PATH])
      .toBe(`${FRONT_MATTER.replace('Rich Post', 'Rich Post, Revised')}${CANONICAL_BODY}`);
  });

  /**
   * Markdown the editor reads fine but writes in another style.
   */
  const OTHER_STYLES = {
    'asterisk emphasis': 'Some *italic* text.',
    'a dash thematic break': 'Before\n\n---\n\nAfter',
    'a list nested by 2 spaces': '- One\n  - Nested',
    'a short table delimiter row': '| A | B |\n| - | - |\n| 1 | 2 |',
    // The editor gives the block a default language as it loads it
    'a code block without a language': '```\ncode\n```',
  };

  Object.entries(OTHER_STYLES).forEach(([name, body]) => {
    test(`keeps ${name} unchanged when another field is saved`, async ({ cms, page }) => {
      await cms.open();
      await cms.seed({ ...MONOLINGUAL_FILES, [RICH_POST_PATH]: `${FRONT_MATTER}${body}\n` });
      await cms.signIn();
      await page.getByRole('row', { name: /Rich Post/ }).click();

      const editor = page.getByRole('group', { name: 'Content Editor' });

      await expect(editor.getByRole('textbox', { name: 'Title' }).first()).toHaveValue('Rich Post');
      // Loading the body in the editor doesn’t count as a change, although the editor writes the
      // Markdown in its own style. The Save button starts disabled, and would only be enabled once
      // the editor has converted the body, a moment later. There’s nothing to wait for when that
      // doesn’t happen, so wait longer than the conversion takes
      await page.waitForTimeout(1000);
      await expect(editor.getByRole('button', { name: 'Save' })).toBeDisabled();

      await editor.getByRole('textbox', { name: 'Title' }).first().fill('Rich Post, Revised');
      await editor.getByRole('button', { name: 'Save' }).click();

      await expect
        .poll(async () => (await cms.readRepo())[RICH_POST_PATH])
        .toBe(`${FRONT_MATTER.replace('Rich Post', 'Rich Post, Revised')}${body}\n`);
    });
  });

  test('writes the body in the editor’s style once it’s edited', async ({ cms, page }) => {
    await cms.open();
    await cms.seed({
      ...MONOLINGUAL_FILES,
      [RICH_POST_PATH]: `${FRONT_MATTER}Some *italic* text.\n`,
    });
    await cms.signIn();
    await page.getByRole('row', { name: /Rich Post/ }).click();

    const editor = page.getByRole('group', { name: 'Content Editor' });
    const body = editor.getByRole('textbox', { name: 'Body' });

    await expect(body).toContainText('Some italic text.');
    await moveCaretToEnd(body);
    await page.keyboard.type(' More.');
    await editor.getByRole('button', { name: 'Save' }).click();

    await expect
      .poll(async () => (await cms.readRepo())[RICH_POST_PATH])
      .toBe(`${FRONT_MATTER}Some _italic_ text. More.\n`);
  });

  test('counts a change that’s undone as no change, keeping the body as it was', async ({
    cms,
    page,
  }) => {
    await cms.open();
    await cms.seed({
      ...MONOLINGUAL_FILES,
      [RICH_POST_PATH]: `${FRONT_MATTER}Some *italic* text.\n`,
    });
    await cms.signIn();
    await page.getByRole('row', { name: /Rich Post/ }).click();

    const editor = page.getByRole('group', { name: 'Content Editor' });
    const body = editor.getByRole('textbox', { name: 'Body' });
    const save = editor.getByRole('button', { name: 'Save' });
    const preview = editor.getByRole('document', { name: 'Content Preview' });

    await expect(body).toContainText('Some italic text.');
    await moveCaretToEnd(body);
    await page.keyboard.type('!');
    // Wait for the change to reach the entry, which the preview shows
    await expect(preview).toContainText('Some italic text.!');
    await expect(save).toBeEnabled();

    // Deleting the character brings the body back to what it was, although the editor would write
    // it in its own style
    await page.keyboard.press('Backspace');
    await expect(preview).not.toContainText('text.!');
    await expect(save).toBeDisabled();

    await editor.getByRole('textbox', { name: 'Title' }).first().fill('Rich Post, Revised');
    await save.click();

    await expect
      .poll(async () => (await cms.readRepo())[RICH_POST_PATH])
      .toBe(`${FRONT_MATTER.replace('Rich Post', 'Rich Post, Revised')}Some *italic* text.\n`);
  });

  test('shows the language of each code block', async ({ cms, page }) => {
    await cms.open();
    await cms.seed({
      ...MONOLINGUAL_FILES,
      [RICH_POST_PATH]: `${FRONT_MATTER}${['```js', 'const x = 1;', '```', '', '```txt', 'hello', '```', ''].join('\n')}`,
    });
    await cms.signIn();
    await page.getByRole('row', { name: /Rich Post/ }).click();

    const field = page
      .getByRole('group', { name: 'Content Editor' })
      .getByRole('group', { name: /Body.*Field/ });

    const body = field.getByRole('textbox', { name: 'Body' });
    const language = field.getByRole('combobox', { name: 'Language' });

    // A block labelled with an alias shows the language it stands for, and a block in a language
    // that isn’t listed shows plain text rather than the language of the block selected before
    await body.getByText('const x = 1;').click();
    await expect(language).toHaveText(/JavaScript/);
    await body.getByText('hello').click();
    await expect(language).toHaveText(/Plain Text/);
  });

  test('keeps a change made with a keyboard shortcut right before saving', async ({
    cms,
    page,
  }) => {
    // The editor converts the content to Markdown 100 ms after a change, so a save right after a
    // change has to wait for it. The Save button is clicked with a dispatched event, which comes
    // within 100 ms even on a busy runner, unlike a Playwright click. The Accel+S shortcut is
    // tested in `editor/shortcuts.e2e.js`
    await cms.open();
    await cms.seed(MONOLINGUAL_FILES);
    await cms.signIn();
    await openFirstLight(page);

    const editor = page.getByRole('group', { name: 'Content Editor' });

    const body = editor.getByRole('group', { name: /Body.*Field/ }).getByRole('textbox', {
      name: 'Body',
    });

    // A change made with the shortcut is kept once it has reached the preview
    await selectText(body, 'observatory');
    await page.keyboard.press('ControlOrMeta+b');
    await expect(
      editor.getByRole('document', { name: 'Content Preview' }).locator('strong'),
    ).toHaveText('observatory');

    // Another one saved right away is kept too
    await selectText(body, 'opens');
    await page.keyboard.press('ControlOrMeta+b');
    await editor.getByRole('button', { name: 'Save' }).dispatchEvent('click');

    await expect(page.getByRole('status').filter({ hasText: 'Entry saved.' })).toBeVisible();
    expect((await cms.readRepo())['content/posts/2026-01-first-light.md']).toContain(
      '\nThe **observatory** **opens** its doors.\n',
    );
  });
});
