import { expect, test } from '../../fixtures/test.js';
import { getEditor } from '../../fixtures/ui.js';

/**
 * A page with a collapsed List of sections, each long enough that the default preview only renders
 * the first few until it’s scrolled.
 */
const CONFIG = {
  backend: { name: 'test-repo' },
  media_folder: 'static/uploads',
  collections: [
    {
      name: 'pages',
      label: 'Pages',
      folder: 'content/pages',
      format: 'json',
      fields: [
        { name: 'title', label: 'Title' },
        {
          name: 'sections',
          label: 'Sections',
          widget: 'list',
          collapsed: true,
          summary: '{{heading}}',
          fields: [
            { name: 'heading', label: 'Heading' },
            { name: 'body', label: 'Body', widget: 'text' },
          ],
        },
      ],
    },
  ],
};

const ORDINALS = [
  'First',
  'Second',
  'Third',
  'Fourth',
  'Fifth',
  'Sixth',
  'Seventh',
  'Eighth',
  'Ninth',
  'Tenth',
];

const PAGE = JSON.stringify({
  title: 'Long Page',
  sections: ORDINALS.map((ordinal) => ({
    heading: `${ordinal} section heading`,
    body: Array.from({ length: 6 }, (_, index) =>
      `${ordinal} paragraph ${index + 1}.`.repeat(20),
    ).join('\n\n'),
  })),
});

test.use({ config: CONFIG });

test.beforeEach(async ({ cms, page }) => {
  await cms.open();
  await cms.seed({ 'content/pages/long-page.json': PAGE });
  await cms.signIn();
  await page.getByRole('row', { name: /Long Page/ }).click();
});

// @see https://github.com/sveltia/sveltia-cms/issues/1073
test('scrolls the preview to a focused field in a List item it hasn’t rendered yet', async ({
  page,
}) => {
  const editor = getEditor(page);
  const previewArea = editor.getByRole('group', { name: 'Preview Content' }).locator('.content');
  const heading = previewArea.locator('[data-key-path="sections.8.heading"]');

  await expect(editor.getByRole('textbox', { name: 'Title' })).toHaveValue('Long Page');
  // The preview hasn’t rendered the ninth section
  await expect(heading).toHaveCount(0);

  const editArea = editor.getByRole('group', { name: 'Edit Content' }).locator('.content');

  const expandButtons = editor
    .getByRole('group', { name: /Sections.*Field/ })
    .getByRole('button', { name: 'Expand', exact: true });

  // Scroll the Edit Pane down to the collapsed sections, which it also renders lazily. A scroll
  // other than the user’s isn’t synced, so the preview stays at the top, as it would after the
  // short distance the collapsed sections take the user to scroll
  await expect(async () => {
    await editArea.evaluate((element) => {
      element.scrollTop = element.scrollHeight;
    });
    await expect(expandButtons).toHaveCount(10, { timeout: 500 });
  }).toPass();
  await expect(heading).toHaveCount(0);

  // Expand the ninth section and click its Heading field, which barely scrolls the Edit Pane
  await expandButtons.nth(8).click();
  await editor.getByRole('textbox', { name: 'Heading' }).click();

  await expect(heading).toBeInViewport();
  await expect(heading).toContainText('Ninth section heading');
});
