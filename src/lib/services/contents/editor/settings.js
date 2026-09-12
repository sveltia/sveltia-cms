import equal from 'fast-deep-equal';
import { untrack } from 'svelte';

import { backend } from '$lib/services/backends';
import { initViewSettingsStorage } from '$lib/services/common/view';
import { selectAssetsView } from '$lib/services/contents/editor';
import { createRawState, createRootEffect } from '$lib/services/utils/state.svelte';

/**
 * @import { BackendService, EntryEditorView } from '$lib/types/private';
 */

/**
 * View settings for the entry editor.
 * @type {{ current: EntryEditorView | undefined }}
 */
export const entryEditorSettings = createRawState();

/**
 * Functions to stop the effects created by {@link initSettings}, so that they don’t pile up when
 * the settings are initialized again.
 * @type {{ entryEditorSettings?: () => void, selectAssetsView?: () => void }}
 */
const effectStoppers = {};

/**
 * Initialize {@link entryEditorSettings}, {@link selectAssetsView} and relevant effects.
 * @param {BackendService} _backend Backend service.
 */
export const initSettings = async ({ repository }) => {
  // Stop the previous effects to prevent memory leaks
  effectStoppers.entryEditorSettings?.();
  effectStoppers.selectAssetsView?.();

  effectStoppers.entryEditorSettings = await initViewSettingsStorage(
    repository,
    'entry-view',
    entryEditorSettings,
    {
      defaults: {
        showSecondPane: true,
        showPreview: true,
        syncScrolling: true,
        selectAssetsView: { type: 'grid' },
      },
    },
  );

  selectAssetsView.current = entryEditorSettings.current?.selectAssetsView;

  effectStoppers.selectAssetsView = createRootEffect(() => {
    const view = selectAssetsView.current;

    if (!view || !Object.keys(view).length) {
      return;
    }

    untrack(() => {
      const _settings = entryEditorSettings.current;
      const savedView = _settings?.selectAssetsView ?? {};

      if (!equal(view, savedView)) {
        entryEditorSettings.current = { ..._settings, selectAssetsView: view };
      }
    });
  });
};

createRootEffect(() => {
  const { current: _backend } = backend;

  if (_backend && !untrack(() => entryEditorSettings.current)) {
    initSettings(_backend);
  }
});
