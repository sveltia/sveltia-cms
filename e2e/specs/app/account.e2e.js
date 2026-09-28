import { BASE_CONFIG, expect, test } from '../../fixtures/test.js';

/**
 * @import { Locator, Page } from '@playwright/test';
 */

test.beforeEach(async ({ cms }) => {
  await cms.open();
  await cms.seed({ 'content/posts/first-post.md': '---\ntitle: First Post\n---\n\nHello!\n' });
  await cms.signIn();
});

/**
 * Get the button that opens the account menu.
 * @param {Page} page Page.
 * @returns {Locator} Button.
 */
const getAccountButton = (page) => page.getByRole('button', { name: 'Show Account Menu' });

test('lists the account menu items', async ({ cms, page }) => {
  await cms.openPopup(getAccountButton(page), page.getByRole('menu', { name: 'Account' }));

  const menu = page.getByRole('menu', { name: 'Account' });

  await expect(menu.getByRole('menuitem')).toHaveText([
    'Working with Test Repository',
    'Live Site',
    'Settings',
    'Keyboard Shortcuts',
    'Sign Out',
  ]);
  // The test repository has no account page to open
  await expect(menu.getByRole('menuitem', { name: 'Working with Test Repository' })).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
});

test('shows the keyboard shortcuts, which work', async ({ cms, page }) => {
  const dialog = page.getByRole('dialog', { name: 'Keyboard Shortcuts' });

  await cms.chooseMenuItem(
    getAccountButton(page),
    page.getByRole('menuitem', { name: 'Keyboard Shortcuts' }),
  );

  const rows = dialog.getByRole('table', { name: 'Keyboard Shortcuts' }).getByRole('row');

  // Playwright runs Chromium on Linux or macOS, so the accelerator key is Ctrl or ⌘
  await expect(rows).toHaveText([
    /View Content Library\s*Alt\s*1/,
    /View Asset Library\s*Alt\s*2/,
    /Search for entries and assets\s*(Ctrl|⌘)\s*F/,
    /Create a new entry\s*(Ctrl|⌘)\s*E/,
    /Save an entry\s*(Ctrl|⌘)\s*S/,
    /Cancel entry editing\s*Escape/,
  ]);
  await dialog.getByRole('button', { name: 'Close' }).click();
  await expect(dialog).toBeHidden();
  // The focus goes back to the menu button
  await expect(getAccountButton(page)).toBeFocused();

  // Try the first ones
  await page.keyboard.press('Alt+2');
  await expect(page).toHaveURL(/#\/assets/);
  await expect(page.getByRole('radio', { name: 'Assets' })).toBeChecked();
  await page.keyboard.press('Alt+1');
  await expect(page).toHaveURL(/#\/collections/);
  await expect(page.getByRole('main', { name: /Posts.*Collection/ })).toBeVisible();
  await page.keyboard.press('ControlOrMeta+F');
  await expect(page.getByRole('searchbox', { name: 'Search for contents…' })).toBeFocused();
  await page.keyboard.press('Escape');
  await page.getByRole('row', { name: /First Post/ }).focus();
  await page.keyboard.press('ControlOrMeta+E');
  await expect(page).toHaveURL(/#\/collections\/posts\/new$/);
  await expect(
    page.getByRole('group', { name: 'Content Editor' }).getByRole('textbox', { name: 'Title' }),
  ).toBeVisible();
});

test('signs out, and back in', async ({ cms, page }) => {
  const signInButton = page.getByRole('button', { name: 'Work with Test Repository' });

  await cms.chooseMenuItem(
    getAccountButton(page),
    page.getByRole('menuitem', { name: 'Sign Out' }),
  );
  await expect(signInButton).toBeVisible();
  await expect(getAccountButton(page)).toBeHidden();

  // The sign-out sticks after a reload
  await page.reload();
  await expect(signInButton).toBeVisible();

  await cms.signIn();
  await expect(page.getByRole('main', { name: /Posts.*Collection/ })).toBeVisible();
  await expect(page.getByRole('row', { name: /First Post/ })).toBeVisible();
});

test.describe('with a sign-out redirect', () => {
  test.use({ config: { ...BASE_CONFIG, logout_redirect_url: 'https://example.com/goodbye' } });

  test('goes to the given page after signing out', async ({ cms, page }) => {
    await page.route('https://example.com/goodbye', (route) =>
      route.fulfill({ contentType: 'text/html', body: '<h1>Goodbye</h1>' }),
    );
    await cms.chooseMenuItem(
      getAccountButton(page),
      page.getByRole('menuitem', { name: 'Sign Out' }),
    );
    await expect(page).toHaveURL('https://example.com/goodbye');
    await expect(page.getByRole('heading', { name: 'Goodbye' })).toBeVisible();
  });
});
