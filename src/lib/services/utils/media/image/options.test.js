import { describe, expect, test } from 'vitest';

import { resolveTransformOptions } from '$lib/services/utils/media/image/options';

describe('resolveTransformOptions()', () => {
  test('fills in the defaults', () => {
    expect(resolveTransformOptions()).toEqual({
      format: 'png',
      quality: 85,
      width: undefined,
      height: undefined,
      fit: 'scale-down',
      nativeOnly: false,
    });
  });

  test('keeps the given options', () => {
    const options = {
      format: /** @type {const} */ ('webp'),
      quality: 60,
      width: 100,
      height: 50,
      fit: /** @type {const} */ ('contain'),
      nativeOnly: true,
    };

    expect(resolveTransformOptions(options)).toEqual(options);
  });
});
