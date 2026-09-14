import { beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { selectedPageName } from '$lib/services/app/navigation';
import { backendName } from '$lib/services/backends';
import {
  contentUpdatesToast,
  UPDATE_TOAST_DEFAULT_STATE,
} from '$lib/services/contents/collection/data';
import { searchMode, searchTerms } from '$lib/services/search';
import { user } from '$lib/services/user/account.svelte';
import { env } from '$lib/services/user/env.svelte';
import { prefs } from '$lib/services/user/prefs.svelte';
import { createMockEntry, initTestConfig, setEntries } from '$lib/test/config';

import MainRouter from './main-router.svelte';

vi.mock('$lib/services/deployments/poll', () => ({
  retainDeployPolling: vi.fn(() => () => {}),
  recheckDeployments: vi.fn(),
}));

describe('MainRouter', () => {
  beforeEach(async () => {
    await initTestConfig({ backend: { name: 'github', repo: 'me/site' } });
    setEntries([createMockEntry({ slug: 'hello', content: { _default: { title: 'Hello' } } })]);
    backendName.current = 'github';
    user.account = /** @type {any} */ ({ backendName: 'github', login: 'octocat' });
    env.isSmallScreen = false;
    env.isLargeScreen = true;
    env.isLocalHost = true;
    prefs.devModeEnabled = false;
    contentUpdatesToast.current = { ...UPDATE_TOAST_DEFAULT_STATE };
    selectedPageName.current = '';
    searchMode.current = null;
  });

  test('shows the global toolbar and the page for the URL', async () => {
    window.location.hash = '#/collections/posts';

    await render(MainRouter);

    await expect.element(page.getByRole('toolbar', { name: 'Global' })).toBeVisible();
    await expect.element(page.getByRole('group', { name: 'Content Library' })).toBeInTheDocument();
    expect(selectedPageName.current).toBe('collections');
    expect(searchMode.current).toBe('contents');

    // Following the URL
    window.location.hash = '#/assets/-/all';
    await expect.element(page.getByRole('group', { name: 'Asset Library' })).toBeInTheDocument();
    expect(selectedPageName.current).toBe('assets');
    expect(searchMode.current).toBe('assets');

    window.location.hash = '#/config';
    await expect
      .element(page.getByRole('blockquote', { name: 'CMS Configuration' }))
      .toBeInTheDocument();
    expect(searchMode.current).toBeNull();
  });

  test('opens the content library from the root', async () => {
    window.location.hash = '#/';

    await render(MainRouter);
    await expect.poll(() => window.location.hash).toBe('#/collections');
    await expect.element(page.getByRole('group', { name: 'Content Library' })).toBeInTheDocument();
  });

  test('redirects a Netlify/Decap CMS entry link', async () => {
    window.location.hash = '#/edit/posts/hello';

    await render(MainRouter);
    await expect.poll(() => window.location.hash).toBe('#/collections/posts/entries/hello');
    await expect.element(page.getByRole('group', { name: 'Content Editor' })).toBeInTheDocument();
  });

  test('shows the Not Found page for a dead link', async () => {
    window.location.hash = '#/unknown';

    await render(MainRouter);
    await expect.element(page.getByText('Page not found.')).toBeInTheDocument();
    expect(selectedPageName.current).toBe('not-found');

    // A standalone page takes no sub path
    prefs.devModeEnabled = true;
    window.location.hash = '#/config';
    await expect.poll(() => selectedPageName.current).toBe('config');
    window.location.hash = '#/config/foo';
    await expect.poll(() => selectedPageName.current).toBe('not-found');

    // Nor does a page name with a suffix
    window.location.hash = '#/collections-foo';
    await expect.poll(() => selectedPageName.current).toBe('not-found');
  });

  test('searches the contents or assets, depending on the mode', async () => {
    searchMode.current = 'assets';
    searchTerms.current = 'x';
    window.location.hash = '#/search/x';

    await render(MainRouter);
    await expect.element(page.getByRole('group', { name: 'Asset Library' })).toBeInTheDocument();
    expect(selectedPageName.current).toBe('search');
  });

  test('offers the bottom navigation and the menu page on a small screen', async () => {
    env.isSmallScreen = true;
    env.isLargeScreen = false;
    window.location.hash = '#/menu';

    const { container } = await render(MainRouter);

    expect(page.getByRole('toolbar', { name: 'Global' }).elements()).toHaveLength(1);
    await expect
      .element(page.getByRole('toolbar', { name: 'Global' }).getByRole('radio', { name: 'Menu' }))
      .toBeVisible();
    expect(container.querySelector('h2')).toHaveTextContent('Menu');
  });

  test('offers to sign in on a mobile device away from localhost', async () => {
    env.hasMouse = true;
    env.isLocalHost = false;
    user.account = /** @type {any} */ ({ backendName: 'github', login: 'octocat', token: 'abc' });
    window.location.hash = '#/collections';

    try {
      await render(MainRouter);
      await expect.element(page.getByRole('button', { name: 'Give it a try' })).toBeVisible();
    } finally {
      env.isLocalHost = true;
    }
  });
});
