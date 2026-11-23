import { createElement, useEffect } from 'react';
import { flushSync } from 'svelte';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { _resetReactDom, loadReactDom } from '$lib/services/api/react-dom';
import { customPageRegistry } from '$lib/services/api/registries';
import { selectedCustomPageId } from '$lib/services/app/custom-pages';
import { announcedPageStatus, mainAreaTitle } from '$lib/services/app/navigation';
import { env } from '$lib/services/user/env.svelte';

import CustomPage from './custom-page.svelte';

const unmountSpy = vi.fn();

/**
 * React component rendering a page, which reports being unmounted.
 * @returns {import('react').ReactElement} Element.
 */
const Analytics = () => {
  useEffect(() => unmountSpy, []);

  return createElement('p', null, 'Hello from React');
};

/**
 * Another React component rendering a page.
 * @returns {import('react').ReactElement} Element.
 */
const Stats = () => createElement('p', null, 'Stats from React');

describe('CustomPage', () => {
  beforeEach(() => {
    env.isSmallScreen = false;
    announcedPageStatus.current = '';
    customPageRegistry.set('analytics', {
      id: 'analytics',
      label: 'Analytics',
      icon: 'monitoring',
      component: Analytics,
      newTab: false,
    });
    customPageRegistry.set('stats', {
      id: 'stats',
      label: 'Stats',
      icon: 'bar_chart',
      url: 'https://example.com/stats',
      newTab: false,
    });
    customPageRegistry.set('docs', {
      id: 'docs',
      label: 'Docs',
      icon: 'help',
      url: 'https://example.com/docs',
      newTab: true,
    });
  });

  afterEach(() => {
    customPageRegistry.clear();
    selectedCustomPageId.current = '';
  });

  test('renders a React component', async () => {
    selectedCustomPageId.current = 'analytics';

    const { container, unmount } = await render(CustomPage);

    await expect.element(page.getByRole('main', { name: 'Analytics' })).toBeVisible();
    expect(container.querySelector('h2')).toHaveTextContent('Analytics');
    await expect.element(page.getByText('Hello from React')).toBeVisible();
    expect(page.getByRole('button', { name: 'Back' }).elements()).toHaveLength(0);
    expect(mainAreaTitle.current).toBe('Analytics');
    expect(announcedPageStatus.current).toBe('');

    // A page registered again with another component renders the new one in place
    customPageRegistry.set('analytics', {
      id: 'analytics',
      label: 'Analytics',
      icon: 'monitoring',
      component: Stats,
      newTab: false,
    });
    await expect.element(page.getByText('Stats from React')).toBeVisible();
    expect(unmountSpy).toHaveBeenCalledTimes(1);

    unmount();
    expect(page.getByText('Stats from React').elements()).toHaveLength(0);
  });

  test('keeps the React component when the page is registered again with a new label', async () => {
    selectedCustomPageId.current = 'analytics';

    const { container } = await render(CustomPage);

    await expect.element(page.getByText('Hello from React')).toBeVisible();
    customPageRegistry.set('analytics', {
      id: 'analytics',
      label: 'Site Analytics',
      icon: 'monitoring',
      component: Analytics,
      newTab: false,
    });
    await expect.poll(() => container.querySelector('h2')?.textContent).toBe('Site Analytics');
    expect(unmountSpy).not.toHaveBeenCalled();
  });

  test('unmounts the React component along with the page', async () => {
    selectedCustomPageId.current = 'analytics';

    const { unmount } = await render(CustomPage);

    await expect.element(page.getByText('Hello from React')).toBeVisible();
    unmount();
    expect(unmountSpy).toHaveBeenCalledTimes(1);
  });

  test('doesn’t render a React component the user has left before it could', async () => {
    _resetReactDom();
    selectedCustomPageId.current = 'analytics';

    await render(CustomPage);
    flushSync(() => {
      selectedCustomPageId.current = 'stats';
    });
    await loadReactDom();

    await expect.element(page.getByTitle('Stats')).toBeVisible();
    expect(page.getByText('Hello from React').elements()).toHaveLength(0);
  });

  test('embeds a web page', async () => {
    selectedCustomPageId.current = 'stats';

    await render(CustomPage);

    const iframe = page.getByTitle('Stats');

    await expect.element(iframe).toHaveAttribute('src', 'https://example.com/stats');
    expect(iframe.element().tagName).toBe('IFRAME');
    expect(mainAreaTitle.current).toBe('Stats');
  });

  test('offers to go back to the menu on a small screen', async () => {
    env.isSmallScreen = true;
    window.location.hash = '#/pages/stats';
    selectedCustomPageId.current = 'stats';

    await render(CustomPage);
    await page.getByRole('button', { name: 'Back' }).click();
    await expect.poll(() => window.location.hash).toBe('#/menu');
  });

  test.each([
    ['an unregistered page', 'unknown'],
    ['a page opening in a new tab', 'docs'],
    ['the bare route', ''],
  ])('shows Not Found for %s', async (_label, id) => {
    selectedCustomPageId.current = id;

    await render(CustomPage);
    await expect.element(page.getByRole('main', { name: 'Page not found.' })).toBeVisible();
    await expect.element(page.getByText('Page not found.', { exact: true }).last()).toBeVisible();
    expect(announcedPageStatus.current).toBe('Page not found.');
  });

  test('shows a page registered after the URL has been opened', async () => {
    selectedCustomPageId.current = 'late';

    await render(CustomPage);
    await expect.element(page.getByRole('main', { name: 'Page not found.' })).toBeVisible();

    customPageRegistry.set('late', {
      id: 'late',
      label: 'Late',
      icon: 'schedule',
      url: 'https://example.com/late',
      newTab: false,
    });
    await expect.element(page.getByTitle('Late')).toBeVisible();
  });
});
