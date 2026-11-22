import { beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { startSession } from '$lib/services/additions/session';
import { customPageRegistry } from '$lib/services/api/registries';
import { loadAdditions } from '$lib/services/app/additions';
import { selectedCustomPageId } from '$lib/services/app/custom-pages';
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

// Sharing the entry locks and the rest would talk to Sveltia CMS Additions
vi.mock('$lib/services/additions/session', async (importOriginal) => ({
  ...(await importOriginal()),
  startSession: vi.fn(),
}));
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

    // The former CMS configuration page leads to its Administration section
    prefs.devModeEnabled = true;
    window.location.hash = '#/config';
    await expect.poll(() => window.location.hash).toBe('#/admin/config');
    await expect
      .element(page.getByRole('blockquote', { name: 'CMS Configuration' }))
      .toBeInTheDocument();
    expect(selectedPageName.current).toBe('admin');
    expect(searchMode.current).toBeNull();

    // Turning developer mode off there leaves the page with nothing to show
    prefs.devModeEnabled = false;
    await expect.element(page.getByText('Page not found.')).toBeVisible();
  });

  test('has the Administration page only for those who can see a section of it', async () => {
    window.location.hash = '#/admin/users';

    await render(MainRouter);
    await expect.poll(() => selectedPageName.current).toBe('not-found');

    // An admin of Sveltia CMS Additions
    await initTestConfig({
      backend: {
        name: 'github',
        repo: 'me/site',
        auth_type: 'additions',
        base_url: 'https://additions.example.com',
      },
    });
    await loadAdditions();
    user.account = /** @type {any} */ ({ backendName: 'github', login: 'admin', role: 'admin' });
    window.location.hash = '#/collections';
    window.location.hash = '#/admin/users';
    await expect.poll(() => selectedPageName.current).toBe('admin');
    await expect.element(page.getByRole('main', { name: 'Users' })).toBeInTheDocument();
    await expect
      .element(page.getByRole('radio', { name: 'Administration' }))
      .toHaveAttribute('aria-checked', 'true');
  });

  test('shares the entry locks and the rest with Sveltia CMS Additions while mounted', async () => {
    const stopSession = vi.fn();

    vi.mocked(startSession).mockReturnValue(stopSession);
    window.location.hash = '#/collections';

    // Not without it
    const { unmount: unmountWithout } = await render(MainRouter);

    await expect.element(page.getByRole('toolbar', { name: 'Global' })).toBeVisible();
    expect(startSession).not.toHaveBeenCalled();
    await unmountWithout();

    await initTestConfig({
      backend: {
        name: 'github',
        repo: 'me/site',
        auth_type: 'additions',
        base_url: 'https://additions.example.com',
      },
    });
    await loadAdditions();

    const { unmount } = await render(MainRouter);

    await expect.element(page.getByRole('toolbar', { name: 'Global' })).toBeVisible();
    expect(startSession).toHaveBeenCalledOnce();
    expect(stopSession).not.toHaveBeenCalled();

    // Signing out
    await unmount();
    expect(stopSession).toHaveBeenCalledOnce();
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
    window.location.hash = '#/workflow/foo';
    await expect.poll(() => selectedPageName.current).toBe('not-found');

    // Nor does a page name with a suffix
    window.location.hash = '#/collections-foo';
    await expect.poll(() => selectedPageName.current).toBe('not-found');
  });

  test('shows a custom page', async () => {
    customPageRegistry.set('stats', {
      id: 'stats',
      label: 'Stats',
      icon: 'bar_chart',
      url: 'https://example.com/stats',
      newTab: false,
    });
    window.location.hash = '#/pages/stats';

    try {
      await render(MainRouter);
      await expect.element(page.getByTitle('Stats')).toBeVisible();
      expect(selectedPageName.current).toBe('pages');
      expect(selectedCustomPageId.current).toBe('stats');
      expect(searchMode.current).toBeNull();

      // Leaving the page clears the selection
      window.location.hash = '#/collections';
      await expect.poll(() => selectedCustomPageId.current).toBe('');

      // An unregistered page is a dead link
      window.location.hash = '#/pages/unknown';
      await expect.element(page.getByRole('main', { name: 'Page not found.' })).toBeVisible();
      expect(selectedPageName.current).toBe('pages');
    } finally {
      customPageRegistry.clear();
    }
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
