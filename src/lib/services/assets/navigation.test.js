// @vitest-environment happy-dom

import { _, locale as appLocale } from '@sveltia/i18n';
import { sleep } from '@sveltia/utils/misc';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { announcedPageStatus, goto, parseLocation } from '$lib/services/app/navigation';
import { allAssets, overlaidAsset } from '$lib/services/assets';
import {
  enabledCloudServices,
  getCloudService,
  getCloudServicePath,
  overlaidExternalAssetId,
  resetExternalAssets,
  selectedCloudService,
} from '$lib/services/assets/external';
import { linkedFilesService } from '$lib/services/assets/external/linked';
import { allAssetFolders, selectedAssetFolder } from '$lib/services/assets/folders';
import {
  ASSETS_ROUTE_REGEX,
  discardAssetsNavigation,
  getSelectedAssetFolderLabel,
  resolveAssetsRoute,
} from '$lib/services/assets/navigation';
import { resolveAssetFolderPath, selectedSubfolderPath } from '$lib/services/assets/subfolders';
import {
  getFolderLabelByCollection,
  listedAssets,
  showAssetOverlay,
} from '$lib/services/assets/view';
import { isSearchRoute } from '$lib/services/search/navigation';
import { env } from '$lib/services/user/env.svelte';

/**
 * Resolvers of the pending `sleep()` calls, in order.
 * @type {(() => void)[]}
 */
const pendingSleeps = [];

vi.mock('@sveltia/i18n', () => ({ _: vi.fn(), locale: { current: 'en' } }));
vi.mock('@sveltia/utils/misc', () => ({ sleep: vi.fn() }));

vi.mock('$lib/services/app/navigation', () => ({
  announcedPageStatus: { current: '' },
  goto: vi.fn(),
  parseLocation: vi.fn(),
}));

vi.mock('$lib/services/assets', () => ({
  allAssets: { current: [] },
  overlaidAsset: { current: undefined },
}));

vi.mock('$lib/services/assets/external', () => ({
  enabledCloudServices: { current: [] },
  EXTERNAL_LOCATION_PATH_PREFIX: '-/',
  getCloudService: vi.fn(),
  getCloudServicePath: vi.fn(),
  overlaidExternalAssetId: { current: undefined },
  resetExternalAssets: vi.fn(),
  selectedCloudService: { current: undefined },
}));

vi.mock('$lib/services/assets/external/linked', () => ({
  linkedFilesService: { serviceId: 'linked' },
}));

vi.mock('$lib/services/assets/folders', () => ({
  allAssetFolders: { current: [] },
  selectedAssetFolder: { current: undefined },
}));

vi.mock('$lib/services/assets/subfolders', () => ({
  resolveAssetFolderPath: vi.fn(),
  selectedSubfolderPath: { current: '' },
}));

vi.mock('$lib/services/assets/view', () => ({
  getFolderLabelByCollection: vi.fn(),
  listedAssets: { current: [] },
  showAssetOverlay: { current: false },
}));

vi.mock('$lib/services/search/navigation', () => ({ isSearchRoute: vi.fn() }));
vi.mock('$lib/services/user/env.svelte', () => ({ env: { isSmallScreen: false } }));

const allFolder = /** @type {any} */ ({ internalPath: undefined, label: 'All' });
const postsFolder = /** @type {any} */ ({ internalPath: 'static/posts', collectionName: 'posts' });
const uploadcare = /** @type {any} */ ({ serviceId: 'uploadcare', serviceLabel: 'Uploadcare' });
const initial = { isIndexPage: false, isSearchPage: false, notFound: false };

/**
 * Point the router at the given path.
 * @param {string} path Path.
 */
const visit = (path) => {
  vi.mocked(parseLocation).mockReturnValue({ path, params: {} });
};

/**
 * Let the pending `sleep()` calls finish, and wait for the code awaiting them to run.
 */
const finishSleeps = async () => {
  pendingSleeps.splice(0).forEach((resolve) => resolve());
  await Promise.resolve();
  await Promise.resolve();
};

