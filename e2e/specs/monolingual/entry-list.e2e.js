import { MONOLINGUAL_CONFIG, MONOLINGUAL_FILES } from '../../fixtures/configs/monolingual.js';
import { expect, test } from '../../fixtures/test.js';

test.use({ config: MONOLINGUAL_CONFIG });

test.beforeEach(async ({ cms }) => {
  await cms.open();
  await cms.seed(MONOLINGUAL_FILES);
  await cms.signIn();
});

test('shows the entries with the summary template', async ({ page }) => {
  await expect(page.getByRole('grid', { name: 'Entries' }).getByRole('row')).toHaveText([
    /A Quiet Review \(Review\)/,
    /First Light \(News\)/,
    /Talking to Jane \(Interview\)/,
  ]);
});

test('sorts the entries by a sortable field', async ({ cms, page }) => {
  const rows = page.getByRole('grid', { name: 'Entries' }).getByRole('row');

  await cms.chooseMenuItem(
    page.getByRole('button', { name: 'Sort', exact: true }),
    page.getByRole('menuitemradio', { name: /Date.*new to old/ }),
  );
  await expect(rows).toHaveText([/Talking to Jane/, /A Quiet Review/, /First Light/]);

  await cms.chooseMenuItem(
    page.getByRole('button', { name: 'Sort', exact: true }),
    page.getByRole('menuitemradio', { name: /Title.*Z to A/ }),
  );
  await expect(rows).toHaveText([/Talking to Jane/, /First Light/, /A Quiet Review/]);
});

test('filters the entries with a view filter', async ({ cms, page }) => {
  const rows = page.getByRole('grid', { name: 'Entries' }).getByRole('row');
  const filterButton = page.getByRole('button', { name: 'Filter', exact: true });

  await cms.chooseMenuItem(filterButton, page.getByRole('menuitemcheckbox', { name: 'Drafts' }));
  await expect(rows).toHaveText([/A Quiet Review/]);

  // Filters combine, so turn the first one off before trying the other
  await cms.chooseMenuItem(filterButton, page.getByRole('menuitemcheckbox', { name: 'Drafts' }));
  await cms.chooseMenuItem(filterButton, page.getByRole('menuitemcheckbox', { name: 'Published' }));
  await expect(rows).toHaveText([/First Light/, /Talking to Jane/]);
});

test('groups the entries with a view group', async ({ cms, page }) => {
  await cms.chooseMenuItem(
    page.getByRole('button', { name: 'Group', exact: true }),
    page.getByRole('menuitemradio', { name: 'Category' }),
  );

  const grid = page.getByRole('grid', { name: 'Entries' });

  // A group is named after the field value
  await expect(grid.getByRole('rowgroup')).toHaveCount(3);
  await expect(grid.getByRole('rowgroup', { name: /^interview$/i }).getByRole('row')).toHaveText([
    /interview/i,
    /Talking to Jane/,
  ]);
  await expect(grid.getByRole('rowgroup', { name: /^news$/i }).getByRole('row')).toHaveText([
    /news/i,
    /First Light/,
  ]);
  await expect(grid.getByRole('rowgroup', { name: /^review$/i }).getByRole('row')).toHaveText([
    /review/i,
    /A Quiet Review/,
  ]);
});

test('finds entries across collections with the search box', async ({ page }) => {
  await page.getByRole('searchbox').fill('jane');
  await page.keyboard.press('Enter');

  const results = page.getByRole('main').getByRole('grid', { name: 'Entries' }).getByRole('row');

  // The author herself, a post whose title mentions her, and a post she wrote, as the search covers
  // the field values too
  await expect(results).toHaveText([
    /Authors.*Jane Doe/,
    /Posts.*Talking to Jane/,
    /Posts.*First Light/,
  ]);
});
