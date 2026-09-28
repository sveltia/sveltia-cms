import { MEDIA_CONFIG, MEDIA_FILES } from '../../fixtures/configs/media.js';
import { expect, test } from '../../fixtures/test.js';

/**
 * @import { Locator, Page } from '@playwright/test';
 */

test.use({ config: MEDIA_CONFIG });

/**
 * Get the Not Found page.
 * @param {Page} page Page.
 * @returns {Locator} Page.
 */
const getNotFoundPage = (page) => page.getByRole('group', { name: 'Page not found.' });

test.describe('after signing in', () => {
  test.beforeEach(async ({ cms }) => {
    await cms.open();
    await cms.seed(MEDIA_FILES);
    await cms.signIn();
  });

  test('shows the Not Found page for an unknown URL, and goes back', async ({ cms, page }) => {
    await expect(page.getByRole('main', { name: /Notes.*Collection/ })).toBeVisible();

    /**
     * Open a dead link and check that the Not Found page is shown.
     * @param {string} path URL path.
     */
    const openDeadLink = async (path) => {
      await page.goto(`${cms.adminPath}#${path}`);
      await expect(getNotFoundPage(page)).toBeVisible();
      // Screen reader users are told too
      await expect(page.getByRole('status').filter({ hasText: 'Page not found.' })).toBeAttached();
    };

    // An unknown page, a page name followed by other characters, and a page that takes no path
    await openDeadLink('/nowhere');
    await openDeadLink('/collections-foo');
    await openDeadLink('/workflow/foo');

    // A dead link followed from the Asset Library leads back there, not to the content library
    await page.getByRole('radio', { name: 'Assets' }).click();
    await expect(page).toHaveURL(/#\/assets\/-\/all$/);
    await openDeadLink('/nowhere');
    await getNotFoundPage(page).getByRole('button', { name: 'Back' }).click();
    await expect(page).toHaveURL(/#\/assets\/-\/all$/);
    await expect(getNotFoundPage(page)).toBeHidden();
    await expect(page.getByRole('radio', { name: 'Assets' })).toBeChecked();
  });

  test('creates an entry in the collection chosen from the Create menu', async ({ cms, page }) => {
    const button = page.getByRole('button', { name: 'Create Entry or Assets' });
    const menu = page.getByRole('menu', { name: 'Create Entry or Assets' });

    await cms.openPopup(button, menu);
    await expect(menu.getByRole('menuitem')).toHaveText(['Note', 'Project', 'Post', 'Assets']);
    await menu.getByRole('menuitem', { name: 'Project' }).click();

    await expect(page).toHaveURL(/#\/collections\/projects\/new$/);

    const editor = page.getByRole('group', { name: 'Content Editor' });

    await editor.getByRole('textbox', { name: 'Title' }).fill('Tower');
    await editor.getByRole('button', { name: 'Save' }).click();

    await expect
      .poll(async () => (await cms.readRepo())['content/projects/tower.md'])
      .toBe("---\ntitle: Tower\nimage: ''\n---\n");
    // The editor closes on the new entry’s collection
    await expect(page.getByRole('main', { name: /Projects.*Collection/ })).toBeVisible();
    await expect(page.getByRole('row', { name: /Tower/ })).toBeVisible();
  });

  test('opens the upload dialog from the Create menu', async ({ cms, page }) => {
    await cms.chooseMenuItem(
      page.getByRole('button', { name: 'Create Entry or Assets' }),
      page.getByRole('menuitem', { name: 'Assets' }),
    );

    await expect(page).toHaveURL(/#\/assets/);
    await expect(page.getByRole('dialog', { name: 'Upload New Assets' })).toBeVisible();
  });
});

test.describe('before signing in', () => {
  test('shows the Not Found page for an unknown URL, and goes to the collections', async ({
    cms,
    page,
  }) => {
    await page.goto(`${cms.adminPath}#/nowhere`);
    await cms.seed(MEDIA_FILES);
    await cms.signIn();

    await expect(getNotFoundPage(page)).toBeVisible();
    // There’s no previous page to go back to, so the button opens the content library
    await getNotFoundPage(page).getByRole('button', { name: 'Back' }).click();
    await expect(page).toHaveURL(/#\/collections\/notes$/);
    await expect(page.getByRole('main', { name: /Notes.*Collection/ })).toBeVisible();
  });
});
