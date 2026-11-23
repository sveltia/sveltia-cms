// @vitest-environment happy-dom

import { flushSync } from 'svelte';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import {
  defaultAssetDetails,
  getAssetDetails,
  getAssetUsedEntries,
} from '$lib/services/assets/details';

import { createAssetDetailsState } from './details-state.svelte.js';

/**
 * @import { Asset, AssetDetails } from '$lib/types/private';
 */

vi.mock('$lib/services/assets/details', async (importOriginal) => ({
  .../** @type {object} */ (await importOriginal()),
  getAssetDetails: vi.fn(),
  getAssetUsedEntries: vi.fn(),
}));

const assetA = /** @type {Asset} */ (/** @type {unknown} */ ({ path: 'a.png' }));
const assetB = /** @type {Asset} */ (/** @type {unknown} */ ({ path: 'b.png' }));
/**
 * Build the details of an asset.
 * @param {string} publicURL Public URL.
 * @returns {AssetDetails} Details.
 */
const createDetails = (publicURL) => ({ ...defaultAssetDetails, publicURL });

/**
 * Wait for the pending promises to settle.
 */
const settle = async () => {
  await new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
};

describe('createAssetDetailsState()', () => {
  /** @type {{ current: Asset | undefined }} */
  const props = $state({ current: undefined });
  /** @type {{ current: AssetDetails }} */
  let details;
  /** @type {() => void} */
  let cleanup;
  /** @type {import('vitest').MockInstance} */
  let consoleError;

  /**
   * Create the state for {@link props}, in an effect root standing in for a component.
   * @param {object} [options] Options.
   */
  const create = (options) => {
    cleanup = $effect.root(() => {
      details = createAssetDetailsState(() => props.current, options);
    });
    flushSync();
  };

  beforeEach(() => {
    props.current = assetA;
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    consoleError.mockRestore();
  });

  test('retrieves the details of the asset, starting with the defaults', async () => {
    vi.mocked(getAssetDetails).mockResolvedValue(createDetails('https://example.com/a.png'));
    create();

    expect(details.current).toEqual(defaultAssetDetails);
    await settle();
    expect(details.current.publicURL).toBe('https://example.com/a.png');
    expect(getAssetDetails).toHaveBeenCalledWith(assetA);
    expect(getAssetUsedEntries).not.toHaveBeenCalled();
  });

  test('keeps the defaults without an asset', async () => {
    props.current = undefined;
    create();
    await settle();
    expect(details.current).toEqual(defaultAssetDetails);
    expect(getAssetDetails).not.toHaveBeenCalled();
  });

  test('keeps the defaults when the details can’t be retrieved', async () => {
    vi.mocked(getAssetDetails).mockRejectedValue(new Error('offline'));
    create();
    await settle();
    expect(details.current).toEqual(defaultAssetDetails);
    expect(consoleError).toHaveBeenCalledWith(new Error('offline'));
  });

  test('drops the details of the previous asset, ignoring a late answer for it', async () => {
    const first = /** @type {PromiseWithResolvers<AssetDetails>} */ (Promise.withResolvers());

    vi.mocked(getAssetDetails)
      .mockReturnValueOnce(first.promise)
      .mockResolvedValueOnce(createDetails('https://example.com/b.png'));
    create();
    props.current = assetB;
    flushSync();
    await settle();
    expect(details.current.publicURL).toBe('https://example.com/b.png');

    first.resolve(createDetails('https://example.com/a.png'));
    await settle();
    expect(details.current.publicURL).toBe('https://example.com/b.png');
  });

  describe('with the used entries', () => {
    const entries = /** @type {any[]} */ ([{ id: 'post-1' }]);

    test('looks up the entries once the details have been retrieved', async () => {
      const lookup = /** @type {PromiseWithResolvers<any[]>} */ (Promise.withResolvers());

      vi.mocked(getAssetDetails).mockResolvedValue(createDetails('https://example.com/a.png'));
      vi.mocked(getAssetUsedEntries).mockReturnValue(lookup.promise);
      create({ withUsedEntries: true });

      // The entries are being looked up
      expect(details.current.usedEntries).toBeUndefined();
      await settle();
      expect(details.current.publicURL).toBe('https://example.com/a.png');
      expect(details.current.usedEntries).toEqual([]);

      lookup.resolve(entries);
      await settle();
      expect(details.current.usedEntries).toEqual(entries);
      expect(getAssetUsedEntries).toHaveBeenCalledWith(assetA);
    });

    test('looks up the entries even when the details can’t be retrieved', async () => {
      vi.mocked(getAssetDetails).mockRejectedValue(new Error('offline'));
      vi.mocked(getAssetUsedEntries).mockResolvedValue(entries);
      create({ withUsedEntries: true });
      await settle();
      expect(details.current).toEqual({ ...defaultAssetDetails, usedEntries: entries });
    });

    test('stops showing the entries as being loaded when the lookup fails', async () => {
      vi.mocked(getAssetDetails).mockResolvedValue(createDetails('https://example.com/a.png'));
      vi.mocked(getAssetUsedEntries).mockRejectedValue(new Error('offline'));
      create({ withUsedEntries: true });
      await settle();
      expect(details.current.usedEntries).toEqual([]);
      expect(consoleError).toHaveBeenCalledWith(new Error('offline'));
    });

    test('ignores the entries of the previous asset', async () => {
      const lookup = /** @type {PromiseWithResolvers<any[]>} */ (Promise.withResolvers());

      vi.mocked(getAssetDetails).mockResolvedValue(createDetails('https://example.com/a.png'));
      vi.mocked(getAssetUsedEntries)
        .mockReturnValueOnce(lookup.promise)
        .mockReturnValueOnce(new Promise(() => {}));
      create({ withUsedEntries: true });
      await settle();

      props.current = assetB;
      flushSync();
      lookup.resolve(entries);
      await settle();
      expect(details.current.usedEntries).toEqual([]);
    });
  });
});
