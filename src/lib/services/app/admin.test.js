import { beforeEach, describe, expect, test, vi } from 'vitest';

import { getAdditions } from '$lib/services/app/additions';
import {
  getAdminLink,
  getAdminPageAnnouncement,
  getAdminSectionKey,
  getAdminSectionPath,
  getAdminSections,
  lastAdminSectionKey,
} from '$lib/services/app/admin';
import { user } from '$lib/services/user/account.svelte';
import { prefs } from '$lib/services/user/prefs.svelte';

vi.mock('@sveltia/i18n', () => ({
  _: vi.fn((key, { values } = {}) => (values ? `${key} ${JSON.stringify(values)}` : key)),
}));
vi.mock('$lib/services/app/additions', () => ({ getAdditions: vi.fn() }));

/** Sections the Sveltia CMS Additions chunk comes with. */
const ADDITIONS_SECTIONS = [
  { key: 'users', labelKey: 'additions.users.title', icon: 'group' },
  { key: 'domains', labelKey: 'additions.users.domains_tab', icon: 'language' },
];

/**
 * Load the Sveltia CMS Additions chunk, or not.
 * @param {boolean} loaded Whether it’s loaded.
 */
const setAdditions = (loaded) => {
  vi.mocked(getAdditions).mockReturnValue(
    loaded ? /** @type {any} */ ({ adminSections: ADDITIONS_SECTIONS }) : undefined,
  );
};

vi.mock('$lib/services/user/account.svelte', () => ({ user: { account: undefined } }));
vi.mock('$lib/services/user/prefs.svelte', () => ({ prefs: { devModeEnabled: false } }));

describe('getAdminSections()', () => {
  beforeEach(() => {
    user.account = undefined;
    prefs.devModeEnabled = false;
    setAdditions(false);
  });

  test('has nothing for most users', () => {
    expect(getAdminSections()).toEqual([]);

    // An editor of Sveltia CMS Additions
    setAdditions(true);
    user.account = /** @type {any} */ ({ role: 'editor' });
    expect(getAdminSections()).toEqual([]);
  });

  test('lists the Sveltia CMS Additions settings for an admin', () => {
    setAdditions(true);
    user.account = /** @type {any} */ ({ role: 'admin' });

    expect(getAdminSections()).toEqual(ADDITIONS_SECTIONS);

    // An admin role with another backend means nothing
    setAdditions(false);
    expect(getAdminSections()).toEqual([]);
  });

  test('lists the CMS configuration in developer mode', () => {
    prefs.devModeEnabled = true;
    expect(getAdminSections()).toEqual([
      { key: 'config', labelKey: 'cms_config', icon: 'data_object' },
    ]);

    setAdditions(true);
    user.account = /** @type {any} */ ({ role: 'admin' });
    expect(getAdminSections().at(-1)?.key).toBe('config');
  });
});

describe('getAdminSectionKey()', () => {
  test('reads the section from the path', () => {
    expect(getAdminSectionKey('/admin')).toBe('');
    expect(getAdminSectionKey('/admin/users')).toBe('users');
    expect(getAdminSectionKey('/admin/users/u1')).toBeUndefined();
    expect(getAdminSectionKey('/admin-x')).toBeUndefined();
    expect(getAdminSectionKey('/collections')).toBeUndefined();
  });
});

describe('getAdminSectionPath()', () => {
  test('gives the path of a section', () => {
    expect(getAdminSectionPath('users')).toBe('/admin/users');
  });
});

describe('getAdminPageAnnouncement()', () => {
  const sections = [{ key: 'users', labelKey: 'additions.users.title', icon: 'group' }];

  test('names the section shown, or says it can’t be found', () => {
    expect(getAdminPageAnnouncement({ sectionKey: 'users', sections, isSmallScreen: false })).toBe(
      'viewing_x_admin_section {"section":"additions.users.title"}',
    );
    expect(getAdminPageAnnouncement({ sectionKey: 'x', sections, isSmallScreen: false })).toBe(
      'page_not_found',
    );
    expect(getAdminPageAnnouncement({ sectionKey: undefined, sections, isSmallScreen: true })).toBe(
      'page_not_found',
    );
  });

  test('announces the list of sections on a small screen only', () => {
    expect(getAdminPageAnnouncement({ sectionKey: '', sections, isSmallScreen: true })).toBe(
      'viewing_admin_section_list',
    );
    // A large screen opens the first section instead
    expect(getAdminPageAnnouncement({ sectionKey: '', sections, isSmallScreen: false })).toBe('');
  });
});

describe('getAdminLink()', () => {
  beforeEach(() => {
    user.account = /** @type {any} */ ({ role: 'admin' });
    prefs.devModeEnabled = false;
    setAdditions(true);
    lastAdminSectionKey.current = '';
  });

  test('opens the section shown last, while the user can still see it', () => {
    expect(getAdminLink()).toBe('/admin');

    lastAdminSectionKey.current = 'domains';
    expect(getAdminLink()).toBe('/admin/domains');

    // The CMS configuration, once developer mode is off
    lastAdminSectionKey.current = 'config';
    expect(getAdminLink()).toBe('/admin');
  });

  test('isn’t there for someone who can see none of the page', () => {
    user.account = /** @type {any} */ ({ role: 'editor' });
    expect(getAdminLink()).toBeUndefined();
  });
});
