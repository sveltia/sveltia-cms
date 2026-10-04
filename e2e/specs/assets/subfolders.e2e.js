import { MEDIA_CONFIG, MEDIA_FILES } from '../../fixtures/configs/media.js';
import { createPNG } from '../../fixtures/files.js';
import { expect, test } from '../../fixtures/test.js';

test.use({ config: MEDIA_CONFIG });

test.beforeEach(async ({ cms, page }) => {
  await cms.open();
  await cms.seed({
    ...MEDIA_FILES,
    'static/uploads/v1.2/logo.png': createPNG({ color: [64, 0, 128] }),
  });
  await cms.signIn();
  await page.getByRole('radio', { name: 'Assets' }).click();
  await page.getByRole('option', { name: /Global Assets/ }).click();
});

test('opens a subfolder with a dot in its name', async ({ page }) => {
  await page.getByRole('row', { name: 'v1.2' }).dblclick();

  await expect(page).toHaveURL(/#\/assets\/static\/uploads\/v1\.2$/);

  // The folder is listed once the page transition updates the content, a moment after the URL has
  // changed. Count the rows first: an assertion on a locator matching several elements fails right
  // away with a strict mode violation instead of retrying
  const rows = page.getByRole('grid', { name: 'Assets' }).getByRole('row');

  await expect(rows).toHaveCount(1);
  await expect(rows).toHaveAccessibleName('logo.png');
  await expect(page.getByRole('group', { name: 'Asset Editor' })).toBeHidden();
});
