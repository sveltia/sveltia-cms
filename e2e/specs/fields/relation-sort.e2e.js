import { expect, test } from '../../fixtures/test.js';
import { expectRadioOptions, getEditor, pickRadioOption } from '../../fixtures/ui.js';

/**
 * @import { Page } from '@playwright/test';
 * @import { CMS } from '../../fixtures/test.js';
 */

/**
 * Options shared by the Relation fields referring to a book. Up to 10 options are shown as radio
 * buttons, which makes the options offered easy to list.
 */
const BOOK_RELATION = {
  widget: 'relation',
  collection: 'books',
  value_field: '{{slug}}',
  search_fields: ['title'],
  display_fields: ['title'],
  dropdown_threshold: 10,
  required: false,
};

/**
 * A reading list picking books with Relation fields sorted with the `sort_by` option, and series
 * ordered by hand, which a Relation field without the option follows.
 */
const CONFIG = {
  backend: { name: 'test-repo' },
  media_folder: 'static/uploads',
  output: { omit_empty_optional_fields: true },
  collections: [
    {
      name: 'lists',
      label: 'Reading Lists',
      label_singular: 'Reading List',
      folder: 'content/lists',
      extension: 'yml',
      create: true,
      fields: [
        { name: 'title', label: 'Title' },
        { ...BOOK_RELATION, name: 'default', label: 'By Title' },
        { ...BOOK_RELATION, name: 'oldest', label: 'Oldest', sort_by: { field: 'year' } },
        {
          ...BOOK_RELATION,
          name: 'newest',
          label: 'Newest',
          sort_by: { field: 'year', direction: 'descending' },
        },
        { ...BOOK_RELATION, name: 'by_slug', label: 'By Slug', sort_by: { field: 'slug' } },
        {
          ...BOOK_RELATION,
          name: 'series',
          label: 'Series',
          collection: 'series',
          search_fields: ['name'],
          display_fields: ['name'],
        },
        {
          ...BOOK_RELATION,
          name: 'series_by_name',
          label: 'Series by Name',
          collection: 'series',
          search_fields: ['name'],
          display_fields: ['name'],
          sort_by: { field: 'name' },
        },
      ],
    },
    {
      name: 'books',
      label: 'Books',
      label_singular: 'Book',
      folder: 'content/books',
      extension: 'yml',
      create: true,
      fields: [
        { name: 'title', label: 'Title' },
        { name: 'year', label: 'Year', widget: 'number', required: false },
      ],
    },
    {
      name: 'series',
      label: 'Series',
      label_singular: 'Series',
      folder: 'content/series',
      extension: 'yml',
      identifier_field: 'name',
      reorder: true,
      fields: [{ name: 'name', label: 'Name' }],
    },
  ],
};

/**
 * Books whose slugs, titles and years each sort in another order. One has no year, and two share
 * a year.
 */
const FILES = {
  'content/books/a-dune.yml': 'title: Dune\nyear: 1965\n',
  'content/books/b-neuromancer.yml': 'title: Neuromancer\nyear: 1984\n',
  'content/books/c-foundation.yml': 'title: Foundation\nyear: 1951\n',
  'content/books/d-solaris.yml': 'title: Solaris\n',
  'content/books/e-ubik.yml': 'title: Ubik\nyear: 1969\n',
  'content/books/f-hyperion.yml': 'title: Hyperion\nyear: 1969\n',
  'content/series/robots.yml': 'order: 1\nname: Robots\n',
  'content/series/empire.yml': 'order: 2\nname: Empire\n',
  'content/series/cantos.yml': 'order: 3\nname: Cantos\n',
};

// The editor renders a field once it’s scrolled into view, so make every field visible at once
test.use({ config: CONFIG, viewport: { width: 1280, height: 3000 } });

/**
 * Check the options a field offers, in order, after the one clearing the optional field.
 * @param {Page} page Page.
 * @param {string} label Field label.
 * @param {string[]} names Option labels.
 * @returns {Promise<void>} Resolves once the options match.
 */
const expectOptions = (page, label, names) => expectRadioOptions(page, label, ['(None)', ...names]);

/**
 * Sign in with the books and series in the repository, and start a new reading list.
 * @param {CMS} cms CMS.
 * @param {Page} page Page.
 */
const start = async (cms, page) => {
  await cms.open();
  await cms.seed(FILES);
  await cms.signIn();
  await page.getByRole('button', { name: 'Create New Entry' }).first().click();
  await getEditor(page).getByRole('textbox', { name: 'Title' }).fill('Classics');
};

test('sorts the options by the label without `sort_by`', async ({ cms, page }) => {
  await start(cms, page);
  await expectOptions(page, 'By Title', [
    'Dune',
    'Foundation',
    'Hyperion',
    'Neuromancer',
    'Solaris',
    'Ubik',
  ]);
});

test('sorts the options by a field, the ones without a value last', async ({ cms, page }) => {
  await start(cms, page);
  // Books of the same year are sorted by title
  await expectOptions(page, 'Oldest', [
    'Foundation',
    'Dune',
    'Hyperion',
    'Ubik',
    'Neuromancer',
    'Solaris',
  ]);
  // The book without a year stays last in descending order as well
  await expectOptions(page, 'Newest', [
    'Neuromancer',
    'Hyperion',
    'Ubik',
    'Dune',
    'Foundation',
    'Solaris',
  ]);
});

test('sorts the options by the slug', async ({ cms, page }) => {
  await start(cms, page);
  await expectOptions(page, 'By Slug', [
    'Dune',
    'Neuromancer',
    'Foundation',
    'Solaris',
    'Ubik',
    'Hyperion',
  ]);
});

test('follows the manual order of a collection unless `sort_by` is given', async ({
  cms,
  page,
}) => {
  await start(cms, page);
  await expectOptions(page, 'Series', ['Robots', 'Empire', 'Cantos']);
  await expectOptions(page, 'Series by Name', ['Cantos', 'Empire', 'Robots']);
});

test('saves the option picked from a sorted list', async ({ cms, page }) => {
  await start(cms, page);
  await pickRadioOption(page, 'Newest', 'Neuromancer');
  await getEditor(page).getByRole('button', { name: 'Save' }).click();
  await expect
    .poll(async () => (await cms.readRepo())['content/lists/classics.yml'])
    .toBe('title: Classics\nnewest: b-neuromancer\n');
});
