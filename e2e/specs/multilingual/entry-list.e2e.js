import { MULTILINGUAL_CONFIG, MULTILINGUAL_FILES } from '../../fixtures/configs/multilingual.js';
import { expect, test } from '../../fixtures/test.js';

test.use({ config: MULTILINGUAL_CONFIG });

test.beforeEach(async ({ cms }) => {
  await cms.open();
  await cms.seed(MULTILINGUAL_FILES);
  await cms.signIn();
});

test('lists the entries in the default locale', async ({ page }) => {
  const rows = page.getByRole('grid', { name: 'Entries' }).getByRole('row');

  // English is the default locale, although French comes first in the list of locales
  await expect(rows).toHaveText([/A Weekend in Lyon/, /Walking to Petra/]);

  // An entry without a file in the first locale is listed too
  await page.getByRole('treeitem', { name: 'Guides' }).click();
  await expect(rows).toHaveText([/Kyoto Temples/, /Marrakesh Souks/]);

  await page.getByRole('treeitem', { name: 'Destinations' }).click();
  await expect(rows).toHaveText([/Paris/]);
});

test('finds an entry by its content in any locale', async ({ page }) => {
  const search = page.getByRole('searchbox');
  const results = page.getByRole('main').getByRole('grid', { name: 'Entries' }).getByRole('row');

  // A result is shown in the default locale, whichever locale matched
  await search.fill('Pétra');
  await page.keyboard.press('Enter');
  await expect(results).toHaveText([/Articles.*Walking to Petra/]);

  await search.fill('البتراء');
  await page.keyboard.press('Enter');
  await expect(results).toHaveText([/Articles.*Walking to Petra/]);

  await search.fill('souks de marrakech');
  await page.keyboard.press('Enter');
  await expect(results).toHaveText([/Guides.*Marrakesh Souks/]);
});
