import { backend } from '$lib/services/backends';
import { entryEditorSettings } from '$lib/services/contents/editor/settings';
import { hasEntrySlug } from '$lib/services/contents/editor/slug';
import { getReferencingRelationFields } from '$lib/services/contents/entry/relations';
import { env } from '$lib/services/user/env.svelte';
import { createRawState } from '$lib/services/utils/state.svelte';

/**
 * @import { EntryDraft } from '$lib/types/private';
 */

/**
 * @typedef {object} SidebarPanelDef
 * @property {string} key Unique key of the panel, also used in its i18n keys, e.g.
 * `entry_sidebar.validation.title`.
 * @property {string} icon Material icon name.
 * @property {boolean} disabled Whether the panel is unavailable for the draft.
 */

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
