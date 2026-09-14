import { IndexedDB } from '@sveltia/utils/storage';
import { createRawSnippet } from 'svelte';
import { describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { backendName } from '$lib/services/backends';
import { repository } from '$lib/services/backends/git/github/repository';
import { showContentOverlay } from '$lib/services/contents/editor';
import { env } from '$lib/services/user/env.svelte';

import PageContainer from './page-container.svelte';

/**
 * Build a snippet rendering the given text.
 * @param {string} text Text.
 * @returns {import('svelte').Snippet} Snippet.
 */
const snippet = (text) =>
  createRawSnippet(() => ({
    /**
     * Render the content.
     * @returns {string} HTML.
     */
    render: () => `<p>${text}</p>`,
  }));

/**
 * Drag the separator between the panes.
 * @param {HTMLElement} handle Separator.
 * @param {number} distance Distance in pixels.
 */
const drag = (handle, distance) => {
  // The handle captures the pointer, which a synthetic event doesn’t have
  handle.setPointerCapture = vi.fn();
  handle.releasePointerCapture = vi.fn();
  handle.dispatchEvent(
    new PointerEvent('pointerdown', { bubbles: true, pointerId: 1, screenX: 240, screenY: 10 }),
  );
  document.dispatchEvent(
    new PointerEvent('pointermove', {
      bubbles: true,
      pointerId: 1,
      screenX: 240 + distance,
      screenY: 10,
    }),
  );
  document.dispatchEvent(
    new PointerEvent('pointerup', {
      bubbles: true,
      pointerId: 1,
      screenX: 240 + distance,
      screenY: 10,
    }),
  );
};

describe('PageContainer', () => {
  test('puts the sidebar and main area in resizable panes on a large screen', async () => {
    env.isSmallScreen = false;
    backendName.current = 'test-repo';
    showContentOverlay.current = false;

    const { container } = await render(PageContainer, {
      'aria-label': 'Contents',
      uiSettingsKey: 'contents',
      primarySidebar: snippet('Sidebar'),
      main: snippet('Main'),
    });

    const group = page.getByRole('group', { name: 'Contents' });

    await expect.element(group).toHaveAttribute('id', 'page-container');
    await expect.element(page.getByRole('separator')).toBeInTheDocument();
    expect(container.querySelector('#page-container')).not.toHaveAttribute('inert');
    expect([...container.querySelectorAll('p')].map((p) => p.textContent)).toEqual([
      'Sidebar',
      'Main',
    ]);

    // The test backend has no repository to save the width for
    drag(/** @type {HTMLElement} */ (container.querySelector('[role="separator"]')), 80);
    await new Promise((resolve) => {
      setTimeout(resolve, 100);
    });
  });

  test('stacks the sidebar and main area on a small screen', async () => {
    env.isSmallScreen = true;

    const { container } = await render(PageContainer, {
      primarySidebar: snippet('Sidebar'),
      main: snippet('Main'),
    });

    expect(container.querySelector('[role="separator"]')).toBeNull();
    expect([...container.querySelectorAll('p')].map((p) => p.textContent)).toEqual([
      'Sidebar',
      'Main',
    ]);
  });

  test('is inert while an overlay is shown', async () => {
    showContentOverlay.current = true;

    try {
      const { container } = await render(PageContainer, { main: snippet('Main') });

      expect(container.querySelector('#page-container')).toHaveAttribute('inert');
      // The sidebar width is left alone while the overlay is there
      await new Promise((resolve) => {
        window.requestAnimationFrame(resolve);
      });
    } finally {
      showContentOverlay.current = false;
    }
  });

  test('remembers the sidebar width for the repository', async () => {
    env.isSmallScreen = false;
    showContentOverlay.current = false;
    backendName.current = 'github';
    Object.assign(repository, { databaseName: 'sveltia-cms-test-ui' });

    try {
      const { container } = await render(PageContainer, {
        'aria-label': 'Contents',
        uiSettingsKey: 'contents',
        primarySidebar: snippet('Sidebar'),
        main: snippet('Main'),
      });

      await expect.element(page.getByRole('separator')).toBeInTheDocument();

      const outer = /** @type {HTMLElement} */ (container.querySelector('#page-container'));

      outer.style.width = '800px';
      drag(/** @type {HTMLElement} */ (container.querySelector('[role="separator"]')), 80);

      const db = new IndexedDB('sveltia-cms-test-ui', 'ui-settings');

      await expect.poll(async () => (await db.get('contents'))?.sidebarWidth).toBeGreaterThan(240);
    } finally {
      backendName.current = undefined;
      Object.assign(repository, { databaseName: '' });
    }
  });

  test('takes no settings key', async () => {
    env.isSmallScreen = false;
    showContentOverlay.current = false;
    backendName.current = 'test-repo';

    const { container } = await render(PageContainer, {
      primarySidebar: snippet('Sidebar'),
      main: snippet('Main'),
    });

    // Without a key, there is nothing to restore, so the panes aren’t resizable
    await new Promise((resolve) => {
      setTimeout(resolve, 100);
    });
    expect(container.querySelector('[role="separator"]')).toBeNull();
  });

  test('lays out nothing without content', async () => {
    const { container } = await render(PageContainer, {});

    expect(container.querySelector('#page-container')).toBeInTheDocument();
    expect(container.querySelectorAll('p')).toHaveLength(0);
  });
});
