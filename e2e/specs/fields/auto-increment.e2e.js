import { expect, test } from '../../fixtures/test.js';
import { getEditor } from '../../fixtures/ui.js';

/**
 * Invoices numbered automatically on save, like the `AUTO_INCREMENT` column of a database table,
 * and named after their numbers.
 */
const CONFIG = {
  backend: { name: 'test-repo' },
  media_folder: 'static/uploads',
  collections: [
    {
      name: 'invoices',
      label: 'Invoices',
      label_singular: 'Invoice',
      folder: 'content/invoices',
      extension: 'yml',
      create: true,
      slug: '{{number}}',
      identifier_field: 'customer',
      fields: [
        { name: 'number', label: 'Number', widget: 'number', auto_increment: true },
        { name: 'customer', label: 'Customer' },
      ],
    },
  ],
};

const FILES = {
  'content/invoices/7.yml': 'number: 7\ncustomer: Acme\n',
  'content/invoices/3.yml': 'number: 3\ncustomer: Globex\n',
  'content/invoices/initech.yml': 'customer: Initech\n',
};

test.use({ config: CONFIG });

test.beforeEach(async ({ cms }) => {
  await cms.open();
  await cms.seed(FILES);
  await cms.signIn();
});

test('numbers a new invoice after the highest number', async ({ cms, page }) => {
  await page.getByRole('button', { name: 'Create New Entry' }).first().click();

  const editor = getEditor(page);

  // The number is assigned on save, so there is nothing to fill in
  await expect(editor.getByRole('spinbutton', { name: 'Number' })).toBeHidden();
  await editor.getByRole('textbox', { name: 'Customer' }).fill('Umbrella');
  await editor.getByRole('button', { name: 'Save' }).click();

  await expect
    .poll(async () => (await cms.readRepo())['content/invoices/8.yml'])
    .toBe('number: 8\ncustomer: Umbrella\n');
});

test('keeps the number of an existing invoice, which can’t be edited', async ({ cms, page }) => {
  await page.getByRole('row', { name: /Globex/ }).click();

  const editor = getEditor(page);
  const number = editor.getByRole('spinbutton', { name: 'Number' });

  await expect(number).toHaveValue('3');
  await expect(number).toHaveAttribute('readonly');
  await editor.getByRole('textbox', { name: 'Customer' }).fill('Globex Corporation');
  await editor.getByRole('button', { name: 'Save' }).click();

  await expect
    .poll(async () => (await cms.readRepo())['content/invoices/3.yml'])
    .toBe('number: 3\ncustomer: Globex Corporation\n');
});

test('numbers an existing invoice saved without a number', async ({ cms, page }) => {
  await page.getByRole('row', { name: /Initech/ }).click();

  const editor = getEditor(page);

  await editor.getByRole('textbox', { name: 'Customer' }).fill('Initech LLC');
  await editor.getByRole('button', { name: 'Save' }).click();

  await expect
    .poll(async () => (await cms.readRepo())['content/invoices/initech.yml'])
    .toBe('number: 8\ncustomer: Initech LLC\n');
});
