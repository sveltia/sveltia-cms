import { MONOLINGUAL_CONFIG, MONOLINGUAL_FILES } from '../../fixtures/configs/monolingual.js';
import { expect, test } from '../../fixtures/test.js';

/**
 * @import { Locator, Page } from '@playwright/test';
 */

test.use({ config: MONOLINGUAL_CONFIG });

test.beforeEach(async ({ cms }) => {
  await cms.open();
  await cms.seed(MONOLINGUAL_FILES);
  await cms.signIn();
});

/**
 * Get a sidebar panel button and the panel it opens.
 * @param {Page} page Page.
 * @param {string} name Panel name.
 * @returns {{ button: Locator, panel: Locator }} Button and panel.
 */
const getPanel = (page, name) => ({
  button: page.getByRole('radiogroup', { name: 'Sidebar Panels' }).getByRole('radio', { name }),
  panel: page.getByRole('group', { name, exact: true }),
});

test('opens and closes a panel', async ({ page }) => {
  await page.getByRole('row', { name: /First Light/ }).click();

  const { button, panel } = getPanel(page, 'Slug');

  await expect(button).not.toBeChecked();
  await expect(panel).toBeHidden();
  await button.click();
  await expect(button).toBeChecked();
  await expect(panel.getByRole('textbox', { name: 'Slug' })).toHaveText('2026-01-first-light');

  // The panel stays open for the next entry
  await page.getByRole('button', { name: 'Cancel Editing' }).click();
  await page.getByRole('row', { name: /A Quiet Review/ }).click();
  await expect(panel.getByRole('textbox', { name: 'Slug' })).toHaveText('2026-02-a-quiet-review');

  // Clicking the button again closes it
  await button.click();
  await expect(button).not.toBeChecked();
  await expect(panel).toBeHidden();
});

test.describe('Validation panel', () => {
  test('lists the errors, and focuses a field when its error is clicked', async ({ page }) => {
    await page.getByRole('row', { name: /First Light/ }).click();

    const editor = page.getByRole('group', { name: 'Content Editor' });
    const { button, panel } = getPanel(page, 'Validation');

    await editor.getByRole('textbox', { name: 'Title' }).fill('');
    await editor.getByRole('spinbutton', { name: 'Rating' }).fill('9');
    await button.click();
    await expect(panel).toContainText('Validation results will be shown here.');
    await panel.getByRole('button', { name: 'Validate' }).click();

    const errors = panel.getByRole('button', { name: /Title|Rating/ });

    await expect(errors).toHaveCount(2);
    await expect(errors.first()).toContainText('This field is required.');
    await expect(errors.last()).toContainText('The value must be less than or equal to 5.');

    await errors.last().click();
    await expect(editor.getByRole('spinbutton', { name: 'Rating' })).toBeFocused();
    await errors.first().click();
    await expect(editor.getByRole('textbox', { name: 'Title' })).toBeFocused();

    // The list follows the corrections
    await page.keyboard.type('Fixed Light');
    await expect(errors).toHaveCount(1);
    await editor.getByRole('spinbutton', { name: 'Rating' }).fill('4');
    await expect(panel).toContainText('No errors found.');
  });

  test('is shown with the errors when a save fails validation', async ({ page }) => {
    await page.getByRole('row', { name: /First Light/ }).click();

    const editor = page.getByRole('group', { name: 'Content Editor' });
    const { button, panel } = getPanel(page, 'Validation');

    await editor.getByRole('textbox', { name: 'Title' }).fill('');
    await editor.getByRole('button', { name: 'Save' }).click();

    const toast = page.getByRole('alert').filter({ hasText: 'One field has an error.' });

    await toast.getByRole('button', { name: 'Show Errors' }).click();
    await expect(button).toBeChecked();
    await expect(panel.getByRole('button', { name: /Title/ })).toContainText(
      'This field is required.',
    );
  });
});

test.describe('Backlinks panel', () => {
  test('lists the entries referring to an author, and opens one', async ({ page }) => {
    await page.getByRole('treeitem', { name: 'Authors' }).click();
    await page.getByRole('row', { name: /Jane Doe/ }).click();

    const editor = page.getByRole('group', { name: 'Content Editor' });
    const { button, panel } = getPanel(page, 'Backlinks');

    await expect(editor.getByRole('textbox', { name: 'Name' })).toHaveValue('Jane Doe');
    await button.click();

    const posts = panel.getByRole('group', { name: 'Posts' });

    await expect(posts.getByRole('button')).toHaveText([/First Light/, /Talking to Jane/]);
    await posts.getByRole('button', { name: /Talking to Jane/ }).click();
    await expect(editor.getByRole('textbox', { name: 'Title' })).toHaveValue('Talking to Jane');
  });

  test('says when nothing refers to an author', async ({ cms, page }) => {
    await cms.seed({
      'content/authors/sam-lee.json': `${JSON.stringify({ name: 'Sam Lee', email: 'sam@example.com' })}\n`,
    });
    await cms.open();
    await page.getByRole('treeitem', { name: 'Authors' }).click();
    await page.getByRole('row', { name: /Sam Lee/ }).click();

    const { button, panel } = getPanel(page, 'Backlinks');

    await button.click();
    await expect(panel).toContainText('No entries are referencing this entry.');
  });

  test('is unavailable for an entry nothing can refer to', async ({ page }) => {
    await page.getByRole('row', { name: /First Light/ }).click();
    await expect(getPanel(page, 'Backlinks').button).toBeDisabled();
    // So is the history, as the test backend has none
    await expect(getPanel(page, 'History').button).toBeDisabled();
  });
});
