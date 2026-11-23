import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { checkForUpdate } from '$lib/services/additions/site-settings';
import { additionsUsers, loadSiteSettings, loadUsers } from '$lib/services/additions/users.svelte';
import { loadAdditions } from '$lib/services/app/additions';
import { getAdminSections, lastAdminSectionKey } from '$lib/services/app/admin';
import { announcedPageStatus } from '$lib/services/app/navigation';
import { env } from '$lib/services/user/env.svelte';
import { initTestConfig } from '$lib/test/config';

import AdminPage from './admin-page.svelte';

vi.mock('$lib/services/app/admin', async (importOriginal) => ({
  ...(await importOriginal()),
  getAdminSections: vi.fn(),
}));
// The state and the helpers are real, the requests aren’t
vi.mock('$lib/services/additions/users.svelte', async (importOriginal) => ({
  ...(await importOriginal()),
  loadSiteSettings: vi.fn(),
  loadUsers: vi.fn(),
}));
vi.mock('$lib/services/additions/site-settings', async (importOriginal) => ({
  ...(await importOriginal()),
  checkForUpdate: vi.fn(),
}));

const ADMIN_SECTIONS = [
  { key: 'users', labelKey: 'additions.users.title', icon: 'group' },
  { key: 'domains', labelKey: 'additions.users.domains_tab', icon: 'language' },
];

const CONFIG_SECTION = { key: 'config', labelKey: 'cms_config', icon: 'data_object' };

describe('AdminPage', () => {
  beforeEach(async () => {
    // The sections of Sveltia CMS Additions come with its chunk
    await initTestConfig({
      backend: {
        name: 'github',
        repo: 'me/site',
        auth_type: 'additions',
        base_url: 'https://additions.example.com',
      },
    });
    await loadAdditions();
    env.isSmallScreen = false;
    Object.assign(additionsUsers, { users: [], allowedDomains: [], loaded: false });
    vi.mocked(loadUsers).mockImplementation(async () => {
      additionsUsers.loaded = true;
    });
    vi.mocked(loadSiteSettings).mockImplementation(async () => {
      additionsUsers.loaded = true;
    });
    vi.mocked(getAdminSections).mockReturnValue([...ADMIN_SECTIONS, CONFIG_SECTION]);
  });

  afterEach(() => {
    env.isSmallScreen = false;
    window.location.hash = '';
  });

  test('opens the first section, and follows the URL to another', async () => {
    window.location.hash = '#/admin';

    await render(AdminPage);

    await expect.poll(() => window.location.hash).toBe('#/admin/users');
    await expect.element(page.getByRole('main', { name: 'Users' })).toBeVisible();
    await expect
      .element(page.getByRole('option', { name: 'Users' }))
      .toHaveAttribute('aria-selected', 'true');
    // Announced to screen reader users, like the other pages
    await expect
      .poll(() => announcedPageStatus.current)
      .toBe('You’re now viewing the “\u2068Users\u2069” section of the Administration page.');
    // An admin of Sveltia CMS Additions is told about a newer release
    expect(checkForUpdate).toHaveBeenCalledOnce();

    window.location.hash = '#/admin/config';
    await expect
      .element(page.getByRole('blockquote', { name: 'CMS Configuration' }))
      .toBeInTheDocument();
    await expect
      .element(page.getByRole('option', { name: 'CMS Configuration' }))
      .toHaveAttribute('aria-selected', 'true');
    await expect.poll(() => announcedPageStatus.current).toMatch(/“\u2068CMS Configuration\u2069”/);
    // Opened again by the Administration button
    expect(lastAdminSectionKey.current).toBe('config');
  });

  test('shows only the CMS configuration in developer mode, without checking for updates', async () => {
    // Without Sveltia CMS Additions
    await initTestConfig();
    vi.mocked(getAdminSections).mockReturnValue([CONFIG_SECTION]);
    window.location.hash = '#/admin';

    await render(AdminPage);

    await expect.poll(() => window.location.hash).toBe('#/admin/config');
    await expect.poll(() => page.getByRole('option').elements()).toHaveLength(1);
    expect(checkForUpdate).not.toHaveBeenCalled();
  });

  test('says a section that isn’t there can’t be found', async () => {
    // Only for an admin, or deeper than a section
    vi.mocked(getAdminSections).mockReturnValue([CONFIG_SECTION]);
    window.location.hash = '#/admin/users';

    await render(AdminPage);

    // Shown like a section, with a title and the way back
    const notFound = page.getByRole('main', { name: 'Page not found.' });

    await expect.element(notFound).toBeVisible();
    await expect.element(notFound.getByRole('toolbar')).toHaveTextContent('Page not found.');
    expect(announcedPageStatus.current).toBe('Page not found.');

    window.location.hash = '#/admin/config/foo';
    await expect.element(page.getByRole('main', { name: 'Page not found.' })).toBeVisible();
  });

  test('lists the sections as the page on a small screen, then shows the one chosen', async () => {
    env.isSmallScreen = true;
    window.location.hash = '#/admin';

    await render(AdminPage);

    await expect
      .element(page.getByRole('navigation', { name: 'Administration' }).getByRole('toolbar'))
      .toMatchTextContent(/Administration/);
    expect(window.location.hash).toBe('#/admin');
    expect(page.getByRole('main').elements()).toHaveLength(0);
    expect(announcedPageStatus.current).toBe(
      'You’re now viewing the list of Administration sections.',
    );

    await page.getByRole('option', { name: 'Domains' }).click();
    await expect.poll(() => window.location.hash).toBe('#/admin/domains');
    await expect
      .element(page.getByRole('textbox', { name: 'Allowed Domains' }))
      .toBeInTheDocument();
    expect(page.getByRole('navigation', { name: 'Administration' }).elements()).toHaveLength(0);
  });
});
