import { _ } from '@sveltia/i18n';

import { getCustomPagePath } from '$lib/services/app/custom-pages';

/**
 * @import { CustomPage } from '$lib/types/private';
 */

/**
 * Page to switch to with the page switcher in the toolbar or the bottom navigation.
 * @typedef {object} ToolbarPage
 * @property {string} key Unique key.
 * @property {string} label Label.
 * @property {string} icon Icon name.
 * @property {string} link Path to go to.
 * @property {boolean} selected Whether the page is the current one.
 */

/**
 * Get the pages to switch between with the page switcher: Contents, followed by Assets if there is
 * anything to show, the Editorial Workflow, the custom pages and, on a small screen, Menu.
 * @param {object} args Arguments.
 * @param {string} args.selectedPageName Name of the current page.
 * @param {'contents' | 'assets' | null} args.searchMode Search mode, which makes the page
 * being searched the selected one.
 * @param {boolean} args.hasAssets Whether there is anything to show on the Assets page: an asset
 * folder, an external location or a linked file.
 * @param {string} args.assetsLink Path of the Assets page.
 * @param {boolean} args.workflowEnabled Whether the Editorial Workflow is enabled.
 * @param {string} args.workflowLabelKey Message key of the Editorial Workflow page label.
 * @param {CustomPage[]} args.customPages Custom pages to switch to, which don’t open in a new tab.
 * @param {string} args.selectedCustomPageId ID of the current custom page, if any.
 * @param {boolean} args.isSmallScreen Whether the screen is small.
 * @returns {ToolbarPage[]} Pages.
 */
export const getToolbarPages = ({
  selectedPageName,
  searchMode,
  hasAssets,
  assetsLink,
  workflowEnabled,
  workflowLabelKey,
  customPages,
  selectedCustomPageId,
  isSmallScreen,
}) => {
  /** @type {ToolbarPage[]} */
  const pages = [
    {
      key: 'collections',
      label: _('contents'),
      icon: 'article',
      link: '/collections',
      selected: selectedPageName === 'collections' || searchMode === 'contents',
    },
  ];

  if (hasAssets) {
    pages.push({
      key: 'assets',
      label: _('assets'),
      icon: 'photo',
      link: assetsLink,
      selected: selectedPageName === 'assets' || searchMode === 'assets',
    });
  }

  if (workflowEnabled) {
    pages.push({
      key: 'workflow',
      label: _(workflowLabelKey),
      icon: 'rebase_edit',
      link: '/workflow',
      selected: selectedPageName === 'workflow',
    });
  }

  customPages.forEach((page) => {
    pages.push({
      key: `pages/${page.id}`,
      label: page.label,
      icon: page.icon,
      link: getCustomPagePath(page),
      selected: selectedCustomPageId === page.id,
    });
  });

  if (isSmallScreen) {
    pages.push({
      key: 'menu',
      label: _('menu'),
      icon: 'menu',
      link: '/menu',
      selected: selectedPageName === 'menu',
    });
  }

  return pages;
};
