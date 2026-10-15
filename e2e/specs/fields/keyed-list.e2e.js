import { expect, test } from '../../fixtures/test.js';
import { getEditor, getField, openCollection } from '../../fixtures/ui.js';

/**
 * A bibliography in the Hayagriva format, a map of citation keys to references, edited with a
 * top-level List field whose `map_key_field` option takes each key from the Citation Key subfield.
 * @see https://github.com/sveltia/sveltia-cms/issues/1077
 */
const CONFIG = {
  backend: { name: 'test-repo' },
  media_folder: 'static/uploads',
  collections: [
    {
      name: 'data',
      label: 'Data',
      files: [
        {
          name: 'bibliography',
          label: 'Bibliography',
          file: 'data/refs.yml',
          fields: [
            {
              name: 'references',
              label: 'References',
              label_singular: 'Reference',
              widget: 'list',
              root: true,
              map_key_field: 'key',
              fields: [
                { name: 'key', label: 'Citation Key' },
                { name: 'type', label: 'Type' },
                { name: 'title', label: 'Title' },
              ],
            },
          ],
        },
      ],
    },
  ],
};

const PATH = 'data/refs.yml';

const FILE = `harry:
  type: Book
  title: Harry Potter and the Order of the Phoenix
electronic:
  type: Web
  title: Ishkur’s Guide to Electronic Music
`;

// The editor renders a field once it’s scrolled into view, so make every field visible at once
test.use({ config: CONFIG, viewport: { width: 1280, height: 3000 } });

/**
 * Get the values of the text boxes with the given name in a field, in order.
 * @param {import('@playwright/test').Locator} field Field group.
 * @param {string} name Text box name.
 * @returns {Promise<string[]>} Values.
 */
const getValues = async (field, name) =>
  Promise.all((await field.getByRole('textbox', { name }).all()).map((box) => box.inputValue()));

/**
 * Sign in, and open the bibliography saved with the given content.
 * @param {object} args Arguments.
 * @param {import('../../fixtures/test.js').CMS} args.cms CMS.
 * @param {import('@playwright/test').Page} args.page Page.
 * @param {string} args.content Content of the bibliography file.
 * @returns {Promise<import('@playwright/test').Locator>} References field.
 */
const openBibliography = async ({ cms, page, content }) => {
  await cms.open();
  await cms.seed({ [PATH]: content });
  await cms.signIn();
  await page.getByRole('row', { name: /Bibliography/ }).click();

  return getField(page, 'References');
};

test('edits the references stored as a map, keeping their order', async ({ cms, page }) => {
  const references = await openBibliography({ cms, page, content: FILE });

  await expect.poll(() => getValues(references, 'Citation Key')).toEqual(['harry', 'electronic']);
  await expect
    .poll(() => getValues(references, 'Title'))
    .toEqual(['Harry Potter and the Order of the Phoenix', 'Ishkur’s Guide to Electronic Music']);

  await references.getByRole('textbox', { name: 'Citation Key' }).first().fill('potter');
  await references.getByRole('button', { name: /Add.*Reference/ }).click();
  await references.getByRole('textbox', { name: 'Citation Key' }).nth(2).fill('zola');
  await references.getByRole('textbox', { name: 'Type' }).nth(2).fill('Web');
  await references.getByRole('textbox', { name: 'Title' }).nth(2).fill('Zola');
  await getEditor(page).getByRole('button', { name: 'Save' }).click();

  // The keys are the map keys, not properties of the items, and no `references` key wraps the map
  await expect
    .poll(async () => (await cms.readRepo())[PATH])
    .toBe(`${FILE.replace('harry:', 'potter:')}zola:\n  type: Web\n  title: Zola\n`);
});

