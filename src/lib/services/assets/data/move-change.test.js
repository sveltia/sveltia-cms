import { beforeEach, describe, expect, test, vi } from 'vitest';

import { createAssetMoveChange } from '$lib/services/assets/data/move-change';
import { getAssetBlob } from '$lib/services/assets/info';

vi.mock('$lib/services/assets/info', () => ({ getAssetBlob: vi.fn() }));

/**
 * Create an asset.
 * @param {Record<string, any>} [props] Extra properties.
 * @returns {any} Asset.
 */
const createAsset = (props = {}) => ({
  name: 'photo.jpg',
  path: 'images/photo.jpg',
  sha: 'abc',
  ...props,
});

describe('createAssetMoveChange()', () => {
  beforeEach(() => {
    vi.mocked(getAssetBlob).mockResolvedValue(new Blob(['remote'], { type: 'image/jpeg' }));
  });

  test('reads the blob of a saved asset and keeps its name by default', async () => {
    const change = await createAssetMoveChange(createAsset(), 'media/photo.jpg');

    expect(change).toMatchObject({
      action: 'move',
      path: 'media/photo.jpg',
      previousPath: 'images/photo.jpg',
      previousSha: 'abc',
    });
    expect(change.data).toBeInstanceOf(File);
    expect(/** @type {File} */ (change.data).name).toBe('photo.jpg');
    expect(/** @type {File} */ (change.data).type).toBe('image/jpeg');
    expect(await /** @type {File} */ (change.data).text()).toBe('remote');
  });

  test('copies the file of an unsaved asset under the given name', async () => {
    const file = new File(['local'], 'photo.jpg', { type: 'image/png' });
    const change = await createAssetMoveChange(createAsset({ file }), 'media/new.png', 'new.png');

    expect(getAssetBlob).not.toHaveBeenCalled();
    expect(change.data).not.toBe(file);
    expect(/** @type {File} */ (change.data).name).toBe('new.png');
    expect(await /** @type {File} */ (change.data).text()).toBe('local');
  });
});
