import { expect, test } from '../../fixtures/test.js';

/**
 * A page whose List fields each turn off or change one of the list controls: adding, removing,
 * duplicating and reordering items, adding them to the top, and collapsing the items or the whole
 * list, with a list of objects, a list of strings and a list with types for the options that apply
 * to each. Two Object fields are collapsed only once filled.
 */
const CONFIG = {
  backend: { name: 'test-repo' },
  media_folder: 'static/uploads',
  collections: [
    {
      name: 'pages',
      label: 'Pages',
      label_singular: 'Page',
      folder: 'content/pages',
      extension: 'yml',
      fields: [
        { name: 'title', label: 'Title' },
        {
          name: 'links',
          label: 'Links',
          label_singular: 'Link',
          widget: 'list',
          required: false,
          allow_add: false,
          fields: [
            { name: 'text', label: 'Text' },
            { name: 'url', label: 'URL' },
          ],
        },
        {
          name: 'tags',
          label: 'Tags',
          label_singular: 'Tag',
          widget: 'list',
          allow_remove: false,
          field: { name: 'tag', label: 'Tag' },
        },
        {
          name: 'steps',
          label: 'Steps',
          label_singular: 'Step',
          widget: 'list',
          allow_reorder: false,
          allow_duplicate: false,
          fields: [{ name: 'name', label: 'Step Name' }],
        },
        {
          name: 'blocks',
          label: 'Blocks',
          label_singular: 'Block',
          widget: 'list',
          add_to_top: true,
          types: [
            { name: 'text', label: 'Text', fields: [{ name: 'body', label: 'Body' }] },
            { name: 'image', label: 'Image', fields: [{ name: 'alt', label: 'Alt Text' }] },
          ],
        },
        {
          name: 'news',
          label: 'News',
          label_singular: 'Headline',
          widget: 'list',
          add_to_top: true,
          field: { name: 'headline', label: 'Headline' },
        },
        {
          name: 'cards',
          label: 'Cards',
          label_singular: 'Card',
          widget: 'list',
          allow_add: false,
          allow_remove: false,
          allow_reorder: false,
          types: [
            { name: 'note', label: 'Note', fields: [{ name: 'note_text', label: 'Note Text' }] },
            {
              name: 'quote',
              label: 'Quote',
              fields: [{ name: 'quote_text', label: 'Quote Text' }],
            },
          ],
        },
        {
          name: 'gallery',
          label: 'Gallery',
          label_singular: 'Photo',
          widget: 'list',
          minimize_collapsed: true,
          fields: [{ name: 'caption', label: 'Caption' }],
        },
        {
          name: 'sponsors',
          label: 'Sponsors',
          label_singular: 'Sponsor',
          widget: 'list',
          minimize_collapsed: 'auto',
          field: { name: 'sponsor', label: 'Sponsor Name' },
        },
        {
          name: 'faq',
          label: 'FAQ',
          label_singular: 'Question',
          widget: 'list',
          minimize_collapsed: 'auto',
          required: false,
          fields: [{ name: 'question', label: 'Question' }],
        },
        {
          name: 'features',
          label: 'Features',
          label_singular: 'Feature',
          widget: 'list',
          collapsed: 'auto',
          summary: '{{name}}',
          fields: [{ name: 'name', label: 'Feature Name', required: false }],
        },
        {
          name: 'contact',
          label: 'Contact',
          widget: 'object',
          collapsed: 'auto',
          summary: '{{email}}',
          fields: [{ name: 'email', label: 'Email' }],
        },
        {
          name: 'address',
          label: 'Address',
          widget: 'object',
          collapsed: 'auto',
          fields: [{ name: 'city', label: 'City', required: false }],
        },
      ],
    },
  ],
};

const HOME_PATH = 'content/pages/home.yml';

const HOME = [
  'title: Home',
  'links:',
  '  - text: Docs',
  '    url: /docs',
  '  - text: Blog',
  '    url: /blog',
  'tags:',
  '  - space',
  '  - stars',
  'steps:',
  '  - name: Look up',
  '  - name: Find Orion',
  'blocks:',
  '  - type: text',
  '    body: Welcome.',
  'news:',
  '  - Launch day',
  'cards:',
  '  - type: note',
  '    note_text: Bring a torch.',
  '  - type: quote',
  '    quote_text: Ad astra.',
  'gallery:',
  '  - caption: Moon',
  '  - caption: Mars',
  'sponsors:',
  '  - Night Sky Club',
  'faq: []',
  'features:',
  '  - name: Telescopes',
  "  - name: ''",
  'contact:',
  '  email: hello@example.com',
  'address:',
  "  city: ''",
  '',
].join('\n');

