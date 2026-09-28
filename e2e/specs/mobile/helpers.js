import { devices } from '@playwright/test';

import { expect } from '../../fixtures/test.js';

/**
 * @import { Locator, Page } from '@playwright/test';
 */

// The descriptor also names the browser to run, which a test can’t change within a project
const { defaultBrowserType, ...pixel } = devices['Pixel 7'];

/**
 * Browser context options for a phone: a viewport narrower than 768 pixels, where the CMS switches
 * to its small screen layout, and a touch screen without a mouse. Use it with `test.use()`.
 */
export const PHONE = pixel;

/**
 * Get the bottom navigation, which replaces the global toolbar on a small screen.
 * @param {Page} page Page.
 * @returns {Locator} Radio group of the pages.
 */
export const getBottomNavigation = (page) =>
  page.getByRole('toolbar', { name: 'Global' }).getByRole('radiogroup', { name: 'Switch Page' });

/**
 * Sign in with the test backend and wait for the bottom navigation. `cms.signIn()` waits for the
 * account menu button in the global toolbar, which a small screen doesn’t have.
 * @param {Page} page Page.
 */
export const signIn = async (page) => {
  await page.getByRole('button', { name: 'Work with Test Repository' }).click();
  await expect(getBottomNavigation(page)).toBeVisible();
};

/**
 * Get the content editor.
 * @param {Page} page Page.
 * @returns {Locator} Editor.
 */
export const getEditor = (page) => page.getByRole('group', { name: 'Content Editor' });
