// @ts-nocheck
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { cmsConfig } from '$lib/services/config/state';
import {
  findLibraryOptions,
  resolveLibraryOptions,
} from '$lib/services/integrations/media-libraries/options';

vi.mock('$lib/services/config/state', () => ({ cmsConfig: { current: undefined } }));

const siteOptions = { config: { publicKey: 'site' } };
const fieldOptions = { config: { publicKey: 'field' } };

describe('findLibraryOptions()', () => {
  test('returns undefined without a config', () => {
    expect(findLibraryOptions('uploadcare', undefined)).toBeUndefined();
    expect(findLibraryOptions('uploadcare', {})).toBeUndefined();
  });

  test('prefers the `media_libraries` map', () => {
    const config = {
      media_libraries: { uploadcare: siteOptions },
      media_library: { name: 'uploadcare', config: { publicKey: 'legacy' } },
    };

    expect(findLibraryOptions('uploadcare', config)).toBe(siteOptions);
  });

  test('returns `false` when the library is explicitly disabled', () => {
    expect(findLibraryOptions('uploadcare', { media_libraries: { uploadcare: false } })).toBe(
      false,
    );
  });

  test('falls back to the legacy `media_library` option with a matching name', () => {
    const legacy = { name: 'uploadcare', config: { publicKey: 'legacy' } };

    expect(findLibraryOptions('uploadcare', { media_library: legacy })).toBe(legacy);
    expect(findLibraryOptions('cloudinary', { media_library: legacy })).toBeUndefined();
  });

  test('ignores other libraries', () => {
    expect(
      findLibraryOptions('uploadcare', { media_libraries: { cloudinary: siteOptions } }),
    ).toBeUndefined();
  });
});

describe('resolveLibraryOptions()', () => {
  beforeEach(() => {
    cmsConfig.current = { media_libraries: { uploadcare: siteOptions } };
  });

  test('prefers the field configuration', () => {
    const fieldConfig = { widget: 'image', media_libraries: { uploadcare: fieldOptions } };

    expect(resolveLibraryOptions('uploadcare', fieldConfig)).toBe(fieldOptions);
  });

  test('falls back to the site configuration', () => {
    expect(resolveLibraryOptions('uploadcare', { widget: 'image' })).toBe(siteOptions);
    expect(resolveLibraryOptions('uploadcare')).toBe(siteOptions);
  });

  test('keeps a field-level `false` from falling back to the site configuration', () => {
    const fieldConfig = { widget: 'image', media_libraries: { uploadcare: false } };

    expect(resolveLibraryOptions('uploadcare', fieldConfig)).toBe(false);
  });

  test('returns undefined when neither configures the library', () => {
    cmsConfig.current = undefined;

    expect(resolveLibraryOptions('uploadcare', { widget: 'image' })).toBeUndefined();
  });
});
