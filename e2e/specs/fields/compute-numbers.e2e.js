import { expect, test } from '../../fixtures/test.js';
import { getEditor } from '../../fixtures/ui.js';

/**
 * Orders whose total is computed from the price and the quantity, and whose lines are numbered from
 * 1, with Compute fields yielding numbers.
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
      slug: '{{title}}',
      fields: [
        { name: 'title', label: 'Title' },
        { name: 'price', label: 'Price', widget: 'number', value_type: 'float', required: false },
        { name: 'quantity', label: 'Quantity', widget: 'number', required: false },
        {
          name: 'total',
          label: 'Total',
          widget: 'compute',
          value_type: 'float',
          value: "{{fields.price}} * {{fields.quantity | default('1')}}",
        },
        {
          name: 'lines',
          label: 'Lines',
          widget: 'list',
          required: false,
          fields: [
            { name: 'name', label: 'Name' },
            {
              name: 'line',
              label: 'Line',
              widget: 'compute',
              value_type: 'int',
              value: '{{index}} + 1',
            },
          ],
        },
      ],
    },
  ],
};

test.use({ config: CONFIG });

test('saves the result of an arithmetic expression as a number', async ({ cms, page }) => {
  await cms.open();
  await cms.signIn();
  await page.getByRole('button', { name: 'Create New Entry' }).first().click();

  const editor = getEditor(page);

  const total = editor
    .getByRole('document', { name: 'Content Preview' })
    .getByRole('group')
    .filter({ has: page.getByRole('heading', { name: 'Total' }) });

  await editor.getByRole('textbox', { name: 'Title' }).fill('Coffee');
  await editor.getByRole('spinbutton', { name: 'Price' }).fill('1234.5');
  // The empty quantity defaults to 1 in the expression
  await expect(total.getByRole('paragraph')).toHaveText('1,234.5');
  await editor.getByRole('spinbutton', { name: 'Quantity' }).fill('3');
  // The preview formats the number like a Number field value
  await expect(total.getByRole('paragraph')).toHaveText('3,703.5');

  const lines = editor.getByRole('group', { name: /Lines/ });

  await lines.getByRole('button', { name: /^Add/ }).click();
  await lines.getByRole('textbox', { name: 'Name' }).last().fill('Beans');
  await lines.getByRole('button', { name: /^Add/ }).click();
  await lines.getByRole('textbox', { name: 'Name' }).last().fill('Filters');
  await editor.getByRole('button', { name: 'Save' }).click();

  await expect
    .poll(async () => (await cms.readRepo())['content/orders/coffee.yml'])
    .toBe(
      'title: Coffee\nprice: 1234.5\nquantity: 3\ntotal: 3703.5\nlines:\n' +
        '  - name: Beans\n    line: 1\n  - name: Filters\n    line: 2\n',
    );
});

test('leaves the result empty while an operand is empty', async ({ cms, page }) => {
  await cms.open();
  await cms.signIn();
  await page.getByRole('button', { name: 'Create New Entry' }).first().click();

  const editor = getEditor(page);

  await editor.getByRole('textbox', { name: 'Title' }).fill('Tea');
  await editor.getByRole('spinbutton', { name: 'Quantity' }).fill('2');
  await editor.getByRole('button', { name: 'Save' }).click();

  await expect
    .poll(async () => (await cms.readRepo())['content/orders/tea.yml'])
    .toBe('title: Tea\nprice: null\nquantity: 2\ntotal: null\nlines: []\n');
});

test.describe('list items', () => {
  /**
   * Invoices whose lines have an amount computed from the line’s own price and quantity, and whose
   * total adds up the amounts. The total comes before the list, so it’s resolved before the amounts
   * it adds up and has to catch up with them.
   */
  const INVOICE_CONFIG = {
    ...CONFIG,
    collections: [
      {
        ...CONFIG.collections[0],
        name: 'invoices',
        label: 'Invoices',
        label_singular: 'Invoice',
        folder: 'content/invoices',
        fields: [
          { name: 'title', label: 'Title' },
          {
            name: 'total',
            label: 'Total',
            widget: 'compute',
            value_type: 'float',
            value: 'sum({{fields.lines.*.amount}})',
          },
          {
            name: 'lines',
            label: 'Lines',
            widget: 'list',
            fields: [
              { name: 'name', label: 'Name' },
              { name: 'price', label: 'Price', widget: 'number', value_type: 'float' },
              { name: 'quantity', label: 'Quantity', widget: 'number' },
              {
                name: 'amount',
                label: 'Amount',
                widget: 'compute',
                value_type: 'float',
                value: '{{fields.lines.*.price}} * {{fields.lines.*.quantity}}',
              },
            ],
          },
        ],
      },
    ],
  };

  test.use({ config: INVOICE_CONFIG });

  test('computes each item from its own fields and adds up the items', async ({ cms, page }) => {
    await cms.open();
    await cms.signIn();
    await page.getByRole('button', { name: 'Create New Entry' }).first().click();

    const editor = getEditor(page);
    const lines = editor.getByRole('group', { name: /Lines/ });

    await editor.getByRole('textbox', { name: 'Title' }).fill('March');

    /**
     * Add a line to the invoice.
     * @param {number} index Index of the line.
     * @param {string} name Name.
     * @param {string} price Price.
     * @param {string} quantity Quantity.
     */
    const addLine = async (index, name, price, quantity) => {
      const prices = lines.getByRole('spinbutton', { name: 'Price' });

      await lines.getByRole('button', { name: /^Add/ }).click();
      // The number inputs of the new item render after its text input
      await expect(prices).toHaveCount(index + 1);
      await lines.getByRole('textbox', { name: 'Name' }).nth(index).fill(name);
      await prices.nth(index).fill(price);
      await lines.getByRole('spinbutton', { name: 'Quantity' }).nth(index).fill(quantity);
    };

    await addLine(0, 'Beans', '12.5', '2');
    await addLine(1, 'Filters', '4.25', '3');

    const total = editor
      .getByRole('document', { name: 'Content Preview' })
      .getByRole('group')
      .filter({ has: page.getByRole('heading', { name: 'Total' }) });

    await expect(total.getByRole('paragraph')).toHaveText('37.75');
    await editor.getByRole('button', { name: 'Save' }).click();

    await expect
      .poll(async () => (await cms.readRepo())['content/invoices/march.yml'])
      .toBe(
        'title: March\ntotal: 37.75\nlines:\n' +
          '  - name: Beans\n    price: 12.5\n    quantity: 2\n    amount: 25\n' +
          '  - name: Filters\n    price: 4.25\n    quantity: 3\n    amount: 12.75\n',
      );
  });
});
