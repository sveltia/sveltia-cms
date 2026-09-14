import { createRawSnippet } from 'svelte';
import { describe, expect, test } from 'vitest';
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

describe('PrimaryToolbar', () => {
  test('shows the folder title, path and actions on a large screen', async () => {
    env.isSmallScreen = false;
    env.isMediumScreen = false;

    const { container } = await render(PrimaryToolbar, {
      title: 'Images',
      path: 'static/images',
      actions,
    });

    await expect.element(page.getByRole('toolbar', { name: 'Folder' })).toBeVisible();
    expect(container.querySelector('h2')).toHaveTextContent('Images /static/images');
    await expect.element(page.getByRole('button', { name: 'Action' })).toBeVisible();
  });

  test('shows a back button instead on a small screen', async () => {
    env.isSmallScreen = true;
    window.location.hash = '#/assets/static/images';

    const { container } = await render(PrimaryToolbar, {
      title: 'Images',
      path: 'static/images',
      actions,
    });

    expect(container.querySelector('h2')).toHaveTextContent('Images');
    expect(page.getByRole('button', { name: 'Action' }).elements()).toHaveLength(0);

    await page.getByRole('button', { name: 'Back to Asset Folder List' }).click();
    await expect.poll(() => window.location.hash).toBe('#/assets');
  });

  test('does without actions and a floating button', async () => {
    env.isSmallScreen = false;
    env.isMediumScreen = false;

    await render(PrimaryToolbar, { title: 'Images' });

    await expect.element(page.getByRole('toolbar', { name: 'Folder' })).toBeVisible();
    expect(page.getByRole('button').elements()).toHaveLength(0);
  });
});
