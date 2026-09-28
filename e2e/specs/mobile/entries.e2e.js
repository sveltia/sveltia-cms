import { MONOLINGUAL_CONFIG, MONOLINGUAL_FILES } from '../../fixtures/configs/monolingual.js';
import { expect, test } from '../../fixtures/test.js';

import { getEditor, PHONE, signIn } from './helpers.js';

test.use({ ...PHONE });

test.describe('with an empty collection', () => {
  test.beforeEach(async ({ cms, page }) => {
    await cms.open();
    await signIn(page);
    await page.getByRole('treeitem', { name: 'Posts' }).click();
  });

  test('creates the first entry and another one', async ({ cms, page }) => {
    const collection = page.getByRole('main', { name: /Posts.*Collection/ });
    const editor = getEditor(page);

    // The floating Create button only comes with the entries; the empty list offers one of its own
    await expect(collection).toContainText('This collection has no entries yet.');
    await expect(
      collection.getByRole('toolbar', { name: 'Collection' }).getByRole('button', {
        name: 'Create New Entry',
      }),
    ).toHaveCount(0);
    await collection.getByRole('button', { name: 'Create New Entry' }).click();

    await editor.getByRole('textbox', { name: 'Title' }).fill('Pocket Notes');
    await editor.getByRole('textbox', { name: 'Body' }).fill('Written on the bus.');
    await editor.getByRole('button', { name: 'Save' }).click();

    await expect
      .poll(async () => (await cms.readRepo())['content/posts/pocket-notes.md'])
      .toBe(['---', 'title: Pocket Notes', '---', '', 'Written on the bus.', ''].join('\n'));
    await expect(editor).toBeHidden();
    await expect(collection.getByRole('row', { name: 'Pocket Notes' })).toBeVisible();

    // Now the list has an entry, the Create button floats in the toolbar
    await collection
      .getByRole('toolbar', { name: 'Collection' })
      .getByRole('button', { name: 'Create New Entry' })
      .click();
    await editor.getByRole('textbox', { name: 'Title' }).fill('Second Thoughts');
    await editor.getByRole('textbox', { name: 'Body' }).fill('On the way back.');
    await editor.getByRole('button', { name: 'Save' }).click();

    await expect
      .poll(async () => (await cms.readRepo())['content/posts/second-thoughts.md'])
      .toBe(['---', 'title: Second Thoughts', '---', '', 'On the way back.', ''].join('\n'));
    await expect(collection.getByRole('grid', { name: 'Entries' })).toMatchAriaSnapshot(`
      - row "Pocket Notes"
      - row "Second Thoughts"
    `);
  });
});

test.describe('with entries', () => {
  test.use({ config: MONOLINGUAL_CONFIG });

  test.beforeEach(async ({ cms, page }) => {
    await cms.open();
    await cms.seed(MONOLINGUAL_FILES);
    await signIn(page);
    await page.getByRole('treeitem', { name: 'Posts' }).click();
  });

  test('opens an entry with a tap, and goes back to the list', async ({ page }) => {
    const editor = getEditor(page);

    // A single tap opens the entry, as there are no checkboxes to select it with
    await page.getByRole('row', { name: /First Light/ }).tap();
    await expect(editor.getByRole('textbox', { name: 'Title' })).toHaveValue('First Light');
    await expect(page).toHaveURL(/#\/collections\/posts\/entries\/2026-01-first-light$/);
    // The editor covers the bottom navigation
    await expect(page.getByRole('toolbar', { name: 'Global' })).not.toBeInViewport();

    await editor.getByRole('button', { name: 'Cancel Editing' }).click();
    await expect(editor).toBeHidden();
    await expect(page).toHaveURL(/#\/collections\/posts$/);
    await expect(page.getByRole('row', { name: /First Light/ })).toBeVisible();
  });

  test('switches between the editor and the preview, and saves', async ({ cms, page }) => {
    await page.getByRole('row', { name: /First Light/ }).click();

    const editor = getEditor(page);
    const editPane = editor.getByRole('group', { name: 'Edit Content' });
    const previewPane = editor.getByRole('group', { name: 'Preview Content' });
    const previewButton = editor.getByRole('button', { name: 'Preview' });

    // Only one pane fits: the editor comes first, and the preview replaces it
    await expect(editPane).toBeVisible();
    await expect(previewPane).toHaveCount(0);
    await expect(previewButton).toHaveAttribute('aria-pressed', 'false');

    await editPane.getByRole('textbox', { name: 'Title' }).fill('First Light, Revisited');
    await previewButton.click();
    await expect(previewButton).toHaveAttribute('aria-pressed', 'true');
    await expect(editPane).toHaveCount(0);
    await expect(
      previewPane.getByRole('document', { name: 'Content Preview' }).getByRole('group').first(),
    ).toMatchAriaSnapshot(`
      - heading "Title" [level=4]
      - paragraph: First Light, Revisited
    `);

    // The change is kept while the preview is shown
    await previewButton.click();
    await expect(editPane.getByRole('textbox', { name: 'Title' })).toHaveValue(
      'First Light, Revisited',
    );
    await expect(previewPane).toHaveCount(0);

    // The entry can be saved from the preview too
    await previewButton.click();
    await editor.getByRole('button', { name: 'Save' }).click();

    await expect
      .poll(async () => (await cms.readRepo())['content/posts/2026-01-first-light.md'])
      .toMatch(/^title: First Light, Revisited$/m);
    await expect(page.getByRole('row', { name: /First Light, Revisited/ })).toBeVisible();
  });

  test('opens a sidebar panel in a bottom sheet from the editor options', async ({ cms, page }) => {
    await page.getByRole('row', { name: /First Light/ }).click();

    const editor = getEditor(page);

    // The sidebar doesn’t fit on a phone, so the editor options list its panels instead
    await expect(page.getByRole('radiogroup', { name: 'Sidebar Panels' })).toHaveCount(0);
    await cms.chooseMenuItem(
      editor.getByRole('button', { name: 'Show Editor Options' }),
      page.getByRole('menu', { name: 'Editor Options' }).getByRole('menuitem', { name: 'Slug' }),
    );

    const sheet = page.locator('dialog:not([inert])');

    await expect(sheet.getByRole('textbox', { name: 'Slug' })).toHaveText('2026-01-first-light');

    await page.keyboard.press('Escape');
    await expect(sheet).toHaveCount(0);
    await expect(editor.getByRole('textbox', { name: 'Title' })).toBeVisible();
  });

  test('shows the errors in a bottom sheet when a save fails validation', async ({ page }) => {
    await page.getByRole('row', { name: /First Light/ }).click();

    const editor = getEditor(page);

    await editor.getByRole('textbox', { name: 'Title' }).fill('');
    await editor.getByRole('button', { name: 'Save' }).click();
    await page
      .getByRole('alert')
      .filter({ hasText: 'One field has an error.' })
      .getByRole('button', { name: 'Show Errors' })
      .click();

    const sheet = page.locator('dialog:not([inert])');
    const error = sheet.getByRole('button', { name: /Title/ });

    await expect(error).toContainText('This field is required.');

    // Choosing the error closes the sheet, then focuses the field, which is inert until then
    await error.click();
    await expect(sheet).toHaveCount(0);
    await expect(editor.getByRole('textbox', { name: 'Title' })).toBeFocused();
  });
});
