import { createRawSnippet } from 'svelte';
import { describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { currentView } from '$lib/services/assets/view/settings';
import { env } from '$lib/services/user/env.svelte';
import { createMockAsset } from '$lib/test/config';

import SecondarySidebar from './secondary-sidebar.svelte';

const children = createRawSnippet((/** @type {() => any} */ getAsset) => ({
  /**
   * Render the content.
   * @returns {string} HTML.
   */
  render: () => `<p>${getAsset().name}</p>`,
}));

describe('SecondarySidebar', () => {
  test('shows the info of the selected asset', async () => {
    env.isLargeScreen = true;
    currentView.current = { ...currentView.current, showInfo: true };

    await render(SecondarySidebar, { asset: createMockAsset({ name: 'photo.png' }), children });

    const group = page.getByRole('group', { name: 'Asset Info' });

    await expect.element(group).toHaveAttribute('id', 'asset-info');
    await expect.element(group).toHaveTextContent('photo.png');
  });

  test('asks to select an asset when none is selected', async () => {
    env.isLargeScreen = true;
    currentView.current = { ...currentView.current, showInfo: true };

    await render(SecondarySidebar, { asset: undefined, children });
    await expect
      .element(page.getByRole('group'))
      .toHaveTextContent('Select an asset to show its info.');
  });

  test('shows the fallback instead when given one', async () => {
    env.isLargeScreen = true;
    currentView.current = { ...currentView.current, showInfo: true };

    const fallback = createRawSnippet(() => ({
      /**
       * Render the content.
       * @returns {string} HTML.
       */
      render: () => '<p>Folder info</p>',
    }));

    await render(SecondarySidebar, { asset: undefined, children, fallback });
    await expect.element(page.getByRole('group')).toHaveTextContent('Folder info');
  });

  test('is hidden while the info pane is off, or on a small screen', async () => {
    env.isLargeScreen = true;
    currentView.current = { ...currentView.current, showInfo: false };

    expect(
      (await render(SecondarySidebar, { asset: undefined, children })).container.children,
    ).toHaveLength(0);

    env.isLargeScreen = false;
    currentView.current = { ...currentView.current, showInfo: true };

    expect(
      (await render(SecondarySidebar, { asset: undefined, children })).container.children,
    ).toHaveLength(0);
  });
});