beforeEach(async () => {
  vi.resetAllMocks();
  // Settle a delayed announcement left over from the previous test
  await finishSleeps();
  vi.mocked(_).mockImplementation((key, options) =>
    options ? `${key} ${JSON.stringify(options.values)}` : /** @type {string} */ (key),
  );
  vi.mocked(sleep).mockImplementation(
    () =>
      new Promise((resolve) => {
        pendingSleeps.push(() => resolve(undefined));
      }),
  );
  vi.mocked(getFolderLabelByCollection).mockImplementation((folder) => folder.label ?? 'Folder');
  vi.mocked(getCloudServicePath).mockImplementation(({ serviceId }) => `/assets/-/${serviceId}`);
  /** @type {any} */ (appLocale).current = 'en';
  announcedPageStatus.current = '';
  allAssets.current = [];
  overlaidAsset.current = undefined;
  /** @type {any} */ (enabledCloudServices).current = [];
  overlaidExternalAssetId.current = undefined;
  selectedCloudService.current = undefined;
  allAssetFolders.current = [];
  selectedAssetFolder.current = undefined;
  selectedSubfolderPath.current = '';
  /** @type {any} */ (listedAssets).current = [];
  showAssetOverlay.current = false;
  env.isSmallScreen = false;
  window.history.replaceState(null, '');
});

describe('ASSETS_ROUTE_REGEX', () => {
  test('matches the Asset Library routes', () => {
    expect('/assets'.match(ASSETS_ROUTE_REGEX)?.groups).toEqual({
      folderPath: undefined,
      fileName: undefined,
    });
    expect('/assets/static/uploads'.match(ASSETS_ROUTE_REGEX)?.groups).toEqual({
      folderPath: 'static/uploads',
      fileName: undefined,
    });
    expect('/assets/static/uploads/a.png'.match(ASSETS_ROUTE_REGEX)?.groups).toEqual({
      folderPath: 'static/uploads',
      fileName: 'a.png',
    });
    expect('/collections/posts'.match(ASSETS_ROUTE_REGEX)).toBeNull();
  });
});

describe('getSelectedAssetFolderLabel()', () => {
  test('returns the label of the selected folder', () => {
    selectedAssetFolder.current = postsFolder;
    vi.mocked(getFolderLabelByCollection).mockReturnValue('Posts');

    expect(getSelectedAssetFolderLabel()).toBe('Posts');
    expect(getFolderLabelByCollection).toHaveBeenCalledWith(postsFolder);
  });

  test('returns an empty string without a folder or a locale', () => {
    expect(getSelectedAssetFolderLabel()).toBe('');

    selectedAssetFolder.current = postsFolder;
    /** @type {any} */ (appLocale).current = undefined;

    expect(getSelectedAssetFolderLabel()).toBe('');
    expect(getFolderLabelByCollection).not.toHaveBeenCalled();
  });
});

