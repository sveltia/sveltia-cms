import { IndexedDB, LocalStorage } from '@sveltia/utils/storage';
import equal from 'fast-deep-equal';
import { tick } from 'svelte';
import { _, locale as appLocale } from 'svelte-i18n';
import { derived, get, writable } from 'svelte/store';
import { prefs } from '$lib/services/prefs';
import { siteConfig } from '$lib/services/config';
import { backend } from '$lib/services/backends';
import {
  allAssetFolders,
  allAssets,
  assetExtensions,
  selectedAssetFolder,
  selectedAssets,
  uploadingAssets,
} from '$lib/services/assets';

/** @type {IndexedDB | null | undefined} */
let settingsDB = undefined;
const storageKey = 'assets-view';

/**
 * Whether to show the Upload Assets dialog.
 */
export const showUploadAssetsDialog = writable(false);

/**
 * @type {import('svelte/store').Readable<boolean>}
 */
export const showUploadAssetsConfirmDialog = derived(
  [uploadingAssets],
  ([_uploadingAssets], set) => {
    set(!!_uploadingAssets.files?.length);
  },
);

/**
 * Get the label for the given collection. It can be a category name if the folder is a
 * collection-specific asset folder.
 * @param {string | undefined} collectionName - Collection name.
 * @returns {string} Human-readable label.
 * @see https://decapcms.org/docs/collection-folder/#media-and-public-folder
 */
export const getFolderLabelByCollection = (collectionName) => {
  if (collectionName === '*') {
    return get(_)('all_assets');
  }

  if (!collectionName) {
    return get(_)('uncategorized');
  }

  return get(siteConfig)?.collections.find(({ name }) => name === collectionName)?.label ?? '';
};

/**
 * Get the label for the given folder path. It can be a category name if the folder is a
 * collection-specific asset folder.
 * @param {string | undefined} folderPath - Media folder path.
 * @returns {string} Human-readable label.
 * @see https://decapcms.org/docs/collection-folder/#media-and-public-folder
 */
export const getFolderLabelByPath = (folderPath) => {
  const { media_folder: defaultMediaFolder } = /** @type {SiteConfig} */ (get(siteConfig));

  if (!folderPath) {
    return getFolderLabelByCollection('*');
  }

  if (folderPath === defaultMediaFolder) {
    return getFolderLabelByCollection(undefined);
  }

  const folder = get(allAssetFolders).find(({ internalPath }) => internalPath === folderPath);

  if (folder) {
    return getFolderLabelByCollection(folder.collectionName);
  }

  return '';
};

/**
 * Sort the given assets.
 * @param {Asset[]} assets - Asset list.
 * @param {SortingConditions} [conditions] - Sorting conditions.
 * @returns {Asset[]} Sorted asset list.
 */
const sortAssets = (assets, { key, order } = {}) => {
  if (!key || !order) {
    return assets;
  }

  const _assets = [...assets];

  const type =
    { commit_author: String, commit_date: Date }[key] ||
    /** @type {{ [key: string]: any }} */ (_assets[0])?.[key]?.constructor ||
    String;

  /**
   * Get an asset’s property value.
   * @param {Asset} asset - Asset.
   * @returns {any} Value.
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

    return /** @type {{ [key: string]: any }} */ (asset)[key] ?? '';
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
 * @param {Asset[]} assets - Asset list.
 * @param {FilteringConditions} [conditions] - Filtering conditions.
 * @returns {Asset[]} Filtered asset list.
 */
const filterAssets = (assets, { field, pattern } = { field: '', pattern: '' }) => {
  if (!field) {
    return assets;
  }

  if (field === 'fileType') {
    return assets.filter(({ path }) =>
      pattern === 'other'
        ? !Object.values(assetExtensions).some((regex) => path.match(regex))
        : path.match(assetExtensions[/** @type {string} */ (pattern)]),
    );
  }

  const regex = typeof pattern === 'string' ? new RegExp(pattern) : undefined;

  return assets.filter((asset) => {
    const value = /** @type {{ [key: string]: any }} */ (asset)[field];

    if (regex) {
      return String(value ?? '').match(regex);
    }

    return value === pattern;
  });
};

/**
 * Group the given assets.
 * @param {Asset[]} assets - Asset list.
 * @param {GroupingConditions} [conditions] - Grouping conditions.
 * @returns {{ [key: string]: Asset[] }} Grouped assets, where key is a group label and value is an
 * asset list.
 */
const groupAssets = (assets, { field, pattern } = { field: '', pattern: undefined }) => {
  if (!field) {
    return assets.length ? { '*': assets } : {};
  }

  const regex = typeof pattern === 'string' ? new RegExp(pattern) : undefined;
  /** @type {{ [key: string]: Asset[] }} */
  const groups = {};
  const otherKey = get(_)('other');

  assets.forEach((asset) => {
    const value = /** @type {{ [key: string]: any }} */ (asset)[field];
    /**
     * @type {string}
     */
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
  showInfo: true,
  sort: {
    key: 'name',
    order: 'ascending',
  },
};

/**
 * View settings for the selected asset collection.
 * @type {import('svelte/store').Writable<AssetListView>}
 */
export const currentView = writable({ type: 'grid', showInfo: true });

/**
 * View settings for all the asset collection.
 * @type {import('svelte/store').Writable<{ [key: string]: AssetListView }>}
 */
const assetListSettings = writable({}, (set) => {
  (async () => {
    try {
      /** @type {RepositoryInfo} */
      const { service, owner, repo } = await new Promise((resolve) => {
        const unsubscribe = backend.subscribe(async (_backend) => {
          if (_backend) {
            resolve(/** @type {RepositoryInfo} */ (_backend.repository ?? {}));
            await tick();
            unsubscribe();
          }
        });
      });

      settingsDB = repo ? new IndexedDB(`${service}:${owner}/${repo}`, 'ui-settings') : null;

      const legacyCache = await LocalStorage.get(`sveltia-cms.${storageKey}`);
      const settings = legacyCache ?? (await settingsDB?.get(storageKey)) ?? {};

      set(settings);

      selectedAssetFolder.subscribe((folder) => {
        const view =
          get(assetListSettings)[folder?.internalPath || '*'] ?? structuredClone(defaultView);

        if (!equal(view, get(currentView))) {
          currentView.set(view);
        }
      });

      // Delete legacy cache on LocalStorage as we have migrated to IndexedDB
      // @todo Remove this migration before GA
      if (legacyCache) {
        await settingsDB?.set(storageKey, settings);
        await LocalStorage.delete(`sveltia-cms.${storageKey}`);
      }
    } catch {
      //
    }
  })();
});

/**
 * List of sort fields for the selected asset collection.
 * @type {import('svelte/store').Readable<{ key: string, label: string }[]>}
 */
export const sortFields = derived([allAssets, appLocale], ([_allAssets], set) => {
  const { commitAuthor, commitDate } = _allAssets?.[0] ?? {};
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
  [allAssets, selectedAssetFolder],
  ([_allAssets, _selectedAssetFolder], set) => {
    if (_allAssets && _selectedAssetFolder) {
      set(_allAssets.filter(({ folder }) => _selectedAssetFolder.internalPath === folder));
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

currentView.subscribe((view) => {
  const path = get(selectedAssetFolder)?.internalPath || '*';
  const savedView = get(assetListSettings)[path] ?? {};

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
      if (!equal(settings, await settingsDB?.get(storageKey))) {
        await settingsDB?.set(storageKey, settings);
      }
    } catch {
      //
    }
  })();
});
