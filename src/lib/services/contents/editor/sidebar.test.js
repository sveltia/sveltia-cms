import { beforeEach, describe, expect, test, vi } from 'vitest';

import { backend } from '$lib/services/backends';
import { entryEditorSettings } from '$lib/services/contents/editor/settings';
import {
  getSidebarPanels,
  showSidebarPanel,
  sidebarSheetPanel,
} from '$lib/services/contents/editor/sidebar';
import { getReferencingRelationFields } from '$lib/services/contents/entry/relations';
import { env } from '$lib/services/user/env.svelte';

vi.mock('$lib/services/backends', () => ({ backend: { current: undefined } }));
vi.mock('$lib/services/contents/editor/settings', () => ({
  entryEditorSettings: { current: undefined },
}));
vi.mock('$lib/services/contents/entry/relations', () => ({
  getReferencingRelationFields: vi.fn(() => []),
}));
vi.mock('$lib/services/user/env.svelte', () => ({ env: { isSmallScreen: false } }));

/** The backend store is read-only outside its module. */
const mockBackend = /** @type {{ current: any }} */ (backend);

/**
 * Get the keys of the disabled panels.
 * @param {any} draft Entry draft.
 * @returns {string[]} Keys.
 */
const getDisabledKeys = (draft) =>
  getSidebarPanels(draft)
    .filter(({ disabled }) => disabled)
    .map(({ key }) => key);

describe('getSidebarPanels()', () => {
  beforeEach(() => {
    mockBackend.current = undefined;
  });

  test('lists the panels in order', () => {
    expect(getSidebarPanels(undefined)).toEqual([
      { key: 'validation', icon: 'check_circle', disabled: false },
      { key: 'history', icon: 'history', disabled: true },
      { key: 'backlinks', icon: 'article_shortcut', disabled: true },
    ]);
    expect(getReferencingRelationFields).not.toHaveBeenCalled();
  });

  test('offers the history of a saved entry on a Git backend', () => {
    const saved = { collectionName: 'posts', isNew: false };

    expect(getDisabledKeys(saved)).toContain('history');

    mockBackend.current = { isGit: true };
    expect(getDisabledKeys(saved)).not.toContain('history');
    expect(getDisabledKeys({ ...saved, isNew: true })).toContain('history');
  });

  test('offers the backlinks of an entry that can be referenced', () => {
    const draft = { collectionName: 'settings', fileName: 'general' };

    expect(getDisabledKeys(draft)).toContain('backlinks');
    expect(getReferencingRelationFields).toHaveBeenCalledWith({
      collectionName: 'settings',
      fileName: 'general',
    });

    vi.mocked(getReferencingRelationFields).mockReturnValueOnce([/** @type {any} */ ({})]);
    expect(getDisabledKeys(draft)).not.toContain('backlinks');
  });
});

describe('showSidebarPanel()', () => {
  beforeEach(() => {
    sidebarSheetPanel.current = null;
    entryEditorSettings.current = /** @type {any} */ ({ showPreview: true });
  });

  test('opens the panel in the sidebar', () => {
    env.isSmallScreen = false;
    showSidebarPanel('validation');
    expect(entryEditorSettings.current).toEqual({ showPreview: true, sidebarPanel: 'validation' });
    expect(sidebarSheetPanel.current).toBeNull();
  });

  test('opens the panel in the sheet on a small screen, without remembering it', () => {
    env.isSmallScreen = true;
    showSidebarPanel('validation');
    expect(sidebarSheetPanel.current).toBe('validation');
    expect(entryEditorSettings.current).toEqual({ showPreview: true });
  });
});