describe('resolveAssetsRoute()', () => {
  test('hides the overlay on a different page', () => {
    visit('/collections/posts');
    showAssetOverlay.current = true;
    vi.mocked(isSearchRoute).mockReturnValue(false);

    expect(resolveAssetsRoute()).toEqual(initial);
    expect(showAssetOverlay.current).toBe(false);
  });

  test('recognizes the search page', () => {
    visit('/search/a');
    vi.mocked(isSearchRoute).mockReturnValue(true);

    expect(resolveAssetsRoute()).toEqual({ ...initial, isSearchPage: true });
    expect(isSearchRoute).toHaveBeenCalledWith('/search/a');
  });

  describe('external locations', () => {
    test('selects a cloud storage service', () => {
      visit('/assets/-/uploadcare');
      selectedAssetFolder.current = postsFolder;
      showAssetOverlay.current = true;
      overlaidExternalAssetId.current = 'old';
      vi.mocked(getCloudService).mockReturnValue(uploadcare);

      expect(resolveAssetsRoute()).toEqual(initial);
      expect(getCloudService).toHaveBeenCalledWith('uploadcare');
      expect(resetExternalAssets).toHaveBeenCalledOnce();
      expect(selectedCloudService.current).toBe(uploadcare);
      expect(selectedAssetFolder.current).toBeUndefined();
      expect(overlaidExternalAssetId.current).toBeUndefined();
      expect(showAssetOverlay.current).toBe(false);
      expect(announcedPageStatus.current).toBe(
        'viewing_x_external_location {"service":"Uploadcare"}',
      );
    });

    test('keeps the assets of the service already selected', () => {
      visit('/assets/-/uploadcare');
      selectedCloudService.current = uploadcare;
      vi.mocked(getCloudService).mockReturnValue(uploadcare);

      resolveAssetsRoute();

      expect(resetExternalAssets).not.toHaveBeenCalled();
      expect(selectedCloudService.current).toBe(uploadcare);
    });

    test('shows the details of an asset whose ID has slashes', () => {
      visit('/assets/-/linked/https://cdn.example.net/x.png');
      vi.mocked(getCloudService).mockReturnValue(/** @type {any} */ ({ serviceId: 'linked' }));

      expect(resolveAssetsRoute()).toEqual(initial);
      expect(getCloudService).toHaveBeenCalledWith('linked');
      expect(overlaidExternalAssetId.current).toBe('https://cdn.example.net/x.png');
      expect(showAssetOverlay.current).toBe(true);
      expect(announcedPageStatus.current).toBe('viewing_x_asset_details {"name":"x.png"}');
    });

    test('shows the details of an asset whose ID has no file extension', () => {
      visit('/assets/-/uploadcare/abc-123');
      vi.mocked(getCloudService).mockReturnValue(uploadcare);

      resolveAssetsRoute();

      expect(overlaidExternalAssetId.current).toBe('abc-123');
      expect(announcedPageStatus.current).toBe('viewing_x_asset_details {"name":"abc-123"}');
    });

    test('reports an unknown service', () => {
      visit('/assets/-/unknown');
      selectedCloudService.current = uploadcare;
      showAssetOverlay.current = true;

      expect(resolveAssetsRoute()).toEqual({ ...initial, notFound: true });
      expect(selectedCloudService.current).toBeUndefined();
      expect(showAssetOverlay.current).toBe(false);
      expect(announcedPageStatus.current).toBe('asset_folder_not_found');
    });
  });

  describe('index', () => {
    test('shows the folder list alone on a small screen', () => {
      visit('/assets');
      env.isSmallScreen = true;
      selectedAssetFolder.current = postsFolder;
      selectedCloudService.current = uploadcare;
      showAssetOverlay.current = true;

      expect(resolveAssetsRoute()).toEqual({ ...initial, isIndexPage: true });
      expect(selectedCloudService.current).toBeUndefined();
      expect(selectedAssetFolder.current).toBeUndefined();
      expect(showAssetOverlay.current).toBe(false);
      expect(announcedPageStatus.current).toBe('viewing_asset_folder_list');
      expect(goto).not.toHaveBeenCalled();
    });

    test('selects All Assets and redirects to it on a large screen', () => {
      visit('/assets');
      allAssetFolders.current = [allFolder];
      selectedSubfolderPath.current = 'foo';
      vi.mocked(resolveAssetFolderPath).mockReturnValue({ folder: allFolder, subfolderPath: '' });

      expect(resolveAssetsRoute()).toEqual(initial);
      expect(resolveAssetFolderPath).toHaveBeenCalledWith('-/all');
      expect(selectedAssetFolder.current).toBe(allFolder);
      expect(selectedSubfolderPath.current).toBe('');
      expect(goto).toHaveBeenCalledWith('/assets/-/all');
    });

    test('redirects to the first external location without a folder', () => {
      visit('/assets');
      /** @type {any} */ (enabledCloudServices).current = [uploadcare];

      resolveAssetsRoute();

      expect(getCloudServicePath).toHaveBeenCalledWith(uploadcare);
      expect(goto).toHaveBeenCalledWith('/assets/-/uploadcare');
    });

    test('redirects to the linked files when nothing else is configured', () => {
      visit('/assets');

      resolveAssetsRoute();

      expect(getCloudServicePath).toHaveBeenCalledWith(linkedFilesService);
      expect(goto).toHaveBeenCalledWith('/assets/-/linked');
    });
  });

  describe('folders', () => {
    test('selects a folder and announces it after a moment', async () => {
      visit('/assets/static/posts/sub');
      selectedCloudService.current = uploadcare;
      showAssetOverlay.current = true;
      /** @type {any} */ (listedAssets).current = [{}, {}];
      vi.mocked(resolveAssetFolderPath).mockReturnValue({
        folder: postsFolder,
        subfolderPath: 'sub',
      });

      expect(resolveAssetsRoute()).toEqual(initial);
      expect(resolveAssetFolderPath).toHaveBeenCalledWith('static/posts/sub', undefined);
      expect(selectedCloudService.current).toBeUndefined();
      expect(selectedAssetFolder.current).toBe(postsFolder);
      expect(selectedSubfolderPath.current).toBe('sub');
      expect(sleep).toHaveBeenCalledWith(100);
      expect(announcedPageStatus.current).toBe('');
      expect(showAssetOverlay.current).toBe(true);

      await finishSleeps();

      expect(showAssetOverlay.current).toBe(false);
      expect(announcedPageStatus.current).toBe(
        'viewing_x_asset_folder {"folder":"Folder","count":2}',
      );
    });

    test('prefers the folder passed as history state', () => {
      visit('/assets/static/posts');
      window.history.replaceState({ folder: postsFolder }, '');
      vi.mocked(resolveAssetFolderPath).mockReturnValue({ folder: postsFolder, subfolderPath: '' });

      resolveAssetsRoute();

      expect(resolveAssetFolderPath).toHaveBeenCalledWith('static/posts', postsFolder);
      expect(selectedSubfolderPath.current).toBe('');
    });

    test('keeps the selected folder object when it’s equal', () => {
      const selected = { ...postsFolder };

      visit('/assets/static/posts');
      selectedAssetFolder.current = selected;
      vi.mocked(resolveAssetFolderPath).mockReturnValue({ folder: postsFolder, subfolderPath: '' });

      resolveAssetsRoute();

      expect(selectedAssetFolder.current).toBe(selected);
    });

    test('ignores an announcement once a newer navigation has started', async () => {
      visit('/assets/static/posts');
      vi.mocked(resolveAssetFolderPath).mockReturnValue({ folder: postsFolder, subfolderPath: '' });
      resolveAssetsRoute();

      visit('/assets/-/uploadcare');
      vi.mocked(getCloudService).mockReturnValue(uploadcare);
      resolveAssetsRoute();
      await finishSleeps();

      expect(announcedPageStatus.current).toBe(
        'viewing_x_external_location {"service":"Uploadcare"}',
      );
    });

    test('ignores an announcement once the navigation has been discarded', async () => {
      visit('/assets/static/posts');
      vi.mocked(resolveAssetFolderPath).mockReturnValue({ folder: postsFolder, subfolderPath: '' });
      resolveAssetsRoute();
      showAssetOverlay.current = true;

      discardAssetsNavigation();
      await finishSleeps();

      expect(announcedPageStatus.current).toBe('');
      expect(showAssetOverlay.current).toBe(true);
    });

    test('reports a missing folder', () => {
      visit('/assets/missing');
      selectedAssetFolder.current = postsFolder;
      selectedSubfolderPath.current = 'sub';
      showAssetOverlay.current = true;
      vi.mocked(resolveAssetFolderPath).mockReturnValue(undefined);

      expect(resolveAssetsRoute()).toEqual({ ...initial, notFound: true });
      expect(selectedAssetFolder.current).toBeUndefined();
      expect(selectedSubfolderPath.current).toBe('');
      expect(showAssetOverlay.current).toBe(false);
      expect(announcedPageStatus.current).toBe('asset_folder_not_found');
      expect(sleep).not.toHaveBeenCalled();
    });
  });

  describe('asset details', () => {
    const asset = /** @type {any} */ ({ name: 'a.png', path: 'static/posts/a.png' });

    test('shows the details of an asset in a folder', () => {
      visit('/assets/static/posts/a.png');
      allAssets.current = [asset];
      vi.mocked(resolveAssetFolderPath).mockReturnValue({ folder: postsFolder, subfolderPath: '' });

      expect(resolveAssetsRoute()).toEqual(initial);
      expect(selectedAssetFolder.current).toBe(postsFolder);
      expect(overlaidAsset.current).toBe(asset);
      expect(showAssetOverlay.current).toBe(true);
      expect(announcedPageStatus.current).toBe('viewing_x_asset_details {"name":"a.png"}');
      expect(sleep).not.toHaveBeenCalled();
    });

    test('looks up an asset outside a configured folder by its path', () => {
      visit('/assets/static/posts/a.png');
      allAssets.current = [asset];
      selectedAssetFolder.current = allFolder;
      selectedSubfolderPath.current = 'sub';
      vi.mocked(resolveAssetFolderPath).mockReturnValue(undefined);

      expect(resolveAssetsRoute()).toEqual(initial);
      expect(selectedAssetFolder.current).toBeUndefined();
      expect(selectedSubfolderPath.current).toBe('');
      expect(overlaidAsset.current).toBe(asset);
    });

    test('reports a missing file', () => {
      visit('/assets/static/posts/b.png');
      allAssets.current = [asset];
      vi.mocked(resolveAssetFolderPath).mockReturnValue({ folder: postsFolder, subfolderPath: '' });

      resolveAssetsRoute();

      expect(overlaidAsset.current).toBeUndefined();
      expect(showAssetOverlay.current).toBe(true);
      expect(announcedPageStatus.current).toBe('file_not_found');
    });
  });
});
