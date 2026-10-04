import { expect, test } from '../../fixtures/test.js';

/**
 * Products whose Select field has a number and a string option that stringify alike, each with a
 * label of its own, shown in the entry summary.
 */
const CONFIG = {
  backend: { name: 'test-repo' },
  media_folder: 'static/uploads',
  collections: [
    {
      name: 'products',
      label: 'Products',
      label_singular: 'Product',
      folder: 'content/products',
      extension: 'yml',
      summary: '{{title}}: {{fields.size}}',
      fields: [
        { name: 'title', label: 'Title' },
        {
          name: 'size',
          label: 'Size',
          widget: 'select',
          options: [
            { label: 'Small', value: 1 },
            { label: 'Custom', value: '1' },
          ],
        },
      ],
    },
  ],
};

test.use({ config: CONFIG });

test('shows the label of each option in the entry summary', async ({ cms, page }) => {
  await cms.open();
  await cms.seed({
    'content/products/cup.yml': 'title: Cup\nsize: 1\n',
    'content/products/mug.yml': "title: Mug\nsize: '1'\n",
  });
  await cms.signIn();

  const rows = page.getByRole('grid', { name: 'Entries' }).getByRole('row');

  await expect(rows.filter({ hasText: 'Cup' })).toContainText('Cup: Small');
  await expect(rows.filter({ hasText: 'Mug' })).toContainText('Mug: Custom');
});
