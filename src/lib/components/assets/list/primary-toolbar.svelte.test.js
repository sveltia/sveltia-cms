import { addMessages, locale } from '@sveltia/i18n';
import { createRawSnippet } from 'svelte';
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { env } from '$lib/services/user/env.svelte';

import PrimaryToolbar from './primary-toolbar.svelte';

const actions = createRawSnippet(() => ({
  /**
   * Render the content.
   * @returns {string} HTML.
   */
  render: () => '<button type="button">Action</button>',
}));

/**
 * Get the heading text as shown, leaving out the hidden copy the breadcrumb is measured with.
 * @param {HTMLElement} container Container.
 * @returns {string} Text.
 */
const getHeading = (container) =>
  /** @type {HTMLElement} */ (container.querySelector('h2')).innerText.replace(/\s+/g, ' ').trim();

describe('PrimaryToolbar', () => {
  // Register a right-to-left locale, without strings, so it can be switched to
  beforeAll(async () => {
    addMessages('ar', {});
    // Give the breadcrumb room, or it folds its middle into a menu
    await page.viewport(1024, 768);
  });

  afterAll(async () => {
    await page.viewport(414, 896);
  });

  test('shows the folder title and actions on a large screen', async () => {
    env.isSmallScreen = false;
    env.isMediumScreen = false;

    const { container } = await render(PrimaryToolbar, {
      rootLabel: 'Images',
      onBrowse: vi.fn(),
      actions,
    });

    await expect.element(page.getByRole('toolbar', { name: 'Folder' })).toBeVisible();
    expect(container.querySelector('h2')).toHaveTextContent('Images');
    // No breadcrumb at the root of a location
    expect(page.getByRole('navigation').elements()).toHaveLength(0);
    await expect.element(page.getByRole('button', { name: 'Action' })).toBeVisible();
  });

  test('shows a back button instead on a small screen', async () => {
    env.isSmallScreen = true;
    window.location.hash = '#/assets/static/images';

    const { container } = await render(PrimaryToolbar, {
      rootLabel: 'Images',
      onBrowse: vi.fn(),
      actions,
    });

    expect(container.querySelector('h2')).toHaveTextContent('Images');
    expect(page.getByRole('button', { name: 'Action' }).elements()).toHaveLength(0);

    await page.getByRole('button', { name: 'Back to Asset Folder List' }).click();
    await expect.poll(() => window.location.hash).toBe('#/assets');
  });

  test('leads back through the breadcrumb on a large screen', async () => {
    env.isSmallScreen = false;
    env.isMediumScreen = false;

    const onBrowse = vi.fn();

    const { container } = await render(PrimaryToolbar, {
      rootLabel: 'Images',
      subfolderNames: ['2024', 'summer'],
      onBrowse,
    });

    expect(getHeading(container)).toBe('Images chevron_right 2024 chevron_right summer');

    await page.getByRole('button', { name: '2024' }).click();
    expect(onBrowse).toHaveBeenCalledWith(1, false);

    await page.getByRole('button', { name: 'Images' }).click();
    expect(onBrowse).toHaveBeenCalledWith(0, false);
  });

  test('points the breadcrumb separators the other way in a right-to-left locale', async () => {
    env.isSmallScreen = false;
    env.isMediumScreen = false;
    locale.set('ar');

    try {
      const { container } = await render(PrimaryToolbar, {
        rootLabel: 'Images',
        subfolderNames: ['summer'],
        onBrowse: vi.fn(),
      });

      expect(getHeading(container)).toBe('Images chevron_left summer');
    } finally {
      locale.set('en-US');
    }
  });

  test('leaves the breadcrumb out on a small screen, where the back button leads up', async () => {
    env.isSmallScreen = true;

    const onBrowse = vi.fn();

    const { container } = await render(PrimaryToolbar, {
      rootLabel: 'Images',
      subfolderNames: ['2024', 'summer'],
      onBrowse,
    });

    expect(container.querySelector('h2')).toHaveTextContent('summer');
    expect(page.getByRole('button', { name: 'Images' }).elements()).toHaveLength(0);

    await page.getByRole('button', { name: 'Back to Parent Folder' }).click();
    expect(onBrowse).toHaveBeenCalledWith(1, true);
  });

  test('does without actions and a floating button', async () => {
    env.isSmallScreen = false;
    env.isMediumScreen = false;

    await render(PrimaryToolbar, { rootLabel: 'Images', onBrowse: vi.fn() });

    await expect.element(page.getByRole('toolbar', { name: 'Folder' })).toBeVisible();
    expect(page.getByRole('button').elements()).toHaveLength(0);
  });
});
