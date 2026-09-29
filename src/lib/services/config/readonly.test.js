// @ts-nocheck
import { afterEach, describe, expect, test } from 'vitest';

import { getReadonlyMessageKey, isDraftReadonly, isReadonly } from './readonly';
import { cmsConfig } from './state';

describe('Test isReadonly()', () => {
  afterEach(() => {
    cmsConfig.current = undefined;
  });

  test('returns false when nothing is read-only', () => {
    cmsConfig.current = {};

    expect(isReadonly()).toBe(false);
    expect(isReadonly({ collection: { name: 'posts' }, collectionFile: { name: 'about' } })).toBe(
      false,
    );
  });

  test('returns false without a configuration', () => {
    expect(isReadonly()).toBe(false);
  });

  test('returns true when the whole CMS is read-only', () => {
    cmsConfig.current = { readonly: true };

    expect(isReadonly()).toBe(true);
    // A collection or file can’t opt out
    expect(
      isReadonly({ collection: { readonly: false }, collectionFile: { readonly: false } }),
    ).toBe(true);
  });

  test('returns true when the collection is read-only', () => {
    cmsConfig.current = {};

    expect(isReadonly({ collection: { readonly: true } })).toBe(true);
    expect(
      isReadonly({ collection: { readonly: true }, collectionFile: { readonly: false } }),
    ).toBe(true);
  });

  test('returns true when the collection file is read-only', () => {
    cmsConfig.current = {};

    expect(isReadonly({ collection: {}, collectionFile: { readonly: true } })).toBe(true);
  });

  test('uses the given configuration over the current one', () => {
    cmsConfig.current = { readonly: true };

    expect(isReadonly({ config: {} })).toBe(false);
    expect(isReadonly({ config: { readonly: true } })).toBe(true);
  });
});

describe('Test isDraftReadonly()', () => {
  afterEach(() => {
    cmsConfig.current = undefined;
  });

  test('returns false without a draft', () => {
    cmsConfig.current = { readonly: true };

    expect(isDraftReadonly(undefined)).toBe(false);
    expect(isDraftReadonly(null)).toBe(false);
  });

  test('checks the draft’s collection and collection file', () => {
    cmsConfig.current = {};

    expect(isDraftReadonly({ collection: {} })).toBe(false);
    expect(isDraftReadonly({ collection: { readonly: true } })).toBe(true);
    expect(isDraftReadonly({ collection: {}, collectionFile: { readonly: true } })).toBe(true);

    cmsConfig.current = { readonly: true };

    expect(isDraftReadonly({ collection: {} })).toBe(true);
  });
});

describe('Test getReadonlyMessageKey()', () => {
  afterEach(() => {
    cmsConfig.current = undefined;
  });

  test('returns the key for the given scope', () => {
    cmsConfig.current = {};

    expect(getReadonlyMessageKey('collection')).toBe('readonly_collection');
    expect(getReadonlyMessageKey('entry')).toBe('readonly_entry');
    expect(getReadonlyMessageKey('asset_folder')).toBe('readonly_asset_folder');
  });

  test('returns the CMS-wide key when the whole CMS is read-only', () => {
    cmsConfig.current = { readonly: true };

    expect(getReadonlyMessageKey('collection')).toBe('readonly_cms');
    expect(getReadonlyMessageKey('entry')).toBe('readonly_cms');
  });
});
