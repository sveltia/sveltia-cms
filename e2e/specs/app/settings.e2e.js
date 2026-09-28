import { readFile } from 'fs/promises';

import { expect, test } from '../../fixtures/test.js';

/**
 * @import { Locator, Page } from '@playwright/test';
 * @import { CMS } from '../../fixtures/test.js';
 */

test.beforeEach(async ({ cms }) => {
  await cms.open();
  await cms.seed({ 'content/posts/first-post.md': '---\ntitle: First Post\n---\n\nHello!\n' });
  await cms.signIn();
});

/**
 * Select a panel in the Settings dialog.
 * @param {Locator} tab Tab.
 */
const selectTab = async (tab) => {
  await tab.click();
  await expect(tab).toHaveAttribute('aria-selected', 'true');
};

/**
 * Open the Settings dialog from the account menu, and select one of its panels.
 * @param {CMS} cms CMS.
 * @param {Page} page Page.
 * @param {string} [panel] Name of the panel to select, e.g. `Contents`.
 * @returns {Promise<Locator>} Dialog.
 */
const openSettings = async (cms, page, panel) => {
  const dialog = page.getByRole('dialog', { name: 'Settings' });

  await cms.chooseMenuItem(
    page.getByRole('button', { name: 'Show Account Menu' }),
    page.getByRole('menuitem', { name: 'Settings' }),
  );
  await expect(dialog).toBeVisible();

  if (panel) {
    await selectTab(dialog.getByRole('tab', { name: panel }));
  }

  return dialog;
};

/**
 * Get the theme applied to the page and the color scheme the browser renders it in.
 * @param {Page} page Page.
 * @returns {Promise<{ theme?: string, colorScheme: string }>} Theme.
 */
const getTheme = (page) =>
  page.evaluate(() => ({
    theme: document.documentElement.dataset.theme,
    colorScheme: getComputedStyle(document.documentElement).colorScheme,
  }));

test('opens and closes the Settings dialog', async ({ cms, page }) => {
  const dialog = await openSettings(cms, page);

  await expect(dialog.getByRole('tablist', { name: 'Categories' }).getByRole('tab')).toHaveText([
    /Appearance/,
    /Language/,
    /Contents/,
    /Media/,
    /Accessibility/,
    /Advanced/,
  ]);
  // The Appearance panel is shown first
  await expect(dialog.getByRole('tab', { name: 'Appearance' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await dialog.getByRole('button', { name: 'Close' }).click();
  await expect(dialog).toBeHidden();
  // The focus goes back to the menu button
  await expect(page.getByRole('button', { name: 'Show Account Menu' })).toBeFocused();

  await openSettings(cms, page);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
});

test('switches the theme, and keeps it after a reload', async ({ cms, page }) => {
  const dialog = await openSettings(cms, page);
  const themes = dialog.getByRole('radiogroup', { name: 'Select Theme' });

  // The theme follows the system by default
  await expect(themes.getByRole('radio', { name: 'Automatic' })).toBeChecked();
  expect(await getTheme(page)).toEqual({ theme: 'light', colorScheme: 'light' });
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect.poll(() => getTheme(page)).toEqual({ theme: 'dark', colorScheme: 'dark' });

  await themes.getByRole('radio', { name: 'Light' }).click();
  await expect(themes.getByRole('radio', { name: 'Light' })).toBeChecked();
  await expect.poll(() => getTheme(page)).toEqual({ theme: 'light', colorScheme: 'light' });

  await themes.getByRole('radio', { name: 'Dark' }).click();
  await expect.poll(() => getTheme(page)).toEqual({ theme: 'dark', colorScheme: 'dark' });
  // An explicit choice no longer follows the system
  await page.emulateMedia({ colorScheme: 'light' });
  // The browser reports a media change while it renders the next frame, so wait for two
  await page.evaluate(
    () =>
      new Promise((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(resolve);
        });
      }),
  );
  await expect(themes.getByRole('radio', { name: 'Dark' })).toBeChecked();
  expect(await getTheme(page)).toEqual({ theme: 'dark', colorScheme: 'dark' });

  await page.reload();
  await expect(page.getByRole('button', { name: 'Show Account Menu' })).toBeVisible();
  await expect.poll(() => getTheme(page)).toEqual({ theme: 'dark', colorScheme: 'dark' });

  const reopened = await openSettings(cms, page);

  await expect(
    reopened.getByRole('radiogroup', { name: 'Select Theme' }).getByRole('radio', { name: 'Dark' }),
  ).toBeChecked();
});

test('switches the UI language, and keeps it after a reload', async ({ cms, page }) => {
  // The production bundle only includes the English strings and fetches the others from the CDN,
  // so answer that request with the file the build has generated
  await page.route('https://unpkg.com/@sveltia/cms@*/locales/*.json', async (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: await readFile(
        new URL(
          `../../../package/locales/${route.request().url().split('/').pop()}`,
          import.meta.url,
        ),
      ),
    }),
  );

  const dialog = await openSettings(cms, page, 'Language');
  const select = dialog.getByRole('combobox', { name: 'Select Language' });

  await expect(select).toHaveText(/Automatic/);
  await cms.chooseMenuItem(select, page.getByRole('option', { name: 'Japanese — 日本語' }));

  // The dialog is translated right away
  await expect(page.getByRole('dialog', { name: '設定' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'アピアランス' })).toBeVisible();
  await expect(page.getByRole('combobox', { name: '言語を選択' })).toHaveText(/日本語/);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'アカウントメニューを表示' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'ja');

  await page.reload();
  await expect(page.getByRole('button', { name: 'アカウントメニューを表示' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'エントリーまたはアセットを作成' })).toBeVisible();

  // Back to the browser’s language
  await cms.chooseMenuItem(
    page.getByRole('button', { name: 'アカウントメニューを表示' }),
    page.getByRole('menuitem', { name: '設定' }),
  );
  await selectTab(page.getByRole('tab', { name: '言語' }));
  await cms.chooseMenuItem(
    page.getByRole('combobox', { name: '言語を選択' }),
    page.getByRole('option', { name: '自動' }),
  );
  await expect(page.getByRole('dialog', { name: 'Settings' })).toBeVisible();
});

