import { expect, test } from '../../fixtures/test.js';
import { getEditor, getField } from '../../fixtures/ui.js';

/**
 * A shop whose products have KeyValue fields with the options that shape the editor: the
 * `key_label` and `value_label` of the columns, `label_singular` for the Add button, `min` and
 * `max` pairs, and `default` pairs. A file of redirects holds a single KeyValue field with the
 * `root` option, which saves the pairs at the top level of the file.
 */
const CONFIG = {
  backend: { name: 'test-repo' },
  media_folder: 'static/uploads',
  output: { omit_empty_optional_fields: true },
  collections: [
    {
      name: 'products',
      label: 'Products',
      label_singular: 'Product',
      folder: 'content/products',
      extension: 'yml',
      create: true,
      fields: [
        { name: 'title', label: 'Title' },
        {
          name: 'specs',
          label: 'Specifications',
          label_singular: 'Spec',
          widget: 'keyvalue',
          key_label: 'Property',
          value_label: 'Detail',
          min: 2,
          max: 3,
          required: false,
        },
        {
          name: 'care',
          label: 'Care',
          widget: 'keyvalue',
          default: { wash: 'cold', dry: 'flat' },
          required: false,
        },
      ],
    },
    {
      name: 'settings',
      label: 'Settings',
      files: [
        {
          name: 'redirects',
          label: 'Redirects',
          file: 'data/redirects.json',
          fields: [
            {
              name: 'redirects',
              label: 'Redirects',
              widget: 'keyvalue',
              key_label: 'From',
              value_label: 'To',
              root: true,
            },
          ],
        },
      ],
    },
  ],
};

const SCARF_PATH = 'content/products/scarf.yml';

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
 * Sign in, and start a new product with its title filled in.
 * @param {object} args Arguments.
 * @param {import('../../fixtures/test.js').CMS} args.cms CMS.
 * @param {import('@playwright/test').Page} args.page Page.
 */
const createScarf = async ({ cms, page }) => {
  await cms.open();
  await cms.signIn();
  await page.getByRole('button', { name: 'Create New Entry' }).first().click();
  await getEditor(page).getByRole('textbox', { name: 'Title' }).fill('Scarf');
};

/**
 * Sign in, and open a product saved with the given content.
 * @param {object} args Arguments.
 * @param {import('../../fixtures/test.js').CMS} args.cms CMS.
 * @param {import('@playwright/test').Page} args.page Page.
 * @param {string} args.content Content of the product file.
 */
const openScarf = async ({ cms, page, content }) => {
  await cms.open();
  await cms.seed({ [SCARF_PATH]: content });
  await cms.signIn();
  await page.getByRole('row', { name: /Scarf/ }).click();
};

/**
 * Click Save, and wait for the product file to be written.
 * @param {object} args Arguments.
 * @param {import('../../fixtures/test.js').CMS} args.cms CMS.
 * @param {import('@playwright/test').Page} args.page Page.
 * @param {string} args.content Content expected in the product file.
 */
const expectSaved = async ({ cms, page, content }) => {
  await getEditor(page).getByRole('button', { name: 'Save' }).click();
  await expect.poll(async () => (await cms.readRepo())[SCARF_PATH]).toBe(content);
};

test.describe('`key_label`, `value_label` and `label_singular` options', () => {
  test('name the columns, the inputs and the Add button, and aren’t saved', async ({
    cms,
    page,
  }) => {
    await createScarf({ cms, page });

    const specs = getField(page, 'Specifications');

    await expect(specs.getByRole('columnheader', { name: 'Property' })).toBeVisible();
    await expect(specs.getByRole('columnheader', { name: 'Detail' })).toBeVisible();
    await expect(specs.getByRole('button', { name: /Add.*Spec/ })).toBeVisible();

    // A field without them gets the default labels, and its own label on the Add button
    const care = getField(page, 'Care');

    await expect(care.getByRole('columnheader', { name: 'Key', exact: true })).toBeVisible();
    await expect(care.getByRole('columnheader', { name: 'Value', exact: true })).toBeVisible();
    await expect(care.getByRole('button', { name: /Add.*Care/ })).toBeVisible();

    await specs.getByRole('textbox', { name: 'Property' }).fill('material');
    await specs.getByRole('textbox', { name: 'Detail' }).fill('wool');
    // Enter in the last value adds a pair and moves to its key
    await specs.getByRole('textbox', { name: 'Detail' }).press('Enter');
    await expect(specs.getByRole('textbox', { name: 'Property' }).nth(1)).toBeFocused();
    await page.keyboard.type('length');
    await specs.getByRole('textbox', { name: 'Detail' }).nth(1).fill('180 cm');

    // The preview labels its columns the same way
    const preview = page.getByRole('document', { name: 'Content Preview' });

    await expect(preview.getByRole('columnheader', { name: 'Property' })).toBeVisible();
    await expect(preview.getByRole('cell', { name: '180 cm' })).toBeVisible();

    await expectSaved({
      cms,
      page,
      content:
        'title: Scarf\nspecs:\n  material: wool\n  length: 180 cm\ncare:\n  wash: cold\n' +
        '  dry: flat\n',
    });
  });
});

