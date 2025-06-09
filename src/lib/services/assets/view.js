import { IndexedDB } from '@sveltia/utils/storage';
import { compare } from '@sveltia/utils/string';
import equal from 'fast-deep-equal';
import { derived, get, writable } from 'svelte/store';
import { _, locale as appLocale } from 'svelte-i18n';
import {
  allAssets,
  getAssetKind,
  selectedAssetFolder,
  selectedAssets,
  uploadingAssets,
} from '$lib/services/assets';
import { backend } from '$lib/services/backends';
import { siteConfig } from '$lib/services/config';
import { prefs } from '$lib/services/user/prefs';
import { getRegex } from '$lib/services/utils/misc';

/**
 * @import { Readable, Writable } from 'svelte/store';
 * @import {
 * Asset,
 * AssetFolderInfo,
 * AssetListView,
 * BackendService,
 * FilteringConditions,
 * GroupingConditions,
 * SortingConditions,
 * } from '$lib/types/private';
 */

/**
 * Whether to show the Upload Assets dialog.
 */
export const showUploadAssetsDialog = writable(false);
/**
 * @type {Readable<boolean>}
 */
export const showUploadAssetsConfirmDialog = derived(
  [uploadingAssets],
  ([_uploadingAssets], set) => {
    set(!!_uploadingAssets.files.length);
  },
);

/**
 * Get the label for the given collection. It can be a category name if the folder is a
 * collection-specific asset folder.
 * @param {AssetFolderInfo} folder Folder info.
 * @returns {string} Human-readable label.
 * @see https://decapcms.org/docs/collection-folder/#media-and-public-folder
 */
export const getFolderLabelByCollection = ({ collectionName, fileName, internalPath }) => {
  if (collectionName === undefined) {
    return get(_)(internalPath === undefined ? 'all_assets' : 'global_assets');
  }

  const collection = get(siteConfig)?.collections.find(({ name }) => name === collectionName);
  const collectionLabel = collection?.label || collection?.name || collectionName;

  if (!fileName) {
    return collectionLabel;
  }

  const file = collection?.files?.find(({ name }) => name === fileName);
  const fileLabel = file?.label || file?.name || fileName;

  return `${collectionLabel} › ${fileLabel}`;
};

/**
 * Get an asset’s property value.
 * @param {Asset} asset Asset.
 * @param {string} key Sorting key. A field name of the asset or a special key like `commit_author`,
 * `commit_date`, or `name`.
 * @returns {any} Value.
 */
const getValue = (asset, key) => {
  const { commitAuthor: { name, login, email } = {}, commitDate } = asset;

  if (key === 'commit_author') {
    return name || login || email;
  }

  if (key === 'commit_date') {
    return commitDate;
  }

  // Exclude the file extension when sorting by name to sort numbered files properly, e.g.
  // `hero.png`, `hero-1.png`, `hero-2.png` instead of `hero-1.png`, `hero-2.png`, `hero.png`
  if (key === 'name') {
    return asset.name.split('.')[0];
  }

  return /** @type {Record<string, any>} */ (asset)[key] ?? '';
};

/**
 * Sort the given assets.
 * @param {Asset[]} assets Asset list.
 * @param {SortingConditions} [conditions] Sorting conditions.
 * @returns {Asset[]} Sorted asset list.
 */
const sortAssets = (assets, { key, order } = {}) => {
  if (!key || !order) {
    return assets;
  }

  const _assets = [...assets];

  const type =
    { commit_author: String, commit_date: Date }[key] ||
    /** @type {Record<string, any>} */ (_assets[0])?.[key]?.constructor ||
    String;

  _assets.sort((a, b) => {
    const aValue = getValue(a, key);
    const bValue = getValue(b, key);

    if (type === String) {
      return compare(aValue, bValue);
    }

    if (type === Date) {
      return Number(aValue) - Number(bValue);
    }

    return aValue - bValue;
  });

  if (order === 'descending') {
    _assets.reverse();
  }

  return _assets;
};

/**
 * Filter the given assets.
 * @param {Asset[]} assets Asset list.
 * @param {FilteringConditions} [conditions] Filtering conditions.
 * @returns {Asset[]} Filtered asset list.
 */
const filterAssets = (assets, { field, pattern } = { field: '', pattern: '' }) => {
  if (!field) {
    return assets;
  }

  if (field === 'fileType') {
    return assets.filter(({ path }) => getAssetKind(path) === pattern);
  }

  const regex = getRegex(pattern);

  return assets.filter((asset) => {
    const value = /** @type {Record<string, any>} */ (asset)[field];

    if (regex) {
      return regex.test(String(value ?? ''));
    }

    return value === pattern;
  });
};

