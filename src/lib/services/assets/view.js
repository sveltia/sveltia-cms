import equal from 'fast-deep-equal';
import { _ } from 'svelte-i18n';
import { derived, get, writable } from 'svelte/store';
import {
  allAssetPaths,
  allAssets,
  assetExtensions,
  selectedAssetFolderPath,
  selectedAssets,
} from '$lib/services/assets';
import { user } from '$lib/services/auth';
import { siteConfig } from '$lib/services/config';
import LocalStorage from '$lib/services/utils/local-storage';

const storageKey = 'sveltia-cms.assets-view';

/**
 * Get the public URL for the given asset.
 * @param {Asset} asset Asset file, such as an image.
 * @param {object} [options] Options.
 * @param {boolean} [options.pathOnly] Whether to use the absolute path instead of the complete URL.
 * @returns {string} URL that can be displayed in the app.
 */
export const getAssetURL = (asset, { pathOnly = false } = {}) => {
  if (asset.tempURL && !pathOnly) {
    return asset.tempURL;
  }

  const { publicPath } =
    get(allAssetPaths).find(({ collectionName }) => collectionName === asset.collectionName) ||
    get(allAssetPaths).find(({ collectionName }) => collectionName === null);

  const baseURL = pathOnly ? '' : get(siteConfig).site_url || '';
  const path = asset.path.replace(asset.folder, publicPath);

  return `${baseURL}${path}`;
};

/**
 * Get the label for the given folder path. It can be a category name if the folder is a
 * collection-specific asset folder.
 * @param {string} folderPath Media folder path.
 * @returns {string} Human-readable label.
 */
export const getFolderLabel = (folderPath) => {
  const { media_folder: defaultMediaFolder, collections } = get(siteConfig);

  if (!folderPath) {
    return get(_)('all_files');
  }

  if (folderPath === defaultMediaFolder) {
    return get(_)('uncategorized');
  }

  return (
    collections.find(
      ({ media_folder: folder = '' }) =>
        folder.startsWith('/') && folder.substring(1) === folderPath,
    )?.label || ''
  );
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
    { commit_author: String, commit_date: Date }[key] || _assets[0]?.[key]?.constructor || String;

  /**
   * Get an asset’s property value.
   * @param {Asset} asset Asset.
   * @returns {*} Value.
   */
  const getValue = (asset) => {
    const { commitAuthor: { name, email } = {}, commitDate } = asset;

    if (key === 'commit_author') {
      return name || email;
    }

    if (key === 'commit_date') {
      return commitDate;
    }

    return asset[key] || '';
  };

  _assets.sort((a, b) => {
    const aValue = getValue(a);
    const bValue = getValue(b);

    return type === String ? aValue.localeCompare(bValue) : aValue - bValue;
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
const filterAssets = (assets, { field, pattern } = {}) => {
  if (!field) {
    return assets;
  }

  if (field === 'fileType') {
    return assets.filter(({ path }) =>
      pattern === 'other'
        ? !Object.values(assetExtensions).some((regex) => path.match(regex))
        : path.match(assetExtensions[pattern]),
    );
  }

  const regex = typeof pattern === 'string' ? new RegExp(pattern) : undefined;

  return assets.filter((asset) => {
    const value = asset[field];

    if (regex) {
      return String(value || '').match(regex);
    }

    return value === pattern;
  });
};

/**
 * Group the given assets.
 * @param {Asset[]} assets Asset list.
 * @param {GroupingConditions} [conditions] Grouping conditions.
 * @returns {{ [key: string]: Asset[] }} Grouped assets, where key is a group label and value is an
 * asset list.
 */
const groupAssets = (assets, { field, pattern } = {}) => {
  if (!field) {
    return assets.length ? { '*': assets } : {};
  }

  const regex = typeof pattern === 'string' ? new RegExp(pattern) : undefined;
  const groups = {};
  const otherKey = get(_)('other');

  assets.forEach((asset) => {
    const value = asset[field];
    /**
     * @type {string}
     */
    let key = undefined;

    if (regex) {
      [key = otherKey] = String(value || '').match(regex) || [];
    } else {
      key = value;
    }

    if (!(key in groups)) {
      groups[key] = [];
    }

    groups[key].push(asset);
  });

  // Sort groups by key
  return Object.fromEntries(
    Object.entries(groups).sort(([aKey], [bKey]) => aKey.localeCompare(bKey)),
  );
};

/**
 * Default view settings for the selected asset collection.
 * @type {AssetView}
 */
const defaultView = {
  type: 'grid',
  sort: {
    key: 'name',
    order: 'ascending',
  },
};

/**
 * View settings for all the asset collection.
 * @type {import('svelte/store').Writable<{ [key: string]: AssetView }>}
 */
const assetsViewSettings = writable({}, (set) => {
  (async () => {
    try {
      set((await LocalStorage.get(storageKey)) || {});
    } catch {
      //
    }
  })();
});

/**
 * View settings for the selected asset collection.
 * @type {import('svelte/store').Writable<AssetView>}
 */
export const currentView = writable({});

/**
 * List of sort fields for the selected asset collection.
 * @type {import('svelte/store').Readable<string[]>}
 */
export const sortFields = derived([user], ([_user], set) => {
  const _sortFields = ['name'];

  if (_user?.backendName !== 'local') {
    _sortFields.push('commit_author', 'commit_date');
  }

  set(_sortFields);
});

/**
 * List of all the assets for the selected asset collection.
 * @type {import('svelte/store').Readable<Asset[]>}
 */
export const listedAssets = derived(
  [allAssets, selectedAssetFolderPath],
  ([_allAssets, _selectedAssetFolderPath], set) => {
    if (_allAssets && _selectedAssetFolderPath) {
      set(_allAssets.filter(({ folder }) => _selectedAssetFolderPath === folder));
    } else {
      set(_allAssets ? [..._allAssets] : []);
    }
  },
);

/**
 * Sorted, filtered and grouped assets for the selected asset collection.
 * @type {import('svelte/store').Readable<{ [key: string]: Asset[] }>}
 */
export const assetGroups = derived(
  [listedAssets, currentView],
  ([_listedAssets, _currentView], set) => {
    /**
     * @type {object[] | object}
     */
    let assets = [..._listedAssets];

    assets = sortAssets(assets, _currentView?.sort);
    assets = filterAssets(assets, _currentView?.filter);
    assets = groupAssets(assets, _currentView?.group);

    set(assets);
  },
);

listedAssets.subscribe((assets) => {
  selectedAssets.set([]);

  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.info('listedAssets', assets);
  }
});

selectedAssetFolderPath.subscribe((path) => {
  const view = get(assetsViewSettings)[path || '*'] || JSON.parse(JSON.stringify(defaultView));

  if (!equal(view, currentView)) {
    currentView.set(view);
  }
});

currentView.subscribe((view) => {
  const path = get(selectedAssetFolderPath) || '*';
  const savedView = get(assetsViewSettings)[path] || {};

  if (!equal(view, savedView)) {
    assetsViewSettings.update((settings) => ({ ...settings, [path]: view }));
  }
});

assetsViewSettings.subscribe((settings) => {
  if (!settings || !Object.keys(settings).length) {
    return;
  }

  (async () => {
    try {
      if (!equal(settings, await LocalStorage.get(storageKey))) {
        await LocalStorage.set(storageKey, settings);
      }
    } catch {
      //
    }
  })();
});
