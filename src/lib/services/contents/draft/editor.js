import { IndexedDB } from '@sveltia/utils/storage';
import equal from 'fast-deep-equal';
import { get, writable } from 'svelte/store';
import { backend } from '$lib/services/backends';
import { entryDraft } from '$lib/services/contents/draft';
import { getFieldConfig } from '$lib/services/contents/entry/fields';

/**
 * @type {import('svelte/store').Writable<boolean>}
 */
export const showContentOverlay = writable(false);
/**
 * @type {import('svelte/store').Writable<boolean>}
 */
export const showDuplicateToast = writable(false);
/**
 * @type {import('svelte/store').Writable<{ show: boolean, multiple: boolean, resolve?: Function }>}
 */
export const translatorApiKeyDialogState = writable({ show: false, multiple: false });
/**
 * Copy/translation toast state.
 * @type {import('svelte/store').Writable<{
 * id: number | undefined,
 * show: boolean,
 * status: 'info' | 'success' | 'error',
 * message: string | undefined,
 * count: number,
 * sourceLocale: LocaleCode | undefined,
 * }>}
 */
export const copyFromLocaleToast = writable({
  id: undefined,
  show: false,
  status: 'success',
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
 * Get a list of keys for the expander states, given the key path. The returned keys could include
 * nested lists and objects.
 * @param {object} args - Partial arguments for {@link getFieldConfig}.
 * @param {string} args.collectionName - Collection name.
 * @param {string} [args.fileName] - File name.
 * @param {FlattenedEntryContent} args.valueMap - Object holding current entry values.
 * @param {FieldKeyPath} args.keyPath - Key path, e.g. `testimonials.0.authors.2.foo`.
 * @returns {string[]} Keys, e.g. `['testimonials', 'testimonials.0', 'testimonials.0.authors',
 * 'testimonials.0.authors.2', 'testimonials.0.authors.2.foo']`.
 */
export const getExpanderKeys = ({ collectionName, fileName, valueMap, keyPath }) => {
  const keys = new Set();

  keyPath.split('.').forEach((_keyPart, index, arr) => {
    const _keyPath = arr.slice(0, index + 1).join('.');
    const config = getFieldConfig({ collectionName, fileName, valueMap, keyPath: _keyPath });
    const endingWithNumber = /\.\d+$/.test(_keyPath);

    if (config?.widget === 'object') {
      if (endingWithNumber) {
        keys.add(_keyPath);
      }

      keys.add(`${_keyPath}#`);
    } else if (config?.widget === 'list') {
      keys.add(endingWithNumber ? _keyPath : `${_keyPath}#`);
    } else if (index > 0) {
      const parentKeyPath = arr.slice(0, index).join('.');

      const parentConfig = getFieldConfig({
        collectionName,
        fileName,
        valueMap,
        keyPath: parentKeyPath,
      });

      if (parentConfig?.widget === 'object' && /** @type {ObjectField} */ (parentConfig).fields) {
        keys.add(`${parentKeyPath}.${parentConfig.name}#`);
      }

      if (parentConfig?.widget === 'list' && /** @type {ListField} */ (parentConfig).field) {
        keys.add(_keyPath);
      }
    }
  });

  return [...keys];
};

/**
 * Expand any invalid fields, including the parent list/object(s).
 * @param {object} args - Partial arguments for {@link getFieldConfig}.
 * @param {string} args.collectionName - Collection name.
 * @param {string} [args.fileName] - File name.
 * @param {Record<LocaleCode, FlattenedEntryContent>} args.currentValues - Field values.
 */
export const expandInvalidFields = ({ collectionName, fileName, currentValues }) => {
  /** @type {Record<FieldKeyPath, boolean>} */
  const stateMap = {};

  Object.entries(get(entryDraft)?.validities ?? {}).forEach(([locale, validities]) => {
    Object.entries(validities).forEach(([keyPath, { valid }]) => {
      if (!valid) {
        getExpanderKeys({
          collectionName,
          fileName,
          valueMap: currentValues[locale],
          keyPath,
        }).forEach((key) => {
          stateMap[key] = true;
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
  const settingsDB = databaseName ? new IndexedDB(databaseName, 'ui-settings') : null;
  const storageKey = 'entry-view';

  const settings = {
    showPreview: true,
    syncScrolling: true,
    selectAssetsView: { type: 'grid' },
    ...((await settingsDB?.get(storageKey)) ?? {}),
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
};

backend.subscribe((_backend) => {
  if (_backend && !get(entryEditorSettings)) {
    initSettings(_backend);
  }
});