/**
 * Group the given assets.
 * @param {Asset[]} assets Asset list.
 * @param {GroupingConditions} [conditions] Grouping conditions.
 * @returns {Record<string, Asset[]>} Grouped assets, where key is a group label and value is an
 * asset list.
 */
const groupAssets = (assets, { field, pattern } = { field: '', pattern: undefined }) => {
  if (!field) {
    return assets.length ? { '*': assets } : {};
  }

  const regex = getRegex(pattern);
  /** @type {Record<string, Asset[]>} */
  const groups = {};
  const otherKey = get(_)('other');

  assets.forEach((asset) => {
    const value = /** @type {Record<string, any>} */ (asset)[field];
    /** @type {string} */
    let key;

    if (regex) {
      [key = otherKey] = String(value ?? '').match(regex) ?? [];
    } else {
      key = value;
    }

    if (!(key in groups)) {
      groups[key] = [];
    }

    groups[key].push(asset);
  });

  // Sort groups by key
  return Object.fromEntries(Object.entries(groups).sort(([aKey], [bKey]) => compare(aKey, bKey)));
};

/**
 * Default view settings for the selected asset collection.
 * @type {AssetListView}
 */
const defaultView = {
  type: 'grid',
  showInfo: true,
  sort: {
    key: 'name',
    order: 'ascending',
  },
};

/**
 * View settings for the selected asset collection.
 * @type {Writable<AssetListView>}
 */
export const currentView = writable({ type: 'grid', showInfo: true });

/**
 * View settings for all the asset collection.
 * @type {Writable<Record<string, AssetListView> | undefined>}
 */
const assetListSettings = writable();

/**
 * List of sort fields for the selected asset collection.
 * @type {Readable<{ key: string, label: string }[]>}
 */
export const sortFields = derived(
  // Include `appLocale` as a dependency because it returns a localized label
  [allAssets, appLocale],
  ([_allAssets], set) => {
    const _sortFields = ['name'];

    if (_allAssets.every((asset) => !!asset.commitAuthor)) {
      _sortFields.push('commit_author');
    }

    if (_allAssets.every((asset) => !!asset.commitDate)) {
      _sortFields.push('commit_date');
    }

    set(_sortFields.map((key) => ({ key, label: get(_)(`sort_keys.${key}`) })));
  },
);
/**
 * List of all the assets for the selected asset collection.
 * @type {Readable<Asset[]>}
 */
export const listedAssets = derived(
  [allAssets, selectedAssetFolder],
  ([_allAssets, _selectedAssetFolder], set) => {
    if (_allAssets && _selectedAssetFolder && _selectedAssetFolder.internalPath !== undefined) {
      set(_allAssets.filter(({ folder }) => equal(folder, _selectedAssetFolder)));
    } else {
      set(_allAssets ? [..._allAssets] : []);
    }
  },
);
/**
 * Sorted, filtered and grouped assets for the selected asset collection.
 * @type {Readable<Record<string, Asset[]>>}
 */
export const assetGroups = derived(
  [listedAssets, currentView],
  ([_listedAssets, _currentView], set) => {
    /** @type {Asset[]} */
    let assets = [..._listedAssets];

    assets = sortAssets(assets, _currentView.sort);
    assets = filterAssets(assets, _currentView.filter);

    const groups = groupAssets(assets, _currentView.group);

    if (!equal(get(assetGroups), groups)) {
      set(groups);
    }
  },
);

/**
 * Initialize {@link assetListSettings} and relevant subscribers.
 * @param {BackendService} _backend Backend service.
 */
const initSettings = async ({ repository }) => {
  const { databaseName } = repository ?? {};
  const settingsDB = databaseName ? new IndexedDB(databaseName, 'ui-settings') : null;
  const storageKey = 'assets-view';

  assetListSettings.set((await settingsDB?.get(storageKey)) ?? {});

  assetListSettings.subscribe((_settings) => {
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

  selectedAssetFolder.subscribe((folder) => {
    const view =
      get(assetListSettings)?.[folder?.internalPath ?? '*'] ?? structuredClone(defaultView);

    if (!equal(view, get(currentView))) {
      currentView.set(view);
    }
  });

  currentView.subscribe((view) => {
    const path = get(selectedAssetFolder)?.internalPath ?? '*';
    const savedView = get(assetListSettings)?.[path] ?? {};

    if (!equal(view, savedView)) {
      assetListSettings.update((_settings) => ({ ..._settings, [path]: view }));
    }
  });
};

backend.subscribe((_backend) => {
  if (_backend && !get(assetListSettings)) {
    initSettings(_backend);
  }
});

listedAssets.subscribe((assets) => {
  selectedAssets.set([]);

  if (get(prefs).devModeEnabled) {
    // eslint-disable-next-line no-console
    console.info('listedAssets', assets);
  }
});
