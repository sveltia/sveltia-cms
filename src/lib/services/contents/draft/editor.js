import { IndexedDB, LocalStorage } from '@sveltia/utils/storage';
import equal from 'fast-deep-equal';
import { get, writable } from 'svelte/store';
import { entryDraft } from '$lib/services/contents/draft';
import { backend } from '$lib/services/backends';

/** @type {IndexedDB | null | undefined} */
let settingsDB = undefined;
const storageKey = 'entry-view';

/**
 * @type {import('svelte/store').Writable<boolean>}
 */
export const showContentOverlay = writable(false);
/**
 * @type {import('svelte/store').Writable<boolean>}
 */
export const showDuplicateToast = writable(false);
/**
 * Copy/translation toast state.
 * @type {import('svelte/store').Writable<{
 * id: number | undefined,
 * show: boolean,
 * status: 'info' | 'success' | 'error' | undefined,
 * message: string | undefined,
 * count: number,
 * sourceLocale: LocaleCode | undefined,
 * }>}
 */
export const copyFromLocaleToast = writable({
  id: undefined,
  show: false,
  status: undefined,
  message: undefined,
  count: 1,
  sourceLocale: undefined,
});
/**
 * @type {import('svelte/store').Writable<?EntryEditorPane>}
 */
export const editorLeftPane = writable(null);
/**
 * @type {import('svelte/store').Writable<?EntryEditorPane>}
 */
export const editorRightPane = writable(null);
/**
 * @type {import('svelte/store').Writable<EntryEditorView | undefined>}
 */
export const entryEditorSettings = writable();
/**
 * View settings for the Select Assets dialog.
 * @type {import('svelte/store').Writable<SelectAssetsView | undefined>}
 */
export const selectAssetsView = writable();

/**
 * Sync the field object/list expander states between locales.
 * @param {Record<FieldKeyPath, boolean>} stateMap - Map of key path and state.
 */
export const syncExpanderStates = (stateMap) => {
  entryDraft.update((_draft) => {
    if (_draft) {
      Object.entries(stateMap).forEach(([keyPath, expanded]) => {
        if (_draft.expanderStates._[keyPath] !== expanded) {
          _draft.expanderStates._[keyPath] = expanded;
        }
      });
    }

    return _draft;
  });
};

/**
 * Join key path segments for the expander UI state.
 * @param {string[]} arr - Key path array, e.g. `testimonials.0.authors.2.foo.bar`.
 * @param {number} end - End index for `Array.slice()`.
 * @returns {string} Joined string, e.g. `testimonials.0.authors.10.foo#.bar#`.
 */
export const joinExpanderKeyPathSegments = (arr, end) =>
  arr
    .slice(0, end)
    .map((k) => `${k}#`)
    .join('.')
    .replaceAll(/#\.(\d+)#/g, '.$1');

/**
 * Expand any invalid fields, including the parent list/object(s).
 */
export const expandInvalidFields = () => {
  /** @type {Record<FieldKeyPath, boolean>} */
  const stateMap = {};

  Object.values(get(entryDraft)?.validities ?? {}).forEach((validities) => {
    Object.entries(validities).forEach(([keyPath, { valid }]) => {
      if (!valid) {
        keyPath.split('.').forEach((_key, index, arr) => {
          stateMap[joinExpanderKeyPathSegments(arr, index + 1)] = true;
        });
      }
    });
  });

  syncExpanderStates(stateMap);
};

/**
 * Initialize {@link entryEditorSettings}, {@link selectAssetsView} and relevant subscribers.
 * @param {BackendService} _backend - Backend service.
 */
const initSettings = async ({ repository }) => {
  const { databaseName } = repository ?? {};

  settingsDB = databaseName ? new IndexedDB(databaseName, 'ui-settings') : null;

  const legacyCache = await LocalStorage.get(`sveltia-cms.${storageKey}`);
  const settings = {
    showPreview: true,
    syncScrolling: true,
    selectAssetsView: { type: 'grid' },
    ...(legacyCache ?? (await settingsDB?.get(storageKey)) ?? {}),
  };

  entryEditorSettings.set(settings);
  selectAssetsView.set(settings.selectAssetsView);

  entryEditorSettings.subscribe((_settings) => {
    (async () => {
      try {
        if (!equal(_settings, await settingsDB?.get(storageKey))) {
          await settingsDB?.set(storageKey, _settings);
        }
      } catch {
        //
      }
    })();
  });

  selectAssetsView.subscribe((view) => {
    if (!view || !Object.keys(view).length) {
      return;
    }

    const savedView = get(entryEditorSettings)?.selectAssetsView ?? {};

    if (!equal(view, savedView)) {
      entryEditorSettings.update((_settings) => ({ ..._settings, selectAssetsView: view }));
    }
  });

  // Delete legacy cache on LocalStorage as we have migrated to IndexedDB
  // @todo Remove this migration before GA
  if (legacyCache) {
    await settingsDB?.set(storageKey, settings);
    await LocalStorage.delete(`sveltia-cms.${storageKey}`);
  }
};

backend.subscribe((_backend) => {
  if (_backend && !get(entryEditorSettings)) {
    initSettings(_backend);
  }
});
