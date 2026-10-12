import { expect, test } from '../../fixtures/test.js';
import { getEditor } from '../../fixtures/ui.js';

/**
 * A list of authors, each with a collapsed Object field of details, whose expander states are
 * stored under the key path of the item they belong to.
 */
const CONFIG = {
  backend: { name: 'test-repo' },
  media_folder: 'static/uploads',
  collections: [
    {
      name: 'books',
      label: 'Books',
      label_singular: 'Book',
      folder: 'content/books',
      extension: 'yml',
      fields: [
        { name: 'title', label: 'Title' },
        {
          name: 'authors',
          label: 'Authors',
          label_singular: 'Author',
          widget: 'list',
          fields: [
            { name: 'name', label: 'Name' },
            {
              name: 'details',
              label: 'Details',
              widget: 'object',
              collapsed: true,
              fields: [{ name: 'bio', label: 'Bio' }],
            },
          ],
        },
      ],
    },
  ],
};

const BOOK = [
  'title: Night Sky',
  'authors:',
  '  - name: Ada',
  '    details:',
  '      bio: Astronomer',
  '  - name: Ben',
  '    details:',
  '      bio: Illustrator',
  '',
].join('\n');

test.use({ config: CONFIG, viewport: { width: 1280, height: 3000 } });

test.beforeEach(async ({ cms, page }) => {
  await cms.open();
  await cms.seed({ 'content/books/night-sky.yml': BOOK });
  await cms.signIn();
  await page.getByRole('row', { name: /Night Sky/ }).click();
});

test('keeps the state of an object in an item when the items are added or removed', async ({
  page,
}) => {
  const authors = getEditor(page).getByRole('group', { name: /Authors.*Field/ });
  const bios = authors.getByRole('textbox', { name: 'Bio' });

  await expect(authors.getByRole('textbox', { name: 'Name' })).toHaveCount(2);
  await expect(bios).toHaveCount(0);

  // Expand the details of the second author
  await authors
    .getByRole('group', { name: /Details.*Field/ })
    .nth(1)
    .getByRole('button', { name: 'Expand' })
    .click();
  await expect(bios).toHaveValue('Illustrator');

  // The other items’ details stay collapsed when an item is added
  await authors.getByRole('button', { name: /Add.*Author/ }).click();
  await expect(authors.getByRole('textbox', { name: 'Name' })).toHaveCount(3);
  await expect(bios).toHaveCount(1);
  await expect(bios).toHaveValue('Illustrator');

  // The details stay expanded as the item moves up when one before it is removed
  await authors.getByRole('button', { name: 'Remove' }).first().click();
  await expect(authors.getByRole('textbox', { name: 'Name' }).first()).toHaveValue('Ben');
  await expect(bios).toHaveCount(1);
  await expect(bios).toHaveValue('Illustrator');
});
