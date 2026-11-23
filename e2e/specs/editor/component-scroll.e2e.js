import { expect, test } from '../../fixtures/test.js';
import { getEditor } from '../../fixtures/ui.js';

/**
 * Callout component, with enough lines to make its rich text field taller than the editor pane,
 * followed by a table.
 */
const CALLOUT = [
  '<aside>',
  Array.from({ length: 40 }, (_, index) => `Line ${index + 1}.`).join('\n\n'),
  '',
  '| Class | Price |',
  '| --- | --- |',
  '| Standard | 50 kr |',
  '| Plus | 200 kr |',
  '</aside>',
].join('\n');

/**
 * Editor components of the body field and the callout’s field. The table component enables the
 * table editing, which handles clicks on the cells.
 */
const EDITOR_COMPONENTS = ['table', 'callout'];

/**
 * Script registering a callout component with a rich text field of its own, which the preview
 * shows as is.
 */
const REGISTER_COMPONENT = `
  CMS.registerEditorComponent({
    id: 'callout',
    label: 'Callout',
    fields: [
      {
        name: 'text',
        label: 'Callout Text',
        widget: 'richtext',
        editor_components: ${JSON.stringify(EDITOR_COMPONENTS)},
      },
    ],
    pattern: /^<aside>\\n([\\s\\S]*?)\\n<\\/aside>$/,
    fromBlock: (match) => ({ text: match[1] }),
    toBlock: ({ text }) => '<aside>\\n' + text + '\\n</aside>',
    toPreview: ({ text }) => '<p>' + text + '</p>',
  });
`;

test.use({
  config: {
    backend: { name: 'test-repo' },
    media_folder: 'static/uploads',
    public_folder: '/uploads',
    collections: [
      {
        name: 'notes',
        label: 'Notes',
        label_singular: 'Note',
        folder: 'content/notes',
        create: true,
        fields: [
          { name: 'title', label: 'Title' },
          {
            name: 'body',
            label: 'Body',
            widget: 'richtext',
            editor_components: EDITOR_COMPONENTS,
          },
        ],
      },
    ],
  },
});

test.beforeEach(async ({ cms, page }) => {
  await cms.open();
  // The editor reads the components when it’s opened
  await page.evaluate(REGISTER_COMPONENT);
  await cms.seed({
    'content/notes/note.md': `---\ntitle: Note\n---\n\nIntro.\n\n${CALLOUT}\n`,
  });
  await cms.signIn();
  await page.getByRole('row', { name: /Note/ }).click();
});

test('keeps the line being typed in a component in view', async ({ page }) => {
  const editor = getEditor(page);
  const textbox = editor.getByRole('textbox', { name: 'Callout Text' });
  const lastLine = textbox.getByText('Line 40.');

  // Select something in the body field’s own editor first, as the bug only shows up when that
  // editor has a selection to move back to
  await editor.getByRole('textbox', { name: 'Body' }).getByText('Intro.').click();
  await lastLine.scrollIntoViewIfNeeded();

  const { width, height } = /** @type {{ width: number, height: number }} */ (
    await lastLine.boundingBox()
  );

  // Put the caret at the end of the line, past its text
  await lastLine.click({ position: { x: width - 1, y: height / 2 } });
  await page.keyboard.type(' Edited.');
  // Once the preview shows the change, the component has been updated. The body field’s editor
  // used to move the selection back to its own and scroll to it, and the focus then restored to the
  // component’s field scrolled to the top of the field, away from the caret
  await expect(
    page.getByRole('document', { name: 'Content Preview' }).getByText('Line 40. Edited.'),
  ).toBeVisible();
  await expect(textbox.getByText('Line 1.', { exact: true })).not.toBeInViewport();
  await expect(lastLine).toBeInViewport();
});

test('keeps a table cell clicked in a component in view', async ({ page }) => {
  const editor = getEditor(page);
  const textbox = editor.getByRole('textbox', { name: 'Callout Text' });
  const cell = textbox.getByRole('cell', { name: 'Plus', exact: true });

  // Scroll instantly, so any scrolling caused by the click is over once it has been handled
  await page.addStyleTag({ content: '* { scroll-behavior: auto !important; }' });
  // Select something in the body field’s own editor first, as the bug only shows up when that
  // editor has a selection to move back to
  await editor.getByRole('textbox', { name: 'Body' }).getByText('Intro.').click();
  // Then edit the callout, as the user would before clicking on the table
  await textbox.getByText('Line 40.').click();
  await cell.scrollIntoViewIfNeeded();
  // The body field’s editor used to take the click on the cell for its own, fail to find the table
  // in its content, and move the selection back to its own while recovering, scrolling to it
  await cell.click();
  await expect(editor.getByRole('button', { name: 'Show Table Options' })).toBeVisible();
  await expect(textbox.getByText('Line 1.', { exact: true })).not.toBeInViewport();
  await expect(cell).toBeInViewport();
});
