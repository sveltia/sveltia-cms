import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  externalAssets,
  externalAssetSearchTerms,
  focusedExternalAsset,
  selectedExternalAssets,
} from '$lib/services/assets/external';
import { currentView } from '$lib/services/assets/view/settings';

import {
  EXTERNAL_ASSET_SORT_KEYS,
  externalAssetSortKeys,
  filterExternalAssets,
  getSortValue,
  listedExternalAssets,
  pruneHiddenAssets,
  searchExternalAssets,
  sortExternalAssets,
} from './view';

vi.mock('@sveltia/i18n', () => ({
  _: vi.fn((/** @type {string} */ key) => `[${key}]`),
}));

vi.mock('$lib/services/assets/external', () => ({
  externalAssets: { current: undefined },
  externalAssetSearchTerms: { current: '' },
  focusedExternalAsset: { current: undefined },
  selectedExternalAssets: { current: [] },
}));

vi.mock('$lib/services/assets/view/settings', () => ({
  currentView: { current: { type: 'grid' } },
}));

/** @type {import('$lib/types/private').ExternalAsset[]} */
const assets = [
  {
    id: 'images/hero-2.png',
    description: 'images/hero-2.png',
    previewURL: '',
    downloadURL: '',
    fileName: 'hero-2.png',
    lastModified: new Date('2024-03-01'),
    size: 300,
    kind: 'image',
  },
  {
    id: 'docs/Guide.pdf',
    description: 'docs/Guide.pdf',
    previewURL: '',
    downloadURL: '',
    fileName: 'Guide.pdf',
    lastModified: new Date('2024-01-01'),
    size: 100,
    kind: 'document',
  },
  {
    id: 'images/hero.png',
    description: 'images/hero.png',
    previewURL: '',
    downloadURL: '',
    fileName: 'hero.png',
    kind: 'image',
  },
];

const [hero2, guide, hero] = assets;

describe('assets/external/view', () => {
  beforeEach(() => {
    externalAssets.current = undefined;
    externalAssetSearchTerms.current = '';
    focusedExternalAsset.current = undefined;
    selectedExternalAssets.current = [];
    currentView.current = { type: 'grid' };
  });

  describe('externalAssetSortKeys', () => {
    it('should provide localized labels', () => {
      expect(EXTERNAL_ASSET_SORT_KEYS).toEqual(['name', 'last_modified', 'size']);
      expect(externalAssetSortKeys.current).toEqual([
        { key: 'name', label: '[sort_keys.name]', type: undefined },
        { key: 'last_modified', label: '[sort_keys.last_modified]', type: 'date' },
        { key: 'size', label: '[sort_keys.size]', type: 'number' },
      ]);
    });
  });

  describe('getSortValue', () => {
    it('should return the name without the extension', () => {
      expect(getSortValue(hero2, 'name')).toBe('hero-2');
    });

    it('should return the timestamp, or 0 when unknown', () => {
      expect(getSortValue(hero2, 'last_modified')).toBe(new Date('2024-03-01').getTime());
      expect(getSortValue(hero, 'last_modified')).toBe(0);
    });

    it('should return the size, or 0 when unknown', () => {
      expect(getSortValue(hero2, 'size')).toBe(300);
      expect(getSortValue(hero, 'size')).toBe(0);
    });
  });

  describe('sortExternalAssets', () => {
    it('should return the list as is without valid conditions', () => {
      expect(sortExternalAssets(assets)).toBe(assets);
      expect(sortExternalAssets(assets, { key: 'name' })).toBe(assets);
      expect(sortExternalAssets(assets, { key: 'commit_date', order: 'ascending' })).toBe(assets);
    });

    it('should sort by name in a natural order without mutating the list', () => {
      const sorted = sortExternalAssets(assets, { key: 'name', order: 'ascending' });

      expect(sorted).toEqual([guide, hero, hero2]);
      expect(assets[0]).toBe(hero2);
      expect(sortExternalAssets(assets, { key: 'name', order: 'descending' })).toEqual([
        hero2,
        hero,
        guide,
      ]);
    });

    it('should sort by date and size numerically', () => {
      expect(sortExternalAssets(assets, { key: 'last_modified', order: 'ascending' })).toEqual([
        hero,
        guide,
        hero2,
      ]);
      expect(sortExternalAssets(assets, { key: 'size', order: 'descending' })).toEqual([
        hero2,
        guide,
        hero,
      ]);
    });
  });

  describe('filterExternalAssets', () => {
    it('should return the list as is without a file type filter', () => {
      expect(filterExternalAssets(assets)).toBe(assets);
      expect(filterExternalAssets(assets, { field: 'name', pattern: 'hero' })).toBe(assets);
    });

    it('should filter by kind', () => {
      expect(filterExternalAssets(assets, { field: 'fileType', pattern: 'image' })).toEqual([
        hero2,
        hero,
      ]);
      expect(filterExternalAssets(assets, { field: 'fileType', pattern: 'video' })).toEqual([]);
    });
  });

  describe('searchExternalAssets', () => {
    it('should return the list as is without terms', () => {
      expect(searchExternalAssets(assets, '')).toBe(assets);
      expect(searchExternalAssets(assets, '  ')).toBe(assets);
    });

    it('should match the file name and path case-insensitively', () => {
      expect(searchExternalAssets(assets, 'GUIDE')).toEqual([guide]);
      expect(searchExternalAssets(assets, 'images/')).toEqual([hero2, hero]);
      expect(searchExternalAssets(assets, 'nothing')).toEqual([]);
    });
  });

  describe('listedExternalAssets', () => {
    it('should be empty while the assets are not loaded', () => {
      expect(listedExternalAssets.current).toEqual([]);
    });

    it('should apply the view settings and search terms', () => {
      externalAssets.current = assets;
      currentView.current = {
        type: 'grid',
        sort: { key: 'name', order: 'descending' },
        filter: { field: 'fileType', pattern: 'image' },
      };
      externalAssetSearchTerms.current = 'hero';

      expect(listedExternalAssets.current).toEqual([hero2, hero]);
    });
  });

  describe('pruneHiddenAssets', () => {
    it('should drop the selected and focused assets hidden by the search terms', () => {
      externalAssets.current = assets;
      selectedExternalAssets.current = [hero, guide];
      focusedExternalAsset.current = hero;
      externalAssetSearchTerms.current = 'guide';

      pruneHiddenAssets();

      expect(selectedExternalAssets.current).toEqual([guide]);
      expect(focusedExternalAsset.current).toBeUndefined();
    });

    it('should keep the selection and focus when everything is still listed', () => {
      externalAssets.current = assets;

      const selected = [hero, guide];

      selectedExternalAssets.current = selected;
      focusedExternalAsset.current = guide;

      pruneHiddenAssets();

      expect(selectedExternalAssets.current).toBe(selected);
      expect(focusedExternalAsset.current).toBe(guide);
    });
  });
});
