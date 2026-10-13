import { expect, test } from '../../fixtures/test.js';
import { getEditor } from '../../fixtures/ui.js';

/**
 * @import { Locator, Page } from '@playwright/test';
 */

/**
 * Body of a note with an image component below enough paragraphs to scroll the editor pane.
 */
const BODY = [
  ...Array.from({ length: 30 }, (_, index) => `Paragraph ${index + 1}.`),
  '![Canoe](/uploads/canoe.jpg)',
].join('\n\n');

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

/**
 * Wait until the frame after the next one has been rendered, by which time a component rendered
 * in the editor would have taken the focus.
 * @param {Page} page Page.
 */
const waitForFrames = async (page) => {
  await page.evaluate(
    () =>
      new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(resolve));
      }),
  );
};

/**
 * Expect the image component to be rendered without having taken the focus, and the given element,
 * which the user last saw, to be still in view, as the editor pane hasn’t scrolled to the
 * component.
 * @param {Page} page Page.
 * @param {Locator} field Body field.
 * @param {Locator} [inView] Element expected in view. The Title field by default, as the editor
 * pane is scrolled to the top when an entry is opened.
 */
const expectUnfocused = async (
  page,
  field,
  inView = getEditor(page).getByRole('textbox', { name: 'Title' }),
) => {
  const component = field.getByRole('group', { name: 'Image', exact: true });

  await expect(component.getByRole('button', { name: 'Collapse' })).toBeAttached();
  await waitForFrames(page);
  await expect(component).not.toBeFocused();
  await expect(inView).toBeInViewport();
};

test.beforeEach(async ({ cms, page }) => {
  await cms.open();
  await cms.seed({ 'content/notes/note.md': `---\ntitle: Note\n---\n\n${BODY}\n` });
  await cms.signIn();
  await page.getByRole('row', { name: /Note/ }).click();
});

test('leaves the focus alone when an entry with a component is opened', async ({ page }) => {
  await expectUnfocused(page, getEditor(page).getByRole('group', { name: /Body.*Field/ }));
});

test('leaves the focus alone when the editor is switched back to rich text', async ({ page }) => {
  const field = getEditor(page).getByRole('group', { name: /Body.*Field/ });
  const toggle = field.getByRole('button', { name: 'Edit in Markdown' });

  await expectUnfocused(page, field);
  await toggle.click();
  await expect(field.getByRole('group', { name: 'Image', exact: true })).toHaveCount(0);
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  // Clicking the toggle scrolls it into view, so it’s the toggle that has to stay there
  await expectUnfocused(page, field, toggle);
  await expect(toggle).toBeFocused();
});

test('focuses a component the user inserts', async ({ page }) => {
  const field = getEditor(page).getByRole('group', { name: /Body.*Field/ });

  await expectUnfocused(page, field);
  await field
    .getByRole('textbox', { name: 'Body' })
    .getByText('Paragraph 1.', { exact: true })
    .click();
  await field.getByRole('button', { name: 'Image', exact: true }).click();
  await expect(field.getByRole('group', { name: 'Image', exact: true })).toHaveCount(2);
  await expect(field.getByRole('group', { name: 'Image', exact: true }).first()).toBeFocused();
});
