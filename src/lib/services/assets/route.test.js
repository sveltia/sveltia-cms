import { describe, expect, test } from 'vitest';

import {
  ALL_ASSETS_FOLDER_PATH,
  ASSETS_ROUTE_REGEX,
  getAssetLibraryPath,
  parseAssetsPath,
} from '$lib/services/assets/route';

describe('getAssetLibraryPath()', () => {
  test('builds the path of a folder or an asset, encoding each segment', () => {
    expect(getAssetLibraryPath('static/images')).toBe('/assets/static/images');
    expect(getAssetLibraryPath('static/images/50% off #1.png')).toBe(
      '/assets/static/images/50%25%20off%20%231.png',
    );
  });

  test('defaults to the All Assets folder', () => {
    expect(ALL_ASSETS_FOLDER_PATH).toBe('-/all');
    expect(getAssetLibraryPath()).toBe('/assets/-/all');
    expect(getAssetLibraryPath(undefined)).toBe('/assets/-/all');
  });
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

describe('parseAssetsPath()', () => {
  test('gives the folder path and the file name, or nothing for another page', () => {
    expect(parseAssetsPath('/assets')).toEqual({ folderPath: undefined, fileName: undefined });
    expect(parseAssetsPath('/assets/static/uploads/a.png')).toEqual({
      folderPath: 'static/uploads',
      fileName: 'a.png',
    });
    expect(parseAssetsPath('/collections/posts')).toBeUndefined();
  });
});