test('keeps the editor open after saving when Close the Editor is off', async ({ cms, page }) => {
  const dialog = await openSettings(cms, page, 'Contents');
  const closeOnSave = dialog.getByRole('switch', { name: 'Close the editor after saving a draft' });

  await expect(closeOnSave).toBeChecked();
  await closeOnSave.click();
  await expect(closeOnSave).not.toBeChecked();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();

  await page.getByRole('row', { name: /First Post/ }).click();

  const editor = page.getByRole('group', { name: 'Content Editor' });

  await editor.getByRole('textbox', { name: 'Title' }).fill('Updated Post');
  await editor.getByRole('button', { name: 'Save' }).click();

  await expect
    .poll(async () => (await cms.readRepo())['content/posts/first-post.md'])
    .toBe('---\ntitle: Updated Post\n---\n\nHello!\n');
  await expect(editor.getByRole('button', { name: 'Save' })).toBeDisabled();
  await expect(editor.getByRole('textbox', { name: 'Title' })).toHaveValue('Updated Post');
});

test('keeps the editor open on Escape when Close with Escape is off', async ({ cms, page }) => {
  const dialog = await openSettings(cms, page, 'Contents');

  const closeWithEscape = dialog.getByRole('switch', {
    name: 'Close the editor with the Escape key',
  });

  await closeWithEscape.click();
  await expect(closeWithEscape).not.toBeChecked();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();

  await page.getByRole('row', { name: /First Post/ }).click();

  const editor = page.getByRole('group', { name: 'Content Editor' });
  const title = editor.getByRole('textbox', { name: 'Title' });

  await expect(title).toHaveValue('First Post');
  await title.click();
  await page.keyboard.press('Escape');
  // The editor is still there to take an edit and save it
  await title.fill('Updated Post');
  await editor.getByRole('button', { name: 'Save' }).click();
  await expect
    .poll(async () => (await cms.readRepo())['content/posts/first-post.md'])
    .toBe('---\ntitle: Updated Post\n---\n\nHello!\n');
});

test('shows the developer tools once Developer Mode is on', async ({ cms, page }) => {
  const accountButton = page.getByRole('button', { name: 'Show Account Menu' });
  const helpButton = page.getByRole('button', { name: 'Show Help Menu' });

  await expect(helpButton).toBeHidden();
  await accountButton.click();
  await expect(page.getByRole('menuitem', { name: 'Keyboard Shortcuts' })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'CMS Configuration' })).toBeHidden();
  await page.keyboard.press('Escape');

  const dialog = await openSettings(cms, page, 'Advanced');
  const devMode = dialog.getByRole('switch', { name: 'Enable Developer Mode' });

  await devMode.click();
  await expect(devMode).toBeChecked();
  await expect(page.locator('html')).toHaveAttribute('data-dev-mode', 'true');
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();

  // The Help menu appears in the toolbar, and takes the Keyboard Shortcuts item
  await expect(helpButton).toBeVisible();
  await cms.openPopup(helpButton, page.getByRole('menu', { name: 'Help' }));
  await expect(page.getByRole('menuitem', { name: 'Keyboard Shortcuts' })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'Documentation' })).toBeVisible();
  await page.keyboard.press('Escape');

  // The account menu leads to the CMS configuration
  await cms.chooseMenuItem(
    accountButton,
    page.getByRole('menuitem', { name: 'CMS Configuration' }),
  );
  await expect(page).toHaveURL(/#\/config$/);
});
