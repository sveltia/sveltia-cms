import { expect, test } from '../../fixtures/test.js';
import { getEditor } from '../../fixtures/ui.js';

/**
 * Callout component, with enough lines to make its rich text field taller than the editor pane.
 */
const CALLOUT = [
  '<aside>',
  Array.from({ length: 40 }, (_, index) => `Line ${index + 1}.`).join('\n\n'),
  '</aside>',
].join('\n');

/**
 * Script registering a callout component with a rich text field of its own, which the preview
 * shows as is.
 */
const REGISTER_COMPONENT = `
  CMS.registerEditorComponent({
    id: 'callout',
    label: 'Callout',
    fields: [{ name: 'text', label: 'Callout Text', widget: 'richtext' }],
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
          { name: 'body', label: 'Body', widget: 'richtext' },
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
