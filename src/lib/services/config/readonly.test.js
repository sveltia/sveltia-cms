// @ts-nocheck
import { afterEach, describe, expect, test, vi } from 'vitest';

import { lockedBranch } from '$lib/services/backends/branch-access';

import {
  getReadonlyMessage,
  isConfigReadonly,
  isDraftReadonly,
  isLockedByBranch,
  isReadonly,
} from './readonly';
import { cmsConfig } from './state';

vi.mock('@sveltia/i18n', () => ({
  _: vi.fn((key, options) => (options ? `${key}:${options.values.branch}` : key)),
}));

afterEach(() => {
  lockedBranch.current = undefined;
});

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

  test('returns true for a collection that commits to a branch the user can’t push to', () => {
    cmsConfig.current = {};
    lockedBranch.current = 'main';

    expect(isReadonly()).toBe(false);
    expect(isReadonly({ collection: { name: 'posts' } })).toBe(true);
    expect(isReadonly({ collection: { publish_mode: 'editorial_workflow' } })).toBe(false);
  });
});

describe('Test isConfigReadonly()', () => {
  afterEach(() => {
    cmsConfig.current = undefined;
  });

  test('uses the given configuration over the current one', () => {
    cmsConfig.current = { readonly: true };

    expect(isConfigReadonly({ config: {} })).toBe(false);
    expect(isConfigReadonly({ config: { readonly: true } })).toBe(true);
  });

  test('ignores the branch the user can’t push to', () => {
    cmsConfig.current = {};
    lockedBranch.current = 'main';

    expect(isConfigReadonly({ collection: { name: 'posts' } })).toBe(false);
  });
});

describe('Test isLockedByBranch()', () => {
  afterEach(() => {
    cmsConfig.current = undefined;
  });

  test('returns false when the user can push to the branch', () => {
    cmsConfig.current = {};

    expect(isLockedByBranch({ name: 'posts' })).toBe(false);
  });

  test('returns false without a collection', () => {
    cmsConfig.current = {};
    lockedBranch.current = 'main';

    expect(isLockedByBranch(undefined)).toBe(false);
  });

  test('follows the collection’s publish mode', () => {
    lockedBranch.current = 'main';
    cmsConfig.current = {};

    expect(isLockedByBranch({ name: 'posts' })).toBe(true);
    expect(isLockedByBranch({ name: 'posts', publish_mode: 'editorial_workflow' })).toBe(false);

    cmsConfig.current = { publish_mode: 'editorial_workflow' };

    expect(isLockedByBranch({ name: 'posts' })).toBe(false);
    expect(isLockedByBranch({ name: 'posts', publish_mode: 'simple' })).toBe(true);
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

describe('Test getReadonlyMessage()', () => {
  afterEach(() => {
    cmsConfig.current = undefined;
  });

  test('returns the message for the given scope', () => {
    cmsConfig.current = {};

    expect(getReadonlyMessage('collection')).toBe('readonly_collection');
    expect(getReadonlyMessage('entry')).toBe('readonly_entry');
    expect(getReadonlyMessage('asset_folder')).toBe('readonly_asset_folder');
  });

  test('returns the CMS-wide message when the whole CMS is read-only', () => {
    cmsConfig.current = { readonly: true };
    lockedBranch.current = 'main';

    expect(getReadonlyMessage('collection')).toBe('readonly_cms');
    expect(getReadonlyMessage('entry')).toBe('readonly_cms');
  });

  test('names the branch the user can’t push to', () => {
    cmsConfig.current = {};
    lockedBranch.current = 'main';

    expect(getReadonlyMessage('collection', { collection: {} })).toBe('readonly_branch:main');
    expect(getReadonlyMessage('entry', { collection: {}, collectionFile: {} })).toBe(
      'readonly_branch:main',
    );
    expect(getReadonlyMessage('asset_folder', { folder: {} })).toBe('readonly_branch:main');
    expect(getReadonlyMessage('asset_folder')).toBe('readonly_branch:main');
  });

  test('prefers the scope’s message when the target is read-only with the option', () => {
    cmsConfig.current = {};
    lockedBranch.current = 'main';

    expect(getReadonlyMessage('collection', { collection: { readonly: true } })).toBe(
      'readonly_collection',
    );
    expect(
      getReadonlyMessage('entry', { collection: {}, collectionFile: { readonly: true } }),
    ).toBe('readonly_entry');
    expect(getReadonlyMessage('asset_folder', { folder: { readonly: true } })).toBe(
      'readonly_asset_folder',
    );
  });
});
