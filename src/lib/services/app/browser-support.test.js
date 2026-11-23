import { afterEach, describe, expect, test, vi } from 'vitest';

import { getMissingBrowserFeatures, missingBrowserFeatures } from './browser-support';

describe('getMissingBrowserFeatures()', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  test('returns nothing in a browser supporting every feature', () => {
    expect(getMissingBrowserFeatures()).toEqual([]);
    expect(missingBrowserFeatures.current).toEqual([]);
  });

  test('reports the missing Base64 conversion', () => {
    vi.spyOn(/** @type {any} */ (Uint8Array), 'fromBase64', 'get').mockReturnValue(undefined);
    expect(getMissingBrowserFeatures()).toEqual(['Uint8Array Base64/hex conversion']);
  });

  test('reports the missing hex conversion', () => {
    vi.spyOn(/** @type {any} */ (Uint8Array.prototype), 'toHex', 'get').mockReturnValue(undefined);
    expect(getMissingBrowserFeatures()).toEqual(['Uint8Array Base64/hex conversion']);
  });

  test('reports the missing iterator helpers', () => {
    vi.stubGlobal('Iterator', undefined);
    expect(getMissingBrowserFeatures()).toEqual(['Iterator helpers']);
  });

  test('reports the iterator helpers missing from an existing `Iterator`', () => {
    // An `Iterator` without the helpers, as a browser may have exposed before adding them
    vi.stubGlobal(
      'Iterator',
      Object.assign(() => {}, { prototype: {} }),
    );
    expect(getMissingBrowserFeatures()).toEqual(['Iterator helpers']);
  });
});