test('refuses a missing, duplicate or numeric key', async ({ cms, page }) => {
  const references = await openBibliography({ cms, page, content: FILE });
  const editor = getEditor(page);
  const keys = references.getByRole('group', { name: /Citation Key/ });

  await references.getByRole('button', { name: /Add.*Reference/ }).click();
  await references.getByRole('textbox', { name: 'Type' }).nth(2).fill('Book');
  await references.getByRole('textbox', { name: 'Title' }).nth(2).fill('Untitled');
  await editor.getByRole('button', { name: 'Save' }).click();

  await expect(page.getByRole('alert').filter({ hasText: /One field has an error/ })).toBeVisible();
  await expect(keys.nth(2).getByRole('alert')).toContainText('This field is required.');

  // A key used for another item is marked on both items, until one of them is changed
  await references.getByRole('textbox', { name: 'Citation Key' }).nth(2).fill('harry');
  await expect(keys.nth(0).getByRole('alert')).toContainText('This key is used for another item.');
  await expect(keys.nth(2).getByRole('alert')).toContainText('This key is used for another item.');

  await references.getByRole('textbox', { name: 'Citation Key' }).nth(2).fill('2024');
  await expect(keys.nth(0).getByRole('alert')).toHaveCount(0);
  await expect(keys.nth(2).getByRole('alert')).toContainText('The key can’t be a whole number');

  await references.getByRole('textbox', { name: 'Citation Key' }).nth(2).fill('untitled2024');
  await expect(keys.nth(2).getByRole('alert')).toHaveCount(0);
  await editor.getByRole('button', { name: 'Save' }).click();

  await expect
    .poll(async () => (await cms.readRepo())[PATH])
    .toBe(`${FILE}untitled2024:\n  type: Book\n  title: Untitled\n`);
});

test('saves references still stored as an array as a map', async ({ cms, page }) => {
  const references = await openBibliography({
    cms,
    page,
    content: '- key: harry\n  type: Book\n  title: Harry\n- key: ron\n  type: Book\n  title: Ron\n',
  });

  await expect.poll(() => getValues(references, 'Citation Key')).toEqual(['harry', 'ron']);
  await references.getByRole('textbox', { name: 'Title' }).nth(1).fill('Ronald');
  await getEditor(page).getByRole('button', { name: 'Save' }).click();

  await expect
    .poll(async () => (await cms.readRepo())[PATH])
    .toBe('harry:\n  type: Book\n  title: Harry\nron:\n  type: Book\n  title: Ronald\n');
});

/**
 * Site settings holding a map of page slugs to page settings, keyed with a Relation field, and a
 * map of sizes to prices, keyed with a Select field.
 * @see https://github.com/sveltia/sveltia-cms/issues/1082
 */