// The editor renders a field once it’s scrolled into view, so make every field visible at once
test.use({ config: CONFIG, viewport: { width: 1280, height: 8000 } });

test.beforeEach(async ({ cms, page }) => {
  await cms.open();
  await cms.seed({ [HOME_PATH]: HOME });
  await cms.signIn();
  await page.getByRole('row', { name: /Home/ }).click();
  await expect(
    page.getByRole('group', { name: 'Content Editor' }).getByRole('group', { name: /Address/ }),
  ).toBeVisible();
});

/**
 * Get the group of a field in the editor.
 * @param {import('@playwright/test').Page} page Page.
 * @param {string} label Field label.
 * @returns {import('@playwright/test').Locator} Field group.
 */
const getField = (page, label) =>
  page
    .getByRole('group', { name: 'Content Editor' })
    .getByRole('group', { name: new RegExp(`${label}.*Field`) });

/**
 * Save the entry.
 * @param {import('@playwright/test').Page} page Page.
 */
const save = async (page) => {
  await page
    .getByRole('group', { name: 'Content Editor' })
    .getByRole('button', { name: 'Save' })
    .click();
};

/**
 * Get the saved home page.
 * @param {import('../../fixtures/test.js').CMS} cms CMS.
 * @returns {Promise<string | undefined>} File content.
 */
const readHome = async (cms) => (await cms.readRepo())[HOME_PATH];

/**
 * Check that an element is shown above another one.
 * @param {import('@playwright/test').Locator} upper Element expected to be above.
 * @param {import('@playwright/test').Locator} lower Element expected to be below.
 */
const expectAbove = async (upper, lower) => {
  await expect(upper).toBeVisible();
  await expect(lower).toBeVisible();

  const upperBox = await upper.boundingBox();
  const lowerBox = await lower.boundingBox();

  expect(upperBox?.y).toBeLessThan(/** @type {number} */ (lowerBox?.y));
};

test('hides the Add buttons and the item options of a list that doesn’t allow adding', async ({
  cms,
  page,
}) => {
  const links = getField(page, 'Links');

  await expect(links.getByRole('textbox', { name: 'Text' })).toHaveCount(2);
  await expect(links.getByRole('button', { name: /Add/ })).toHaveCount(0);
  // The item options only add items: duplicate, add above and add below
  await expect(links.getByRole('button', { name: 'List Item Options' })).toHaveCount(0);
  // The items can still be removed and reordered
  await expect(links.getByRole('button', { name: 'Reorder Item' })).toHaveCount(2);
  await links.getByRole('button', { name: 'Remove' }).nth(1).click();
  await expect(links.getByRole('textbox', { name: 'Text' })).toHaveCount(1);
  // Not even the last item removed brings back an Add button
  await links.getByRole('button', { name: 'Remove' }).click();
  await expect(links.getByText('0 Links')).toBeVisible();
  await expect(links.getByRole('button', { name: /Add/ })).toHaveCount(0);
  await save(page);

  await expect
    .poll(() => readHome(cms))
    .toBe(
      HOME.replace('  - text: Docs\n    url: /docs\n  - text: Blog\n    url: /blog\n', '').replace(
        'links:\n',
        'links: []\n',
      ),
    );
});

test('hides the Remove buttons of a list of strings that doesn’t allow removing', async ({
  cms,
  page,
}) => {
  const tags = getField(page, 'Tags');

  await expect(tags.getByRole('textbox', { name: 'Tag' })).toHaveCount(2);
  await expect(tags.getByRole('button', { name: 'Remove' })).toHaveCount(0);
  await tags.getByRole('button', { name: /Add.*Tag/ }).click();
  await tags.getByRole('textbox', { name: 'Tag' }).nth(2).fill('moon');
  await expect(tags.getByText('3 Tags')).toBeVisible();
  // The new item can’t be removed either
  await expect(tags.getByRole('button', { name: 'Remove' })).toHaveCount(0);
  await save(page);

  await expect.poll(() => readHome(cms)).toBe(HOME.replace('  - stars\n', '  - stars\n  - moon\n'));
});

