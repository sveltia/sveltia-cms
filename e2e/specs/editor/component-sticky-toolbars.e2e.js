import { expect, test } from '../../fixtures/test.js';
import { getEditor } from '../../fixtures/ui.js';

/**
 * Steps component, with enough list items to make it taller than the editor pane.
 */
const STEPS = [
  '<steps>',
  JSON.stringify(Array.from({ length: 30 }, (_, index) => ({ title: `Step ${index + 1}` }))),
  '</steps>',
].join('\n');

/**
 * Script registering a steps component with a List field.
 */
const REGISTER_COMPONENT = `
  CMS.registerEditorComponent({
    id: 'steps',
    label: 'Steps',
    fields: [
      {
        name: 'steps',
        label: 'Steps',
        label_singular: 'Step',
        widget: 'list',
        collapsed: true,
        fields: [{ name: 'title', label: 'Title' }],
      },
    ],
    pattern: /^<steps>\\n(.*)\\n<\\/steps>$/m,
    fromBlock: (match) => ({ steps: JSON.parse(match[1]) }),
    toBlock: ({ steps }) => '<steps>\\n' + JSON.stringify(steps) + '\\n</steps>',
    toPreview: () => '<ol></ol>',
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
          { name: 'body', label: 'Body', widget: 'richtext', editor_components: ['steps'] },
        ],
      },
    ],
  },
});

test.beforeEach(async ({ cms, page }) => {
  await cms.open();
  // The editor reads the components when it’s opened
  await page.evaluate(REGISTER_COMPONENT);
  await cms.seed({ 'content/notes/note.md': `---\ntitle: Note\n---\n\nIntro.\n\n${STEPS}\n` });
  await cms.signIn();
  await page.getByRole('row', { name: /Note/ }).click();
});

test('keeps the sticky header of a List field in a component below the editor toolbar', async ({
  page,
}) => {
  const editor = getEditor(page);
  const toolbar = editor.getByRole('toolbar', { name: 'Text Editor' });
  const list = editor.getByRole('group', { name: '30 Steps' });
  // The expander button in the header of the List field
  const header = list.getByRole('button', { name: 'Collapse', exact: true });

  await page.addStyleTag({ content: '* { scroll-behavior: auto !important; }' });
  // Scroll to the end of the list, past the top of the component
  await list.evaluate((element) => element.scrollIntoView({ block: 'end' }));

  // The header used to stick to the top of the pane, behind the toolbar of the body field’s editor
  await expect(async () => {
    const toolbarBox = /** @type {{ y: number, height: number }} */ (await toolbar.boundingBox());
    const headerBox = /** @type {{ y: number }} */ (await header.boundingBox());

    expect(headerBox.y).toBeGreaterThanOrEqual(toolbarBox.y + toolbarBox.height);
  }).toPass();

  await expect(header).toBeInViewport();
});

test('scrolls a new item of a List field in a component below the sticky toolbars', async ({
  page,
}) => {
  const editor = getEditor(page);
  const list = editor.getByRole('group', { name: /3[01] Steps/ });
  // The expander button in the header of the List field
  const header = list.getByRole('button', { name: 'Collapse', exact: true }).first();

  await page.addStyleTag({ content: '* { scroll-behavior: auto !important; }' });
  await list
    .getByRole('group', { name: 'Item 1 of 30' })
    .getByRole('button', { name: 'List Item Options' })
    .click();
  await page.getByRole('menuitem', { name: 'Add Item Below' }).click();

  const newItem = list.getByRole('group', { name: 'Item 2 of 31' });

  // The expander button of the new item gets the focus once it’s scrolled into view
  await expect(newItem.getByRole('button', { name: 'Collapse', exact: true })).toBeFocused();

  // The new item used to be scrolled back only 50 pixels, which left it behind the toolbars
  const headerBottom = await header.evaluate(
    (element) =>
      /** @type {HTMLElement} */ (element.closest('.toolbar')).getBoundingClientRect().bottom,
  );

  const itemBox = /** @type {{ y: number }} */ (await newItem.boundingBox());

  // Allow for subpixel rounding of the scroll position
  expect(itemBox.y).toBeGreaterThanOrEqual(headerBottom - 1);
});
