import { BASE_CONFIG, expect, test } from '../../fixtures/test.js';

const ORDINALS = ['First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth'];

/**
 * Page collection with a collapsed list of sections, each with a collapsed list of cards.
 */
const COLLECTION = {
  name: 'pages',
  label: 'Pages',
  folder: 'content/pages',
  format: 'json',
  fields: [
    { name: 'title', label: 'Title' },
    { name: 'description', label: 'Description', widget: 'text' },
    {
      name: 'sections',
      label: 'Sections',
      widget: 'list',
      collapsed: true,
      summary: '{{heading}}',
      fields: [
        { name: 'heading', label: 'Heading' },
        { name: 'intro', label: 'Intro', widget: 'text' },
        {
          name: 'cards',
          label: 'Cards',
          widget: 'list',
          collapsed: true,
          summary: '{{title}}',
          fields: [
            { name: 'title', label: 'Title' },
            { name: 'body', label: 'Body', widget: 'text' },
          ],
        },
      ],
    },
  ],
};

/**
 * Entry with 6 sections of 6 cards.
 */
const PAGE = {
  title: 'Example page',
  description: 'An example page.',
  sections: ORDINALS.map((section) => ({
    heading: `${section} section heading`,
    intro: `${section} section intro.`,
    cards: ORDINALS.map((card) => ({
      title: `${section} section, ${card.toLowerCase()} card title`,
      body: `${section} section, ${card.toLowerCase()} card body.`,
    })),
  })),
};

test.use({ config: { ...BASE_CONFIG, collections: [COLLECTION] } });

test.beforeEach(async ({ cms, page }) => {
  await cms.open();
  await cms.seed({ 'content/pages/example.json': JSON.stringify(PAGE, null, 2) });
  await cms.signIn();
  await page.getByRole('row', { name: /Example page/ }).click();
});

test('focuses a field in a collapsed item below the rendered fields', async ({ page }) => {
  const editor = page.getByRole('group', { name: 'Content Editor' });
  const preview = editor.getByRole('document', { name: 'Content Preview' });
  const value = preview.getByText('Fifth section, fourth card title', { exact: true });

  // The preview also renders the list items as they’re scrolled into view, so scroll it with the
  // mouse wheel until the value is there
  await preview.hover();
  await expect(async () => {
    await page.mouse.wheel(0, 400);
    await expect(value).toBeVisible({ timeout: 200 });
  }).toPass({ intervals: [0] });
  await value.scrollIntoViewIfNeeded();
  await value.click();

  // The item is expanded, and its field rendered, scrolled into view and focused, although the
  // edit pane only renders fields as they’re scrolled into view
  const title = editor.getByRole('textbox', { name: 'Title' }).and(page.locator(':focus'));

  await expect(title).toHaveValue('Fifth section, fourth card title');
  await expect(title).toBeInViewport();
});

test('focuses a field in a collapsed item near the top', async ({ page }) => {
  const editor = page.getByRole('group', { name: 'Content Editor' });

  await editor
    .getByRole('document', { name: 'Content Preview' })
    .getByText('First section heading', { exact: true })
    .click();

  await expect(editor.getByRole('textbox', { name: 'Heading' }).first()).toBeFocused();
});
