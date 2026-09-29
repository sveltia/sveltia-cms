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

  test('applies a legacy `media_library` option without a name to the site-level library', () => {
    const legacy = { config: { publicKey: 'legacy' } };

    cmsConfig.current = { media_library: { name: 'uploadcare' } };
    expect(findLibraryOptions('uploadcare', { media_library: legacy })).toBe(legacy);
    expect(findLibraryOptions('cloudinary', { media_library: legacy })).toBeUndefined();

    cmsConfig.current = { media_library: { config: {} } };
    expect(findLibraryOptions('uploadcare', { media_library: legacy })).toBeUndefined();

    cmsConfig.current = undefined;
    expect(findLibraryOptions('uploadcare', { media_library: legacy })).toBeUndefined();
  });

  test('ignores a `null` library in the `media_libraries` map', () => {
    const legacy = { name: 'uploadcare', config: { publicKey: 'legacy' } };

    expect(
      findLibraryOptions('uploadcare', {
        media_libraries: { uploadcare: null },
        media_library: legacy,
      }),
    ).toBe(legacy);
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

  test('merges the field configuration over the site configuration', () => {
    cmsConfig.current = {
      media_libraries: {
        uploadcare: {
          config: { publicKey: 'site', cdnBase: 'https://cdn.example.com' },
          settings: { autoFilename: true, defaultOperations: '/resize/800x/' },
          multiple: true,
        },
      },
    };

    const fieldConfig = {
      widget: 'image',
      media_libraries: {
        uploadcare: { config: { publicKey: 'field' }, settings: { autoFilename: false } },
      },
    };

    expect(resolveLibraryOptions('uploadcare', fieldConfig)).toEqual({
      config: { publicKey: 'field', cdnBase: 'https://cdn.example.com' },
      settings: { autoFilename: false, defaultOperations: '/resize/800x/' },
      multiple: true,
    });
  });

  test('replaces top-level properties that are not objects on both sides', () => {
    cmsConfig.current = {
      media_libraries: {
        cloudinary: {
          use_transformations: true,
          config: { cloud_name: 'site', default_transformations: [[{ width: 400 }]] },
        },
      },
    };

    const fieldConfig = {
      widget: 'image',
      media_libraries: {
        cloudinary: {
          use_transformations: false,
          config: { default_transformations: [[{ width: 800 }]] },
        },
      },
    };

    expect(resolveLibraryOptions('cloudinary', fieldConfig)).toEqual({
      use_transformations: false,
      config: { cloud_name: 'site', default_transformations: [[{ width: 800 }]] },
    });
  });

  test('merges a flat field configuration over the site configuration', () => {
    cmsConfig.current = {
      media_libraries: { aws_s3: { access_key_id: 'key', bucket: 'site', region: 'us-east-1' } },
    };

    const fieldConfig = { widget: 'image', media_libraries: { aws_s3: { bucket: 'field' } } };

    expect(resolveLibraryOptions('aws_s3', fieldConfig)).toEqual({
      access_key_id: 'key',
      bucket: 'field',
      region: 'us-east-1',
    });
  });

  test('merges a legacy field configuration without a name over the site configuration', () => {
    cmsConfig.current = {
      media_library: { name: 'uploadcare', config: { publicKey: 'site', cdnBase: 'cdn' } },
    };

    const fieldConfig = { widget: 'image', media_library: { config: { cdnBase: 'field' } } };

    expect(resolveLibraryOptions('uploadcare', fieldConfig)).toEqual({
      name: 'uploadcare',
      config: { publicKey: 'site', cdnBase: 'field' },
    });
  });

  test('uses the field configuration when the site doesn’t configure the library', () => {
    const fieldConfig = { widget: 'image', media_libraries: { cloudinary: fieldOptions } };

    expect(resolveLibraryOptions('cloudinary', fieldConfig)).toBe(fieldOptions);
  });

  test('uses the field configuration when the site disables the library', () => {
    cmsConfig.current = { media_libraries: { uploadcare: false } };

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