test.describe('`min` and `max` options', () => {
  test('refuse fewer pairs than the minimum', async ({ cms, page }) => {
    await createScarf({ cms, page });

    const specs = getField(page, 'Specifications');

    await specs.getByRole('textbox', { name: 'Property' }).fill('material');
    await specs.getByRole('textbox', { name: 'Detail' }).fill('wool');
    await getEditor(page).getByRole('button', { name: 'Save' }).click();
    await expect(
      page.getByRole('alert').filter({ hasText: /One field has an error/ }),
    ).toBeVisible();
    await expect(specs.getByRole('alert')).toContainText('You must add at least 2 items.');
    expect((await cms.readRepo())[SCARF_PATH]).toBeUndefined();

    // The error follows the edit, without another save
    await specs.getByRole('button', { name: /Add.*Spec/ }).click();
    await specs.getByRole('textbox', { name: 'Property' }).nth(1).fill('length');
    await specs.getByRole('textbox', { name: 'Detail' }).nth(1).fill('180 cm');
    await expect(specs.getByRole('alert')).toHaveCount(0);

    await expectSaved({
      cms,
      page,
      content:
        'title: Scarf\nspecs:\n  material: wool\n  length: 180 cm\ncare:\n  wash: cold\n' +
        '  dry: flat\n',
    });
  });

  test('accept no pairs at all in an optional field', async ({ cms, page }) => {
    await createScarf({ cms, page });

    // The blank row isn’t a pair, so the minimum doesn’t apply to it
    await expectSaved({
      cms,
      page,
      content: 'title: Scarf\ncare:\n  wash: cold\n  dry: flat\n',
    });
  });

  test('stop adding pairs at the maximum', async ({ cms, page }) => {
    // The Care pairs saved keep the default ones out
    await openScarf({
      cms,
      page,
      content:
        'title: Scarf\nspecs:\n  material: wool\n  length: 180 cm\n  width: 30 cm\ncare:\n' +
        '  iron: low\n',
    });

    const specs = getField(page, 'Specifications');

    await expect(specs.getByRole('textbox', { name: 'Property' })).toHaveCount(3);
    // The Add button is hidden rather than disabled, and Enter doesn’t add a pair either
    await expect(specs.getByRole('button', { name: /Add.*Spec/ })).toHaveCount(0);
    await specs.getByRole('textbox', { name: 'Detail' }).last().press('Enter');
    await expect(specs.getByRole('textbox', { name: 'Property' })).toHaveCount(3);

    // Removing a pair brings the button back
    await specs.getByRole('button', { name: 'Remove' }).first().click();
    await expect(specs.getByRole('button', { name: /Add.*Spec/ })).toBeVisible();
    await expect.poll(() => getValues(specs, 'Property')).toEqual(['length', 'width']);

    await expectSaved({
      cms,
      page,
      content: 'title: Scarf\nspecs:\n  length: 180 cm\n  width: 30 cm\ncare:\n  iron: low\n',
    });
  });
});

test.describe('`default` option', () => {
  test('fills in a new entry with the default pairs', async ({ cms, page }) => {
    await createScarf({ cms, page });

    const care = getField(page, 'Care');

    await expect.poll(() => getValues(care, 'Key')).toEqual(['wash', 'dry']);
    await expect.poll(() => getValues(care, 'Value')).toEqual(['cold', 'flat']);

    // The pairs can be edited like any other
    await care.getByRole('textbox', { name: 'Value' }).last().fill('tumble');
    await expectSaved({
      cms,
      page,
      content: 'title: Scarf\ncare:\n  wash: cold\n  dry: tumble\n',
    });
  });

  test('fills in an entry saved before the field was added', async ({ cms, page }) => {
    await openScarf({ cms, page, content: 'title: Scarf\n' });

    const care = getField(page, 'Care');

    // A field the file doesn’t hold gets the default pairs, like in a new entry
    await expect.poll(() => getValues(care, 'Key')).toEqual(['wash', 'dry']);

    await getEditor(page).getByRole('textbox', { name: 'Title' }).fill('Wool Scarf');
    await expectSaved({
      cms,
      page,
      content: 'title: Wool Scarf\ncare:\n  wash: cold\n  dry: flat\n',
    });
  });
});

test.describe('`root` option', () => {
  test('reads and saves the pairs at the top level of the file', async ({ cms, page }) => {
    await cms.open();
    await cms.seed({ 'data/redirects.json': '{\n  "/old": "/new"\n}\n' });
    await cms.signIn();
    await page.getByRole('treeitem', { name: 'Settings' }).click();
    await page.getByRole('row', { name: /Redirects/ }).click();

    const redirects = getField(page, 'Redirects');

    await expect.poll(() => getValues(redirects, 'From')).toEqual(['/old']);
    await expect.poll(() => getValues(redirects, 'To')).toEqual(['/new']);

    await redirects.getByRole('button', { name: /Add.*Redirects/ }).click();
    await redirects.getByRole('textbox', { name: 'From' }).nth(1).fill('/blog');
    await redirects.getByRole('textbox', { name: 'To' }).nth(1).fill('/posts');
    await getEditor(page).getByRole('button', { name: 'Save' }).click();

    // No `redirects` key wraps the pairs
    await expect
      .poll(async () => (await cms.readRepo())['data/redirects.json'])
      .toBe('{\n  "/old": "/new",\n  "/blog": "/posts"\n}\n');
  });
});
