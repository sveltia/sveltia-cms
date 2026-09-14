import { beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { appIconURLs } from '$lib/services/app/branding';
import { announcedPageStatus } from '$lib/services/app/navigation';
import { backendName } from '$lib/services/backends';
import { cmsConfigLoaded } from '$lib/services/config';
import { dataLoaded } from '$lib/services/contents';
import { user } from '$lib/services/user/account.svelte';
import { auth } from '$lib/services/user/auth.svelte';
import { env } from '$lib/services/user/env.svelte';
import { prefs } from '$lib/services/user/prefs.svelte';

import App from './app.svelte';

vi.mock('$lib/services/deployments/poll', () => ({
  retainDeployPolling: vi.fn(() => () => {}),
  recheckDeployments: vi.fn(),
}));

/** @type {any} */
const config = {
  load_config_file: false,
  backend: { name: 'test-repo' },
  app_title: 'Acme CMS',
  media_folder: 'static/uploads',
  collections: [
    {
      name: 'posts',
      label: 'Posts',
      folder: 'content/posts',
      fields: [{ name: 'title', widget: 'string' }],
    },
  ],
};

describe('App', () => {
  beforeEach(() => {
    backendName.current = undefined;
    user.account = undefined;
    auth.unauthenticated = true;
    dataLoaded.current = false;
    prefs.locale = 'auto';
    env.isSmallScreen = false;
    env.isLargeScreen = true;
    window.location.hash = '#/collections';
  });

  test('loads the configuration and welcomes the user', async () => {
    const { container } = await render(App, { config });

    await expect.poll(() => cmsConfigLoaded.current).toBe(true);
    await expect.element(page.getByRole('heading', { name: 'Acme CMS' })).toBeVisible();
    expect(document.title).toBe('Acme CMS');
    expect(document.querySelector('link[rel="icon"]')).not.toBeNull();
    // The touch icon and the manifest are generated from the logo
    await expect.poll(() => document.querySelector('link[rel="apple-touch-icon"]')).not.toBeNull();
    expect(document.querySelector('link[rel="manifest"]')).toHaveAttribute(
      'href',
      expect.stringMatching(/^blob:/),
    );
    expect(document.querySelector('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
    // The page changes are announced to screen readers
    expect(container.querySelector('[role="status"]')).toHaveTextContent(
      announcedPageStatus.current,
    );

    // Neither is there until the logo has been processed
    appIconURLs.current = undefined;
    await expect.poll(() => document.querySelector('link[rel="apple-touch-icon"]')).toBeNull();
    expect(document.querySelector('link[rel="manifest"]')).toBeNull();
  });

  test('shows the app once signed in and the data is loaded', async () => {
    await render(App, { config });
    await expect.poll(() => cmsConfigLoaded.current).toBe(true);

    backendName.current = 'test-repo';
    user.account = /** @type {any} */ ({ backendName: 'test-repo' });
    auth.unauthenticated = false;
    dataLoaded.current = true;

    await expect.element(page.getByRole('toolbar', { name: 'Global' })).toBeVisible();
    await expect.element(page.getByRole('group', { name: 'Content Library' })).toBeInTheDocument();

    // Signing out brings the entrance page back
    user.account = undefined;
    dataLoaded.current = false;
    await expect.element(page.getByRole('heading', { name: 'Acme CMS' })).toBeVisible();
  });

  test('opens external links in a new tab', async () => {
    await render(App, { config });

    const link = document.createElement('a');

    link.href = 'https://example.com/';
    link.textContent = 'External';
    document.body.appendChild(link);

    try {
      link.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      expect(link.target).toBe('_blank');
      expect(link.rel).toBe('noopener noreferrer');

      const internal = document.createElement('a');

      internal.href = '#/collections';
      document.body.appendChild(internal);
      internal.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      expect(internal.target).toBe('');
      internal.remove();

      // Anything else is left alone
      document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      expect(link.target).toBe('_blank');
    } finally {
      link.remove();
    }
  });

  test('fixes the position of a static custom mount element', async () => {
    const ncRoot = document.createElement('div');

    ncRoot.id = 'nc-root';
    ncRoot.style.height = '100px';
    document.body.appendChild(ncRoot);

    try {
      await render(App, { config });
      await expect.poll(() => ncRoot.style.position).toBe('relative');
    } finally {
      ncRoot.remove();
    }
  });

  test('pins a collapsed custom mount element below the page header', async () => {
    const header = document.createElement('header');
    const ncRoot = document.createElement('div');

    header.style.height = '50px';
    ncRoot.id = 'nc-root';
    document.body.prepend(header, ncRoot);

    try {
      await render(App, { config });
      await expect.poll(() => ncRoot.style.position).toBe('fixed');
      expect(ncRoot.style.inset).toBe('50px 0px 0px');
    } finally {
      header.remove();
      ncRoot.remove();
    }
  });
});
