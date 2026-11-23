import { _ } from '@sveltia/i18n';

import { getAdditions } from '$lib/services/app/additions';
import { user } from '$lib/services/user/account.svelte';
import { prefs } from '$lib/services/user/prefs.svelte';
import { createRawState } from '$lib/services/utils/state.svelte';

/**
 * @import { Component } from 'svelte';
 */

/**
 * A section of the Administration page, listed in its sidebar.
 * @typedef {object} AdminSection
 * @property {string} key Key, which is also the last segment of its path, e.g. `users` for
 * `/admin/users`.
 * @property {string} labelKey Message key of its label.
 * @property {string} icon Material Symbols icon name.
 * @property {Component<{ title: string }>} [component] Panel it shows, for a section that comes
 * with the Sveltia CMS Additions chunk.
 */

/**
 * Path of the Administration page.
 */
export const ADMIN_PATH = '/admin';

/**
 * Section showing the CMS configuration, for developers.
 * @type {AdminSection}
 */
const CONFIG_SECTION = { key: 'config', labelKey: 'cms_config', icon: 'data_object' };

/**
 * Get the sections of the Administration page the signed-in user can see: user management and the
 * service’s settings for an admin of Sveltia CMS Additions, which come with its chunk, and the CMS
 * configuration while developer mode is on. With none, the page isn’t offered at all.
 * @returns {AdminSection[]} Sections, in the order they’re listed.
 */
export const getAdminSections = () => [
  ...(user.account?.role === 'admin' ? (getAdditions()?.adminSections ?? []) : []),
  ...(prefs.devModeEnabled ? [CONFIG_SECTION] : []),
];

/**
 * Get the path of an Administration section.
 * @param {string} key Section key, e.g. `users`.
 * @returns {string} Path, e.g. `/admin/users`.
 */
export const getAdminSectionPath = (key) => `${ADMIN_PATH}/${key}`;

/**
 * Key of the section shown last, which the Administration button opens again, like the Assets
 * button opens the folder shown last.
 */
export const lastAdminSectionKey = createRawState('');

/**
 * Get the path the Administration button opens: the section shown last, if the user can still see
 * it, or else the page itself, which opens on its first section.
 * @returns {string | undefined} Path, or `undefined` if the user can see none of the page.
 */
export const getAdminLink = () => {
  const sections = getAdminSections();
  const key = lastAdminSectionKey.current;

  if (!sections.length) {
    return undefined;
  }

  return sections.some((section) => section.key === key) ? getAdminSectionPath(key) : ADMIN_PATH;
};

/**
 * Get the section the given URL path points to.
 * @param {string} path URL path, e.g. `/admin/users`.
 * @returns {string | undefined} Section key, an empty string for the page itself, which lists the
 * sections on a small screen, or `undefined` if the path isn’t on the page or goes deeper than a
 * section.
 */
export const getAdminSectionKey = (path) =>
  path.match(/^\/admin(?:\/(?<key>[^/]+))?$/)?.groups?.key ??
  (path === ADMIN_PATH ? '' : undefined);

/**
 * Get what to announce to screen reader users when the Administration page shows another section,
 * like the other pages announce what they show.
 * @param {object} args Arguments.
 * @param {string | undefined} args.sectionKey Key of the section in the URL, from
 * {@link getAdminSectionKey}.
 * @param {AdminSection[]} args.sections Sections the user can see.
 * @param {boolean} args.isSmallScreen Whether the screen is small, where the page itself lists the
 * sections. On a large screen, it opens the first section instead, which is announced then.
 * @returns {string} Announcement, or an empty string if there’s nothing to announce yet.
 */
export const getAdminPageAnnouncement = ({ sectionKey, sections, isSmallScreen }) => {
  if (sectionKey === '') {
    return isSmallScreen ? _('viewing_admin_section_list') : '';
  }

  const section = sections.find(({ key }) => key === sectionKey);

  return section
    ? _('viewing_x_admin_section', { values: { section: _(section.labelKey) } })
    : _('page_not_found');
};