test.describe('keys picked from options', () => {
  const SETTINGS_PATH = 'data/settings.yml';

  test.use({
    config: {
      backend: { name: 'test-repo' },
      media_folder: 'static/uploads',
      collections: [
        {
          name: 'pages',
          label: 'Pages',
          folder: 'content/pages',
          extension: 'yml',
          identifier_field: 'title',
          fields: [{ name: 'title', label: 'Title' }],
        },
        {
          name: 'data',
          label: 'Data',
          files: [
            {
              name: 'settings',
              label: 'Settings',
              file: SETTINGS_PATH,
              fields: [
                {
                  name: 'pages',
                  label: 'Page Settings',
                  label_singular: 'Page Setting',
                  widget: 'list',
                  map_key_field: 'page',
                  fields: [
                    {
                      name: 'page',
                      label: 'Page',
                      widget: 'relation',
                      collection: 'pages',
                      value_field: '{{slug}}',
                      search_fields: ['title'],
                      display_fields: ['title'],
                      // Show the options as radio buttons
                      dropdown_threshold: 10,
                    },
                    { name: 'xyz', label: 'XYZ' },
                  ],
                },
                {
                  name: 'sizes',
                  label: 'Sizes',
                  label_singular: 'Size',
                  widget: 'list',
                  map_key_field: 'size',
                  fields: [
                    {
                      name: 'size',
                      label: 'Size',
                      widget: 'select',
                      options: [
                        { label: 'Small', value: 'small' },
                        { label: 'Large', value: 'large' },
                      ],
                    },
                    { name: 'price', label: 'Price' },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  });

  const SETTINGS = `pages:
  page1:
    xyz: test
  page2:
    xyz: test2
sizes:
  small:
    price: '10'
`;

  /**
   * Sign in with the pages and the settings, and open the settings.
   * @param {object} args Arguments.
   * @param {import('../../fixtures/test.js').CMS} args.cms CMS.
   * @param {import('@playwright/test').Page} args.page Page.
   * @returns {Promise<{ pages: import('@playwright/test').Locator, sizes:
   * import('@playwright/test').Locator }>} Page Settings and Sizes fields.
   */
  const openSettings = async ({ cms, page }) => {
    await cms.open();
    await cms.seed({
      'content/pages/page1.yml': 'title: Home\n',
      'content/pages/page2.yml': 'title: About\n',
      'content/pages/page3.yml': 'title: Contact\n',
      [SETTINGS_PATH]: SETTINGS,
    });
    await cms.signIn();
    await (await openCollection(page, 'Data')).getByRole('row', { name: /Settings/ }).click();

    return { pages: getField(page, 'Page Settings'), sizes: getField(page, 'Sizes') };
  };

  /**
   * Get the radio button of an option in the given item of a field.
   * @param {import('@playwright/test').Locator} field List field.
   * @param {string} label Key subfield label.
   * @param {number} index Item index.
   * @param {string} name Option label.
   * @returns {import('@playwright/test').Locator} Radio button.
   */
  const getOption = (field, label, index, name) =>
    field
      .getByRole('radiogroup', { name: label, exact: true })
      .nth(index)
      .getByRole('radio', { name, exact: true });

  test('loads and saves the keys picked with Relation and Select fields', async ({ cms, page }) => {
    const { pages, sizes } = await openSettings({ cms, page });

    await expect(getOption(pages, 'Page', 0, 'Home')).toBeChecked();
    await expect(getOption(pages, 'Page', 1, 'About')).toBeChecked();
    await expect(getOption(sizes, 'Size', 0, 'Small')).toBeChecked();

    await getOption(pages, 'Page', 1, 'Contact').click();
    await pages.getByRole('button', { name: /Add.*Page Setting/ }).click();
    await getOption(pages, 'Page', 2, 'About').click();
    await pages.getByRole('textbox', { name: 'XYZ' }).nth(2).fill('test3');
    await sizes.getByRole('button', { name: /Add.*Size/ }).click();
    await getOption(sizes, 'Size', 1, 'Large').click();
    await sizes.getByRole('textbox', { name: 'Price' }).nth(1).fill('15');
    await getEditor(page).getByRole('button', { name: 'Save' }).click();

    await expect
      .poll(async () => (await cms.readRepo())[SETTINGS_PATH])
      .toBe(
        'pages:\n  page1:\n    xyz: test\n  page3:\n    xyz: test2\n  page2:\n    xyz: test3\n' +
          "sizes:\n  small:\n    price: '10'\n  large:\n    price: '15'\n",
      );
  });

  test('refuses a page picked for another item', async ({ cms, page }) => {
    const { pages } = await openSettings({ cms, page });
    const keys = pages.getByRole('group', { name: /Page.*Field/ });

    await getOption(pages, 'Page', 1, 'Home').click();
    await getEditor(page).getByRole('button', { name: 'Save' }).click();

    await expect(keys.nth(0).getByRole('alert')).toContainText(
      'This key is used for another item.',
    );
    await expect(keys.nth(1).getByRole('alert')).toContainText(
      'This key is used for another item.',
    );

    await getOption(pages, 'Page', 1, 'Contact').click();
    await expect(keys.nth(1).getByRole('alert')).toHaveCount(0);
  });
});
