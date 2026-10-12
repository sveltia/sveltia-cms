import { MEDIA_CONFIG, MEDIA_FILES } from '../../fixtures/configs/media.js';
import { expect, test } from '../../fixtures/test.js';
import { getEditor } from '../../fixtures/ui.js';

test.use({ config: MEDIA_CONFIG });

test.beforeEach(async ({ cms }) => {
  await cms.open();
  await cms.seed(MEDIA_FILES);
  await cms.signIn();
});

test('finds entries from the content library, and opens one', async ({ page }) => {
  const search = page.getByRole('searchbox', { name: 'Search for contents…' });

  // The “Evening” note refers to `sunset.png` in its Cover field
  await search.fill('sunset');
  await expect(page).toHaveURL(/#\/search\/sunset$/);

  const results = page.getByRole('main').getByRole('grid', { name: 'Entries' }).getByRole('row');

  await expect(results).toHaveText([/Notes.*Evening/]);
  await results.first().click();

  const editor = getEditor(page);

  await expect(page).toHaveURL(/#\/collections\/notes\/entries\/evening$/);
  await expect(editor.getByRole('textbox', { name: 'Title' })).toHaveValue('Evening');

  // Closing the editor goes back to the results, and so does saving
  await editor.getByRole('button', { name: 'Cancel Editing' }).click();
  await expect(editor).toBeHidden();
  await expect(page).toHaveURL(/#\/search\/sunset$/);
  await results.first().click();
  await editor.getByRole('textbox', { name: 'Title' }).fill('Late Evening');
  await editor.getByRole('button', { name: 'Save' }).click();
  await expect(page).toHaveURL(/#\/search\/sunset$/);
  await expect(page.getByRole('status').filter({ hasText: 'Entry saved.' })).toBeVisible();
  await expect(results).toHaveText([/Notes.*Late Evening/]);
});

test('finds assets from the asset library, and opens one', async ({ page }) => {
  await page.getByRole('radio', { name: 'Assets' }).click();

  const search = page.getByRole('searchbox', { name: 'Search for assets…' });

  await search.fill('o');
  await expect(page).toHaveURL(/#\/search\/o$/);

  // The file names are matched, across the media folders
  const results = page.getByRole('main').getByRole('grid', { name: 'Assets' }).getByRole('row');

  await expect(results).toHaveCount(3);
  await search.fill('sunset');
  await expect(results).toHaveCount(1);
  await expect(results.first()).toHaveAccessibleName(/sunset\.png$/);
  await results.first().dblclick();
  await expect(page).toHaveURL(/#\/assets\/static\/uploads\/sunset\.png$/);

  // Closing the asset goes back to the results
  const assetEditor = page.getByRole('group', { name: 'Asset Editor' });

  await assetEditor.getByRole('button', { name: 'Cancel Editing' }).click();
  await expect(assetEditor).toBeHidden();
  await expect(page).toHaveURL(/#\/search\/sunset$/);
  await expect(results).toHaveCount(1);
});

test('shows no results for unknown terms, and clears the search', async ({ page }) => {
  const search = page.getByRole('searchbox', { name: 'Search for contents…' });

  await search.fill('nothing-matches-this');
  await expect(page.getByRole('main').getByText('No entries found.')).toBeVisible();

  // Clearing the terms goes back to the collection the search started from
  await search.fill('');
  await expect(page).toHaveURL(/#\/collections\/notes$/);
  await expect(page.getByRole('main', { name: /Notes.*Collection/ })).toBeVisible();
});

test('forgets the search when the browser goes back from the results', async ({ page }) => {
  const search = page.getByRole('searchbox', { name: 'Search for contents…' });

  await search.fill('sunset');
  await expect(page).toHaveURL(/#\/search\/sunset$/);
  await page.goBack();
  await expect(page).toHaveURL(/#\/collections\/notes$/);
  await expect(page.getByRole('main', { name: /Notes.*Collection/ })).toBeVisible();
  await expect(search).toHaveValue('');

  // A new search then starts from the collection again, which clearing the terms goes back to
  await search.fill('bridge');
  await expect(page).toHaveURL(/#\/search\/bridge$/);
  await search.fill('');
  await expect(page).toHaveURL(/#\/collections\/notes$/);
});

test('restores the search from the URL after a reload', async ({ page }) => {
  await page.getByRole('searchbox', { name: 'Search for contents…' }).fill('bridge');
  await expect(page).toHaveURL(/#\/search\/bridge$/);
  await page.reload();

  await expect(page.getByRole('searchbox')).toHaveValue('bridge');
  await expect(
    page.getByRole('main').getByRole('grid', { name: 'Entries' }).getByRole('row'),
  ).toHaveText([/Projects.*Bridge/]);
});

test('goes back to the asset folder the search started from when cleared', async ({ page }) => {
  await page.getByRole('radio', { name: 'Assets' }).click();

  const folders = page.getByRole('listbox', { name: 'Asset Folder List' });

  await expect(folders.getByRole('option', { selected: true })).toBeVisible();

  const libraryURL = page.url();

  await folders.getByRole('option', { name: /Projects/ }).click();
  await expect(page).toHaveURL(/#\/assets\/static\/projects$/);

  const search = page.getByRole('searchbox', { name: 'Search for assets…' });

  await search.fill('bridge');
  await expect(page).toHaveURL(/#\/search\/bridge$/);

  // Clearing the terms goes back to the folder, not to the content library
  await search.fill('');
  await expect(page).toHaveURL(/#\/assets\/static\/projects$/);
  await expect(page.getByRole('searchbox', { name: 'Search for assets…' })).toBeVisible();

  // Rather than adding another page to the history
  await page.goBack();
  await expect(page).toHaveURL(libraryURL);
});
