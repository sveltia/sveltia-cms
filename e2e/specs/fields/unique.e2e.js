import { expect, test } from '../../fixtures/test.js';
import { getEditor } from '../../fixtures/ui.js';

/**
 * Products whose SKU, description, position in the catalog, shelf and notes must each differ from
 * those of every other product, like the `UNIQUE` columns of a database table.
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
      slug: '{{sku}}',
      identifier_field: 'name',
      fields: [
        { name: 'name', label: 'Name' },
        { name: 'sku', label: 'SKU', unique: true },
        { name: 'summary', label: 'Summary', widget: 'text', unique: true, required: false },
        { name: 'position', label: 'Position', widget: 'number', unique: true, required: false },
        {
          name: 'shelf',
          label: 'Shelf',
          widget: 'select',
          options: ['top', 'middle', 'bottom'],
          unique: true,
          required: false,
        },
        { name: 'notes', label: 'Notes', widget: 'markdown', unique: true, required: false },
      ],
    },
  ],
};

const FILES = {
  'content/products/mug.yml':
    'name: Mug\nsku: MUG-1\nsummary: A mug.\nposition: 1\nshelf: top\nnotes: Fragile.\n',
  'content/products/cup.yml': 'name: Cup\nsku: CUP-1\nsummary: A cup.\nposition: 2\n',
};

const DUPLICATE_MESSAGE = 'This value is used for another entry.';

test.use({ config: CONFIG });

test.beforeEach(async ({ cms }) => {
  await cms.open();
  await cms.seed(FILES);
  await cms.signIn();
});

test('refuses to save a new product taking the values of another one', async ({ cms, page }) => {
  await page.getByRole('button', { name: 'Create New Entry' }).first().click();

  const editor = getEditor(page);

  await editor.getByRole('textbox', { name: 'Name' }).fill('Bowl');
  await editor.getByRole('textbox', { name: 'SKU' }).fill('MUG-1');
  await editor.getByRole('textbox', { name: 'Summary' }).fill('A cup.');
  await editor.getByRole('spinbutton', { name: 'Position' }).fill('2');
  await editor.getByRole('button', { name: 'Save' }).click();

  await expect(page.getByRole('alert').filter({ hasText: /3 fields have errors/ })).toBeVisible();

  await Promise.all(
    ['SKU', 'Summary', 'Position'].map((name) =>
      expect(
        editor.getByRole('group', { name: new RegExp(name) }).getByRole('alert'),
      ).toContainText(DUPLICATE_MESSAGE),
    ),
  );

  // The errors follow the edits, and the product can be saved once every value is its own
  await editor.getByRole('textbox', { name: 'SKU' }).fill('BOWL-1');
  await expect(editor.getByRole('group', { name: /SKU/ }).getByRole('alert')).toHaveCount(0);
  await editor.getByRole('textbox', { name: 'Summary' }).fill('A bowl.');
  await editor.getByRole('spinbutton', { name: 'Position' }).fill('3');
  await editor.getByRole('button', { name: 'Save' }).click();

  await expect
    .poll(async () => (await cms.readRepo())['content/products/bowl-1.yml'])
    .toBe('name: Bowl\nsku: BOWL-1\nsummary: A bowl.\nposition: 3\n');
});

test('saves a product keeping its own values', async ({ cms, page }) => {
  await page.getByRole('row', { name: /Mug/ }).click();

  const editor = getEditor(page);

  await editor.getByRole('textbox', { name: 'Name' }).fill('Large Mug');
  await editor.getByRole('button', { name: 'Save' }).click();

  await expect
    .poll(async () => (await cms.readRepo())['content/products/mug.yml'])
    .toBe(FILES['content/products/mug.yml'].replace('Mug\n', 'Large Mug\n'));
});

test('refuses to save a product taking the SKU of another one', async ({ cms, page }) => {
  await page.getByRole('row', { name: /Mug/ }).click();

  const editor = getEditor(page);

  await editor.getByRole('textbox', { name: 'SKU' }).fill('CUP-1');
  await editor.getByRole('button', { name: 'Save' }).click();

  await expect(page.getByRole('alert').filter({ hasText: /One field has an error/ })).toBeVisible();
  await expect(editor.getByRole('group', { name: /SKU/ }).getByRole('alert')).toContainText(
    DUPLICATE_MESSAGE,
  );
  expect((await cms.readRepo())['content/products/mug.yml']).toBe(
    FILES['content/products/mug.yml'],
  );
});

test('refuses to save a product taking the shelf or notes of another one', async ({
  cms,
  page,
}) => {
  await page.getByRole('row', { name: /Cup/ }).click();

  const editor = getEditor(page);
  const shelf = editor.getByRole('radiogroup', { name: 'Shelf' });

  await shelf.getByRole('radio', { name: 'top' }).click();
  await editor.getByRole('textbox', { name: 'Notes' }).click();
  await page.keyboard.type('Fragile.');
  await editor.getByRole('button', { name: 'Save' }).click();

  await expect(page.getByRole('alert').filter({ hasText: /2 fields have errors/ })).toBeVisible();
  await expect(editor.getByRole('group', { name: /Shelf/ }).getByRole('alert')).toContainText(
    DUPLICATE_MESSAGE,
  );
  await expect(editor.getByRole('group', { name: /Notes/ }).getByRole('alert')).toContainText(
    DUPLICATE_MESSAGE,
  );

  await shelf.getByRole('radio', { name: 'bottom' }).click();
  await editor.getByRole('textbox', { name: 'Notes' }).click();
  await page.keyboard.type(' Handle with care.');
  await editor.getByRole('button', { name: 'Save' }).click();

  await expect
    .poll(async () => (await cms.readRepo())['content/products/cup.yml'])
    .toContain('shelf: bottom\nnotes: Fragile. Handle with care.\n');
});
