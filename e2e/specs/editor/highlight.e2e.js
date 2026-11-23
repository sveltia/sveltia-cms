import { BASE_CONFIG, expect, test } from '../../fixtures/test.js';
import { getEditor } from '../../fixtures/ui.js';

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

/**
 * Page collection laid out like the one in issue #1070: each section has a collapsed list of
 * sliders, followed by another collapsed list and a field that render below the sliders.
 */
const SLIDER_COLLECTION = {
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
        {
          name: 'sliders',
          label: 'Sliders',
          widget: 'list',
          required: false,
          collapsed: true,
          summary: '{{label}}',
          fields: [
            { name: 'label', label: 'Label', required: false },
            { name: 'caption', label: 'Caption', required: false },
          ],
        },
        {
          name: 'features',
          label: 'Feature checkboxes',
          widget: 'list',
          required: false,
          collapsed: true,
          fields: [
            { name: 'label', label: 'Label', required: false },
            { name: 'days', label: 'Days', widget: 'number', required: false },
          ],
        },
        { name: 'footer', label: 'Footer', widget: 'text', required: false },
      ],
    },
  ],
};

/**
 * Entry with three sections, the middle one with 5 sliders, 6 features and a footer.
 */
const SLIDER_PAGE = {
  title: 'Example page',
  sections: [
    { heading: 'Intro section heading' },
    {
      heading: 'Pricing',
      sliders: [
        ['Page templates', 'Home, Services, About'],
        ['Content types', 'People, News, Events, Resources, Jobs'],
        ['Web forms', 'Subscribe, Contact, Applications'],
        ['Content types to migrate', 'Export and import from previous site'],
        ['API integrations', 'CRM system, Single Sign-On'],
      ].map(([label, caption]) => ({ label, caption })),
      features: [
        ['Site search', 1],
        ['Member area', 3],
        ['Member payments', 3],
        ['Donations', 2],
        ['Discussion forum', 3],
        ['E-commerce', 5],
      ].map(([label, days]) => ({ label, days })),
      footer:
        'For maintenance please see [support plans](/support/).\n\n' +
        'Every website is different so we are happy to discuss your requirements in more detail.',
    },
    { heading: 'Last section heading' },
  ],
};

/**
 * Set up the given collection with the given page, and open the page.
 * @param {object} collection Collection.
 * @param {object} entry Page content.
 */
const usePage = (collection, entry) => {
  test.use({ config: { ...BASE_CONFIG, collections: [collection] } });

  test.beforeEach(async ({ cms, page }) => {
    await cms.open();
    await cms.seed({ 'content/pages/example.json': JSON.stringify(entry, null, 2) });
    await cms.signIn();
    await page.getByRole('row', { name: /Example page/ }).click();
  });
};

test.describe('cards', () => {
  usePage(COLLECTION, PAGE);

  test('focuses a field in a collapsed item below the rendered fields', async ({ page }) => {
    const editor = getEditor(page);
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
    const editor = getEditor(page);

    await editor
      .getByRole('document', { name: 'Content Preview' })
      .getByText('First section heading', { exact: true })
      .click();

    await expect(editor.getByRole('textbox', { name: 'Heading' }).first()).toBeFocused();
  });
});

test.describe('sliders followed by other fields', () => {
  usePage(SLIDER_COLLECTION, SLIDER_PAGE);

  test('focuses a field in a collapsed item of a list followed by other fields', async ({
    page,
  }) => {
    const editor = getEditor(page);
    const preview = editor.getByRole('document', { name: 'Content Preview' });
    const value = preview.getByText('API integrations', { exact: true });

    await preview.hover();
    await expect(async () => {
      await page.mouse.wheel(0, 400);
      await expect(value).toBeVisible({ timeout: 200 });
    }).toPass({ intervals: [0] });
    await value.scrollIntoViewIfNeeded();
    await value.click();

    // The edit pane used to scroll to the Footer field below the sliders, and give up there
    const label = editor.getByRole('textbox', { name: 'Label' }).and(page.locator(':focus'));

    await expect(label).toHaveValue('API integrations');
    await expect(label).toBeInViewport();
  });
});
