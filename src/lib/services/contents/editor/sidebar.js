import { _ } from '@sveltia/i18n';

import { isAdditionsEnabled, requireAdditions } from '$lib/services/app/additions';
import { backend } from '$lib/services/backends';
import { entryEditorSettings } from '$lib/services/contents/editor/settings';
import { hasEntrySlug } from '$lib/services/contents/editor/slug';
import { getDraftEntryKey } from '$lib/services/contents/entry/entry-key';
import { getReferencingRelationFields } from '$lib/services/contents/entry/relations';
import { env } from '$lib/services/user/env.svelte';
import { createRawState } from '$lib/services/utils/state.svelte';

/**
 * @import { EntryDraft } from '$lib/types/private';
 */

/**
 * @typedef {object} SidebarPanelDef
 * @property {string} key Unique key of the panel, also used in its i18n keys, e.g.
 * `entry_sidebar.validation.title`. See {@link getSidebarPanelTitle}.
 * @property {string} icon Material icon name.
 * @property {boolean} disabled Whether the panel is unavailable for the draft.
 * @property {number} [badge] Count to show on the panel’s button, e.g. of comments, if any.
 */

/**
 * Get the title of a sidebar panel. The strings of the Conversation panel come with the chunk of
 * Sveltia CMS Additions, along with its others.
 * @param {string} key Panel key.
 * @returns {string} Title.
 */
export const getSidebarPanelTitle = (key) =>
  _(key === 'conversation' ? 'additions.conversation.title' : `entry_sidebar.${key}.title`);

/**
 * Get the label of a sidebar panel’s button or menu item, with the count shown on its badge, if
 * any, e.g. “Conversation (3)”.
 * @param {SidebarPanelDef} panel Panel.
 * @returns {string} Label.
 */
export const getSidebarPanelLabel = ({ key, badge }) => {
  const title = getSidebarPanelTitle(key);

  return badge ? _('entry_sidebar.title_with_count', { values: { title, count: badge } }) : title;
};

/**
 * Key of the sidebar panel shown in the bottom sheet on a small screen, where the sidebar doesn’t
 * fit, or `null` if the sheet is closed. Unlike the sidebar’s own panel, it’s not remembered, so
 * the sheet doesn’t cover the editor whenever an entry is opened.
 * @type {{ current: string | null }}
 */
export const sidebarSheetPanel = createRawState(null);

/**
 * Get the entry editor sidebar panels, in the order they’re listed.
 * @param {EntryDraft | null | undefined} draft Entry draft.
 * @returns {SidebarPanelDef[]} Panels.
 */
export const getSidebarPanels = (draft) => {
  const { collectionName, fileName, isNew = true } = draft ?? {};

  return [
    {
      key: 'slug',
      icon: 'anchor',
      // Available if the entry has a slug of its own, which the panel shows, and lets the user edit
      // if allowed
      disabled: !hasEntrySlug(draft),
    },
    {
      key: 'validation',
      icon: 'check_circle',
      disabled: false,
    },
    {
      key: 'history',
      icon: 'history',
      disabled: !backend.current?.isGit || isNew,
    },
    // Comments kept by Sveltia CMS Additions. A new entry has nothing to attach them to yet
    ...(isAdditionsEnabled()
      ? [
          {
            key: 'conversation',
            icon: 'forum',
            disabled: !getDraftEntryKey(draft),
            // Its chunk is loaded along with the backend, before the user could sign in
            badge: requireAdditions().getConversationCount(draft),
          },
        ]
      : []),
    {
      key: 'backlinks',
      icon: 'article_shortcut',
      // Available if any Relation field anywhere in the site can reference the entry
      disabled:
        !collectionName || !getReferencingRelationFields({ collectionName, fileName }).length,
    },
  ];
};

/**
 * Show the given sidebar panel: in the sidebar, or in the bottom sheet on a small screen.
 * @param {string} key Panel key.
 */
export const showSidebarPanel = (key) => {
  if (env.isSmallScreen) {
    sidebarSheetPanel.current = key;
  } else {
    entryEditorSettings.current = { ...entryEditorSettings.current, sidebarPanel: key };
  }
};
