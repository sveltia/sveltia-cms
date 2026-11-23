// @ts-nocheck
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { cmsConfig } from '$lib/services/config/state';
import {
  findLibraryOptions,
  findPreferredLibraryName,
  getPreferredLibraryNames,
  getUploadableServiceEntries,
  mergeLibraryOptions,
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

  test('applies the legacy option to the site default library only, given its name', () => {
    const legacy = { config: { publicKey: 'legacy' } };
    const named = { name: 'stock_assets', config: {} };

    cmsConfig.current = { media_library: { config: {} } };
    expect(findLibraryOptions('default', cmsConfig.current, 'default')).toBe(
      cmsConfig.current.media_library,
    );
    expect(findLibraryOptions('default', { media_library: legacy }, 'default')).toBe(legacy);
    expect(findLibraryOptions('stock_assets', { media_library: legacy }, 'default')).toBe(
      undefined,
    );
    // A field-level legacy option can’t switch to another library than the site-level one
    expect(findLibraryOptions('stock_assets', { media_library: named }, 'default')).toBe(undefined);
    expect(findLibraryOptions('stock_assets', { media_library: named })).toBe(named);

    cmsConfig.current = undefined;
    expect(findLibraryOptions('default', { media_library: legacy }, 'default')).toBe(legacy);
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

describe('mergeLibraryOptions()', () => {
  test('returns the site options when the field sets none', () => {
    const site = { config: { a: 1 } };

    expect(mergeLibraryOptions(site, undefined)).toBe(site);
    expect(mergeLibraryOptions(false, undefined)).toBe(false);
    expect(mergeLibraryOptions(undefined, undefined)).toBeUndefined();
  });

  test('returns the field options as is when either side has nothing to merge', () => {
    const field = { config: { a: 1 } };

    expect(mergeLibraryOptions({ config: { b: 2 } }, false)).toBe(false);
    expect(mergeLibraryOptions(false, field)).toBe(field);
    expect(mergeLibraryOptions(undefined, field)).toBe(field);
  });

  test('merges the objects one level deep only', () => {
    expect(
      mergeLibraryOptions(
        { max_file_size: 100, config: { a: 1, nested: { x: 1, y: 2 } } },
        { config: { b: 2, nested: { x: 3 } } },
      ),
    ).toEqual({ max_file_size: 100, config: { a: 1, b: 2, nested: { x: 3 } } });
  });

  test('replaces an array rather than merging it', () => {
    expect(mergeLibraryOptions({ formats: ['jpg', 'png'] }, { formats: ['webp'] })).toEqual({
      formats: ['webp'],
    });
  });

  test('leaves the given options untouched', () => {
    const site = { config: { a: 1 } };
    const field = { config: { b: 2 } };

    mergeLibraryOptions(site, field);

    expect(site).toEqual({ config: { a: 1 } });
    expect(field).toEqual({ config: { b: 2 } });
  });
});

describe('getPreferredLibraryNames()', () => {
  beforeEach(() => {
    cmsConfig.current = undefined;
  });

  test('returns nothing when no library is marked', () => {
    expect(getPreferredLibraryNames()).toEqual([]);
    cmsConfig.current = {
      media_libraries: { all: { default: true }, aws_s3: { bucket: 'b' }, stock_assets: false },
    };
    expect(getPreferredLibraryNames({ widget: 'image' })).toEqual([]);
  });

  test('returns the library marked at the site level', () => {
    cmsConfig.current = {
      media_libraries: { default: {}, aws_s3: { bucket: 'b', default: true } },
    };
    expect(getPreferredLibraryNames()).toEqual(['aws_s3']);
    expect(getPreferredLibraryNames({ widget: 'image' })).toEqual(['aws_s3']);
  });

  test('puts the libraries marked at the field level first', () => {
    cmsConfig.current = { media_libraries: { aws_s3: { bucket: 'b', default: true } } };

    expect(
      getPreferredLibraryNames({
        widget: 'image',
        media_libraries: { cloudflare_r2: { bucket: 'r', default: true } },
      }),
    ).toEqual(['cloudflare_r2', 'aws_s3']);
    // The default library can be marked to open a repository folder again
    expect(
      getPreferredLibraryNames({
        widget: 'image',
        media_libraries: { default: { default: true } },
      }),
    ).toEqual(['default', 'aws_s3']);
  });

  test('puts a library marked in the field before one inherited from the site', () => {
    cmsConfig.current = {
      media_libraries: {
        aws_s3: { bucket: 'b', default: true },
        cloudflare_r2: { bucket: 'r' },
      },
    };

    expect(
      getPreferredLibraryNames({
        widget: 'image',
        media_libraries: { aws_s3: { prefix: 'x/' }, cloudflare_r2: { default: true } },
      }),
    ).toEqual(['cloudflare_r2', 'aws_s3']);
  });

  test('keeps the order of the libraries marked at the site level', () => {
    cmsConfig.current = {
      media_libraries: {
        aws_s3: { bucket: 'b', default: true },
        cloudflare_r2: { bucket: 'r', default: true },
      },
    };

    expect(
      getPreferredLibraryNames({
        widget: 'image',
        media_libraries: { cloudflare_r2: { prefix: 'x/' } },
      }),
    ).toEqual(['aws_s3', 'cloudflare_r2']);
  });

  test('treats an empty field-level entry as not configured', () => {
    cmsConfig.current = { media_libraries: { aws_s3: { bucket: 'b', default: true } } };

    expect(
      getPreferredLibraryNames({ widget: 'image', media_libraries: { aws_s3: null } }),
    ).toEqual(['aws_s3']);
  });

  test('lets a field clear or disable the library marked at the site level', () => {
    cmsConfig.current = { media_libraries: { aws_s3: { bucket: 'b', default: true } } };

    expect(
      getPreferredLibraryNames({
        widget: 'image',
        media_libraries: { aws_s3: { default: false } },
      }),
    ).toEqual([]);
    expect(
      getPreferredLibraryNames({ widget: 'image', media_libraries: { aws_s3: false } }),
    ).toEqual([]);
  });

  test('ignores the legacy `media_library` option', () => {
    cmsConfig.current = { media_libraries: { aws_s3: { bucket: 'b', default: true } } };

    expect(
      getPreferredLibraryNames({
        widget: 'image',
        media_library: { name: 'aws_s3', default: false },
      }),
    ).toEqual(['aws_s3']);
  });
});

describe('getUploadableServiceEntries()', () => {
  test('leaves out the services that can’t upload files', () => {
    const upload = vi.fn();

    expect(
      getUploadableServiceEntries([
        ['cloudinary', {}],
        ['aws_s3', { upload }],
      ]),
    ).toEqual([['aws_s3', { upload }]]);
  });
});

describe('findPreferredLibraryName()', () => {
  const cloudServiceEntries = [
    ['cloudinary', {}],
    ['aws_s3', { upload: vi.fn() }],
  ];

  test('returns the first marked library that’s offered', () => {
    expect(
      findPreferredLibraryName({
        preferredLibraryNames: ['gcs', 'default', 'aws_s3'],
        repositoryAvailable: true,
        cloudServiceEntries,
      }),
    ).toBe('default');
    expect(
      findPreferredLibraryName({
        preferredLibraryNames: ['default', 'cloudinary'],
        repositoryAvailable: false,
        cloudServiceEntries,
      }),
    ).toBe('cloudinary');
    expect(
      findPreferredLibraryName({
        preferredLibraryNames: [],
        repositoryAvailable: true,
        cloudServiceEntries,
      }),
    ).toBeUndefined();
  });

  test('skips a service that can’t upload when files are to be uploaded', () => {
    expect(
      findPreferredLibraryName({
        preferredLibraryNames: ['cloudinary', 'aws_s3'],
        repositoryAvailable: false,
        cloudServiceEntries,
        uploadRequired: true,
      }),
    ).toBe('aws_s3');
  });
});