test('hides the reorder handles and Duplicate of a list that allows neither', async ({
  cms,
  page,
}) => {
  const steps = getField(page, 'Steps');
  const options = steps.getByRole('button', { name: 'List Item Options' });

  await expect(steps.getByRole('textbox', { name: 'Step Name' })).toHaveCount(2);
  await expect(steps.getByRole('button', { name: 'Reorder Item' })).toHaveCount(0);
  await expect(steps.getByRole('button', { name: 'Remove' })).toHaveCount(2);

  // An item can still be added between the others
  await options.first().click();
  await expect(page.getByRole('menuitem', { name: 'Add Item Below' })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'Duplicate' })).toHaveCount(0);
  await page.getByRole('menuitem', { name: 'Add Item Below' }).click();
  await steps.getByRole('textbox', { name: 'Step Name' }).nth(1).fill('Wait for the dark');
  await expect(steps.getByRole('button', { name: 'Reorder Item' })).toHaveCount(0);
  await save(page);

  await expect
    .poll(() => readHome(cms))
    .toBe(HOME.replace('  - name: Look up\n', '  - name: Look up\n  - name: Wait for the dark\n'));
});

test('adds an item to the top of a list with types', async ({ cms, page }) => {
  const blocks = getField(page, 'Blocks');
  const add = blocks.getByRole('button', { name: /Add.*Block/ });

  // The Add button is above the items, and not repeated below them
  await expect(add).toHaveCount(1);
  await expectAbove(add, blocks.getByRole('textbox', { name: 'Body' }));

  await cms.chooseMenuItem(add, page.getByRole('menuitem', { name: 'Image' }));
  await expect(blocks.getByText('2 Blocks')).toBeVisible();
  await blocks.getByRole('textbox', { name: 'Alt Text' }).fill('A comet');
  // The new item comes first
  await expectAbove(
    blocks.getByRole('textbox', { name: 'Alt Text' }),
    blocks.getByRole('textbox', { name: 'Body' }),
  );
  await save(page);

  await expect
    .poll(() => readHome(cms))
    .toBe(HOME.replace('blocks:\n', 'blocks:\n  - type: image\n    alt: A comet\n'));
});

test('adds an item to the top of a list of strings', async ({ cms, page }) => {
  const news = getField(page, 'News');

  await expect(news.getByRole('button', { name: /Add.*Headline/ })).toHaveCount(1);
  await expectAbove(
    news.getByRole('button', { name: /Add.*Headline/ }),
    news.getByRole('textbox', { name: 'Headline' }),
  );
  await news.getByRole('button', { name: /Add.*Headline/ }).click();
  await expect(news.getByRole('textbox', { name: 'Headline' })).toHaveCount(2);
  await expect(news.getByRole('textbox', { name: 'Headline' }).nth(1)).toHaveValue('Launch day');
  await news.getByRole('textbox', { name: 'Headline' }).first().fill('Comet spotted');
  await save(page);

  await expect
    .poll(() => readHome(cms))
    .toBe(HOME.replace('  - Launch day\n', '  - Comet spotted\n  - Launch day\n'));
});

test('keeps the items of a list with types that allows no changes to them', async ({
  cms,
  page,
}) => {
  const cards = getField(page, 'Cards');

  await expect(cards.getByText('2 Cards')).toBeVisible();
  await expect(cards.getByRole('button', { name: /Add/ })).toHaveCount(0);
  await expect(cards.getByRole('button', { name: 'List Item Options' })).toHaveCount(0);
  await expect(cards.getByRole('button', { name: 'Remove' })).toHaveCount(0);
  await expect(cards.getByRole('button', { name: 'Reorder Item' })).toHaveCount(0);
  // The items are still collapsible and editable
  await expect(cards.getByRole('button', { name: 'Collapse All' })).toBeVisible();
  await cards.getByRole('textbox', { name: 'Quote Text' }).fill('Per aspera ad astra.');
  await save(page);

  await expect.poll(() => readHome(cms)).toBe(HOME.replace('Ad astra.', 'Per aspera ad astra.'));
});

test('collapses the whole list with `minimize_collapsed`', async ({ cms, page }) => {
  const gallery = getField(page, 'Gallery');
  const toggle = gallery.getByRole('button', { name: /^(Expand|Collapse)$/ }).first();

  await expect(gallery.getByText('2 Gallery')).toBeVisible();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(gallery.getByRole('textbox')).toHaveCount(0);
  await expect(gallery.getByRole('button', { name: 'Expand All' })).toHaveCount(0);

  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(gallery.getByRole('textbox', { name: 'Caption' })).toHaveCount(2);
  await toggle.click();
  await expect(gallery.getByRole('textbox')).toHaveCount(0);

  // While collapsed, the Add button is above the list, and adding an item expands it
  await gallery.getByRole('button', { name: /Add.*Photo/ }).click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(gallery.getByRole('textbox', { name: 'Caption' })).toHaveCount(3);
  await gallery.getByRole('textbox', { name: 'Caption' }).last().fill('Jupiter');
  await save(page);

  await expect
    .poll(() => readHome(cms))
    .toBe(HOME.replace('  - caption: Mars\n', '  - caption: Mars\n  - caption: Jupiter\n'));
});

