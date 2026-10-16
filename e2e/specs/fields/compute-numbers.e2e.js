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
