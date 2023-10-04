import equal from 'fast-deep-equal';
import { _, locale } from 'svelte-i18n';
import { derived, get, writable } from 'svelte/store';
import {
  allAssetPaths,
  allAssets,
  assetExtensions,
  getAssetURL,
  selectedAssetFolderPath,
  selectedAssets,
} from '$lib/services/assets';
import { siteConfig } from '$lib/services/config';
import { prefs } from '$lib/services/prefs';
import LocalStorage from '$lib/services/utils/local-storage';

const storageKey = 'sveltia-cms.assets-view';

/**
 * Lazily or eagerly generate the asset’s Blob URL on demand to be used for a `<Image>` or `<Video>`
 * component. For a Git backend, this will be done by fetching the Blob via the API.
 * @param {Asset} asset Asset.
 * @param {('lazy' | 'eager')} loading How to load the media.
 * @param {(HTMLImageElement | HTMLVideoElement)} element Element to observe the visibility using
 * the Intersection Observer API.
 * @returns {Promise<string>} Blob URL.
 */
export const getAssetPreviewURL = (asset, loading, element) => {
  if (loading === 'eager') {
    return getAssetURL(asset);
  }

  return new Promise((resolve) => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        observer.disconnect();
        resolve(getAssetURL(asset));
      }
    });

    observer.observe(element);
  });
};

/**
 * Get the label for the given collection. It can be a category name if the folder is a
 * collection-specific asset folder.
 * @param {string} collectionName Collection name.
 * @returns {string} Human-readable label.
 * @see https://decapcms.org/docs/beta-features/#folder-collections-media-and-public-folder
 */
export const getFolderLabelByCollection = (collectionName) => {
  if (collectionName === '*') {
    return get(_)('all_files');
  }

  if (!collectionName) {
    return get(_)('uncategorized');
  }

  return get(siteConfig).collections.find(({ name }) => name === collectionName)?.label || '';
};

/**
 * Get the label for the given folder path. It can be a category name if the folder is a
 * collection-specific asset folder.
 * @param {string} folderPath Media folder path.
 * @returns {string} Human-readable label.
 * @see https://decapcms.org/docs/beta-features/#folder-collections-media-and-public-folder
 */
export const getFolderLabelByPath = (folderPath) => {
  const { media_folder: defaultMediaFolder } = get(siteConfig);

  if (!folderPath) {
    return getFolderLabelByCollection('*');
  }

  if (folderPath === defaultMediaFolder) {
    return getFolderLabelByCollection(undefined);
  }

  const folder = get(allAssetPaths).find(({ internalPath }) => internalPath === folderPath);

  if (folder) {
    return getFolderLabelByCollection(folder.collectionName);
  }

  return '';
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

    return asset[key] || '';
  };

  _assets.sort((a, b) => {
    const aValue = getValue(a);
    const bValue = getValue(b);

    if (type === String) {
      return aValue.localeCompare(bValue);
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
const filterAssets = (assets, { field, pattern } = { field: undefined, pattern: undefined }) => {
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
const groupAssets = (assets, { field, pattern } = { field: undefined, pattern: undefined }) => {
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
 * @type {AssetListView}
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
 * @type {import('svelte/store').Writable<{ [key: string]: AssetListView }>}
 */
const assetListSettings = writable({}, (set) => {
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
 * @type {import('svelte/store').Writable<AssetListView>}
 */
export const currentView = writable({});

/**
 * List of sort fields for the selected asset collection.
 * @type {import('svelte/store').Readable<{ key: string, label: string }[]>}
 */
export const sortFields = derived([allAssets, locale], ([_allAssets], set) => {
  const { commitAuthor, commitDate } = _allAssets?.[0] || {};
  const _sortFields = ['name'];

  if (commitAuthor) {
    _sortFields.push('commit_author');
  }

  if (commitDate) {
    _sortFields.push('commit_date');
  }

  set(_sortFields.map((key) => ({ key, label: get(_)(`sort_keys.${key}`) })));
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
     * @type {Asset[]}
     */
    let assets = [..._listedAssets];

    assets = sortAssets(assets, _currentView?.sort);
    assets = filterAssets(assets, _currentView?.filter);

    set(groupAssets(assets, _currentView?.group));
  },
);

listedAssets.subscribe((assets) => {
  selectedAssets.set([]);

  if (get(prefs).devModeEnabled) {
    // eslint-disable-next-line no-console
    console.info('listedAssets', assets);
  }
});

selectedAssetFolderPath.subscribe((path) => {
  const view = get(assetListSettings)[path || '*'] || JSON.parse(JSON.stringify(defaultView));

  if (!equal(view, currentView)) {
    currentView.set(view);
  }
});

currentView.subscribe((view) => {
  const path = get(selectedAssetFolderPath) || '*';
  const savedView = get(assetListSettings)[path] || {};

  if (!equal(view, savedView)) {
    assetListSettings.update((settings) => ({ ...settings, [path]: view }));
  }
});

assetListSettings.subscribe((settings) => {
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
