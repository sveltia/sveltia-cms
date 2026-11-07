import { removeVisibilityResolver } from '@sveltia/utils/element';
import { describe, expect, test, vi } from 'vitest';

import { holdViewTransition } from '$lib/services/app/navigation';
import { revokeAssetBlobURLIfNeeded, revokeBlobURLIfNeeded } from '$lib/services/assets/info';
import { createPreviewLifecycle } from '$lib/services/assets/preview-lifecycle';
import { whenThumbnailShown } from '$lib/services/utils/visibility';

vi.mock('@sveltia/utils/element', () => ({ removeVisibilityResolver: vi.fn() }));
vi.mock('$lib/services/app/navigation', () => ({ holdViewTransition: vi.fn() }));
vi.mock('$lib/services/assets/info', () => ({
  revokeAssetBlobURLIfNeeded: vi.fn(),
  revokeBlobURLIfNeeded: vi.fn(),
}));
vi.mock('$lib/services/utils/visibility', () => ({ whenThumbnailShown: vi.fn() }));

const element = /** @type {any} */ ({});
const asset = /** @type {any} */ ({ name: 'a.png' });

describe('settleLookup', () => {
  test('returns the URL and releases a thumbnail it replaces', () => {
    const lifecycle = createPreviewLifecycle();

    expect(lifecycle.settleLookup({ url: 'a', failed: false, thumbnail: true })).toBe('a');
    expect(revokeBlobURLIfNeeded).not.toHaveBeenCalled();

    expect(lifecycle.settleLookup({ url: 'b', failed: false, thumbnail: true })).toBe('b');
    expect(revokeBlobURLIfNeeded).toHaveBeenCalledExactlyOnceWith('a');
  });

  test('keeps the previous URL when the lookup has failed', () => {
    const lifecycle = createPreviewLifecycle();

    lifecycle.settleLookup({ url: 'a', failed: false, thumbnail: true });

    expect(lifecycle.settleLookup({ failed: true, thumbnail: true })).toBe('a');
    expect(revokeBlobURLIfNeeded).not.toHaveBeenCalled();
  });

  test('leaves a full-size URL alone, as it’s shared on the asset', () => {
    const lifecycle = createPreviewLifecycle();

    lifecycle.settleLookup({ url: 'a', failed: false, thumbnail: false });
    lifecycle.settleLookup({ url: 'b', failed: false, thumbnail: false });
    expect(revokeBlobURLIfNeeded).not.toHaveBeenCalled();
  });

  test('doesn’t own the same URL twice', () => {
    const lifecycle = createPreviewLifecycle();

    lifecycle.ownURL(undefined);
    lifecycle.ownURL('a');
    lifecycle.settleLookup({ url: 'a', failed: false, thumbnail: true });
    lifecycle.settleLookup({ url: 'a', failed: false, thumbnail: true });
    lifecycle.destroy();
    expect(revokeBlobURLIfNeeded).toHaveBeenCalledExactlyOnceWith('a');
  });
});

describe('waitForThumbnail', () => {
  test('resolves once the thumbnail is shown', async () => {
    const cancel = vi.fn();

    vi.mocked(whenThumbnailShown).mockReturnValue(cancel);

    const lifecycle = createPreviewLifecycle();
    const waiting = lifecycle.waitForThumbnail(element);

    vi.mocked(whenThumbnailShown).mock.calls[0][1]();
    await expect(waiting).resolves.toBeUndefined();

    // A wait that has finished has nothing left to cancel
    lifecycle.destroy();
    expect(cancel).not.toHaveBeenCalled();
  });

  test('cancels the wait in progress when another starts or the preview is removed', () => {
    const cancel = vi.fn();

    vi.mocked(whenThumbnailShown).mockReturnValue(cancel);

    const lifecycle = createPreviewLifecycle();

    lifecycle.waitForThumbnail(element);
    expect(cancel).not.toHaveBeenCalled();

    lifecycle.waitForThumbnail(element);
    expect(cancel).toHaveBeenCalledOnce();

    lifecycle.destroy();
    expect(cancel).toHaveBeenCalledTimes(2);
  });
});

describe('holdTransition', () => {
  /**
   * Tell whether a held view transition has been released.
   * @param {Promise<void>} promise Promise passed to `holdViewTransition()`.
   * @returns {Promise<boolean>} Result.
   */
  const isReleased = (promise) =>
    Promise.race([promise.then(() => true), Promise.resolve().then(() => false)]);

  test('holds the view transition until it’s released', async () => {
    const lifecycle = createPreviewLifecycle();

    lifecycle.holdTransition();

    const [hold] = vi.mocked(holdViewTransition).mock.calls[0];

    expect(await isReleased(hold)).toBe(false);

    lifecycle.releaseTransition();
    expect(await isReleased(hold)).toBe(true);

    // Nothing is held any more
    lifecycle.releaseTransition();
  });

  test('releases the earlier hold when held again', async () => {
    const lifecycle = createPreviewLifecycle();

    lifecycle.holdTransition();
    lifecycle.holdTransition();

    const [[first], [second]] = vi.mocked(holdViewTransition).mock.calls;

    expect(await isReleased(first)).toBe(true);
    expect(await isReleased(second)).toBe(false);
  });

  test('releases the hold when the preview is removed', async () => {
    const lifecycle = createPreviewLifecycle();

    lifecycle.holdTransition();
    lifecycle.destroy();

    const [hold] = vi.mocked(holdViewTransition).mock.calls[0];

    expect(await isReleased(hold)).toBe(true);
  });
});

describe('destroy', () => {
  test('releases what the preview holds', () => {
    const lifecycle = createPreviewLifecycle();

    lifecycle.trackAsset(asset);
    lifecycle.ownURL('a');
    lifecycle.ownURL('b');
    expect(lifecycle.destroyed).toBe(false);

    lifecycle.destroy(element);

    expect(lifecycle.destroyed).toBe(true);
    expect(revokeAssetBlobURLIfNeeded).toHaveBeenCalledExactlyOnceWith(asset);
    expect(vi.mocked(revokeBlobURLIfNeeded).mock.calls).toEqual([['a'], ['b']]);
    expect(removeVisibilityResolver).toHaveBeenCalledExactlyOnceWith(element);
  });

  test('releases the asset last rendered', () => {
    const lifecycle = createPreviewLifecycle();
    const nextAsset = /** @type {any} */ ({ name: 'b.png' });

    lifecycle.trackAsset(asset);
    lifecycle.trackAsset(nextAsset);
    lifecycle.destroy();

    expect(revokeAssetBlobURLIfNeeded).toHaveBeenCalledExactlyOnceWith(nextAsset);
  });

  test('has nothing to release once the asset has gone', () => {
    const lifecycle = createPreviewLifecycle();

    lifecycle.trackAsset(asset);
    lifecycle.trackAsset(undefined);
    lifecycle.destroy();

    expect(revokeAssetBlobURLIfNeeded).not.toHaveBeenCalled();
    expect(removeVisibilityResolver).not.toHaveBeenCalled();
  });
});
