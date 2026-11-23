import { expect, test } from '../../fixtures/test.js';
import { getEditor } from '../../fixtures/ui.js';

/**
 * @import { Locator, Page } from '@playwright/test';
 */

/**
 * Products with a Number, a Select and a Compute field, and orders referring to a product with a
 * Relation field whose `value_field` template combines the Select and Number fields. A reference
 * and a computed value are made of the values as stored, not as they are shown: a number without
 * thousands separators, and a Select option’s value rather than its label.
 */
const CONFIG = {
  backend: { name: 'test-repo' },
  media_folder: 'static/uploads',
  collections: [
    {
      name: 'orders',
      label: 'Orders',
      label_singular: 'Order',
      folder: 'content/orders',
      extension: 'yml',
      create: true,
      fields: [
        { name: 'title', label: 'Title' },
        {
          name: 'product',
          label: 'Product',
          widget: 'relation',
          collection: 'products',
          value_field: '{{cat}}-{{sku}}',
          display_fields: ['{{title}} ({{cat}}, {{sku}})'],
          search_fields: ['title'],
          dropdown_threshold: 10,
        },
      ],
    },
    {
      name: 'products',
      label: 'Products',
      label_singular: 'Product',
      folder: 'content/products',
      extension: 'yml',
      create: true,
      fields: [
        { name: 'title', label: 'Title' },
        { name: 'sku', label: 'SKU', widget: 'number' },
        {
          name: 'cat',
          label: 'Category',
          widget: 'select',
          options: [
            { label: 'Books', value: 'b' },
            { label: 'Music', value: 'm' },
          ],
        },
        { name: 'permalink', label: 'Permalink', widget: 'compute', value: '/p/{{fields.sku}}' },
      ],
    },
  ],
};

const NOVEL_PATH = 'content/products/novel.yml';
const ORDER_PATH = 'content/orders/first.yml';

test.use({ config: CONFIG });

/**
 * Sign in with a product, and an order if given, in the repository.
 * @param {object} args Arguments.
 * @param {import('../../fixtures/test.js').CMS} args.cms CMS.
 * @param {string} [args.order] Content of the order file.
 */
const signIn = async ({ cms, order }) => {
  await cms.open();
  await cms.seed({
    [NOVEL_PATH]: 'title: Novel\nsku: 123456\ncat: b\npermalink: /p/old\n',
    'content/products/album.yml': 'title: Album\nsku: 42\ncat: m\npermalink: /p/42\n',
    ...(order ? { [ORDER_PATH]: order } : {}),
  });
  await cms.signIn();
};

/**
 * Get the radio buttons of the Product field.
 * @param {Page} page Page.
 * @returns {Locator} Radio buttons.
 */
const getProductOptions = (page) =>
  getEditor(page).getByRole('radiogroup', { name: 'Product', exact: true }).getByRole('radio');

test('refers to a product by its stored values, showing the display values', async ({
  cms,
  page,
}) => {
  await signIn({ cms });
  await page.getByRole('button', { name: 'Create New Entry' }).first().click();
  await getEditor(page).getByRole('textbox', { name: 'Title' }).fill('First');

  // The labels show the Select option label and the formatted number
  await expect(getProductOptions(page)).toHaveCount(2);
  await expect(getProductOptions(page).nth(0)).toHaveAccessibleName('Album (Music, 42)');
  await expect(getProductOptions(page).nth(1)).toHaveAccessibleName('Novel (Books, 123,456)');

  await getProductOptions(page).nth(1).click();
  await getEditor(page).getByRole('button', { name: 'Save' }).click();

  await expect
    .poll(async () => (await cms.readRepo())[ORDER_PATH])
    .toBe('title: First\nproduct: b-123456\n');
});

test('shows the product an existing order refers to by its stored values', async ({
  cms,
  page,
}) => {
  await signIn({ cms, order: 'title: First\nproduct: b-123456\n' });
  await page.getByRole('row', { name: /First/ }).click();

  await expect(getProductOptions(page).nth(1)).toHaveAccessibleName('Novel (Books, 123,456)');
  await expect(getProductOptions(page).nth(1)).toBeChecked();
});

test('computes a value from a stored number, without thousands separators', async ({
  cms,
  page,
}) => {
  await signIn({ cms });
  await page.evaluate(() => {
    window.location.hash = '#/collections/products';
  });
  await page.getByRole('row', { name: /Novel/ }).click();
  await getEditor(page).getByRole('textbox', { name: 'Title' }).fill('Novel Edition');
  await getEditor(page).getByRole('button', { name: 'Save' }).click();

  await expect
    .poll(async () => (await cms.readRepo())[NOVEL_PATH])
    .toBe('title: Novel Edition\nsku: 123456\ncat: b\npermalink: /p/123456\n');
});