test('collapses the whole list with `minimize_collapsed: auto` only if it has items', async ({
  cms,
  page,
}) => {
  const sponsors = getField(page, 'Sponsors');
  const faq = getField(page, 'FAQ');

  await expect(sponsors.getByText('1 Sponsor')).toBeVisible();
  await expect(sponsors.getByRole('textbox')).toHaveCount(0);
  await expect(
    sponsors.getByRole('button', { name: /^(Expand|Collapse)$/ }).first(),
  ).toHaveAttribute('aria-expanded', 'false');

  // The empty list is expanded, so a new item shows up right away
  await expect(faq.getByText('0 FAQ')).toBeVisible();
  await expect(faq.getByRole('button', { name: /^(Expand|Collapse)$/ }).first()).toHaveAttribute(
    'aria-expanded',
    'true',
  );
  await faq.getByRole('button', { name: /Add.*Question/ }).click();
  await faq.getByRole('textbox', { name: 'Question' }).fill('Is it free?');
  await expect(faq.getByText('1 Question')).toBeVisible();
  await save(page);

  await expect
    .poll(() => readHome(cms))
    .toBe(HOME.replace('faq: []\n', 'faq:\n  - question: Is it free?\n'));
});

test('collapses only the filled items of a list with `collapsed: auto`', async ({ page }) => {
  const features = getField(page, 'Features');

  // The first item is filled, so it’s collapsed to its summary; the empty one is open to fill in
  await expect(features.getByText('Telescopes')).toBeVisible();
  await expect(features.getByRole('textbox', { name: 'Feature Name' })).toHaveCount(1);
  await expect(features.getByRole('textbox', { name: 'Feature Name' })).toHaveValue('');
  await expect(features.getByRole('button', { name: 'Collapse All' })).toBeEnabled();
  await expect(features.getByRole('button', { name: 'Expand All' })).toBeEnabled();
});

test('collapses an object with `collapsed: auto` only if it’s filled', async ({ cms, page }) => {
  const contact = getField(page, 'Contact');
  const address = getField(page, 'Address');

  await expect(contact.getByText('hello@example.com')).toBeVisible();
  await expect(contact.getByRole('textbox')).toHaveCount(0);
  await address.getByRole('textbox', { name: 'City' }).fill('Montreal');
  await save(page);

  await expect.poll(() => readHome(cms)).toBe(HOME.replace("  city: ''\n", '  city: Montreal\n'));
});

test('offers no way to clear a list that doesn’t allow removing items', async ({ cms, page }) => {
  const tags = getField(page, 'Tags');
  const links = getField(page, 'Links');

  /**
   * Open the field options of a list, and get the Clear and Restore Default menu items.
   * @param {import('@playwright/test').Locator} field Field group.
   * @returns {Promise<{ clear: import('@playwright/test').Locator, restore:
   * import('@playwright/test').Locator }>} Menu items.
   */
  const openOptions = async (field) => {
    await field.getByRole('button', { name: 'Show Field Options' }).first().click();

    return {
      clear: page.getByRole('menuitem', { name: 'Clear' }),
      restore: page.getByRole('menuitem', { name: 'Restore Default' }),
    };
  };

  // Clearing removes every item, and restoring the default value can remove items too
  let items = await openOptions(tags);

  await expect(items.clear).toBeDisabled();
  await expect(items.restore).toBeDisabled();
  await page.keyboard.press('Escape');

  // A list that doesn’t allow adding items can be cleared, but restoring could add items
  items = await openOptions(links);
  await expect(items.clear).toBeEnabled();
  await expect(items.restore).toBeDisabled();
  await page.keyboard.press('Escape');

  // Clearing the whole entry leaves the list alone as well
  await cms.chooseMenuItem(
    page.getByRole('button', { name: 'Show Editor Options' }),
    page.getByRole('menuitem', { name: 'Clear All' }),
  );
  await page
    .getByRole('alertdialog', { name: 'Clear All' })
    .getByRole('button', { name: 'Clear All' })
    .click();
  await expect(getField(page, 'Steps').getByText('0 Steps')).toBeVisible();
  await expect(tags.getByText('2 Tags')).toBeVisible();
  await expect(tags.getByRole('textbox', { name: 'Tag' }).first()).toHaveValue('space');
});
