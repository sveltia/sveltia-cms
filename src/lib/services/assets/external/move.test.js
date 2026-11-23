import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getMoveBlockedMessage,
  planReferenceRewrite,
  saveReferenceChanges,
} from '$lib/services/assets/data/move';
import { assetsLocked } from '$lib/services/assets/folders';

import {
  getExternalChangeBlockedMessage,
  moveFilesWithReferences,
  planExternalReferenceRewrite,
} from './move.js';

vi.mock('@sveltia/i18n', () => ({
  _: vi.fn((/** @type {string} */ key, /** @type {any} */ { values }) => `${key}:${values.count}`),
}));

vi.mock('$lib/services/assets/data/move', () => ({
  getMoveBlockedMessage: vi.fn(),
  planReferenceRewrite: vi.fn(),
  saveReferenceChanges: vi.fn(),
}));

vi.mock('$lib/services/assets/external', () => ({
  getFetchOptions: vi.fn(() => ({ apiKey: 'key' })),
}));

vi.mock('$lib/services/assets/folders', () => ({
  assetsLocked: { current: false },
}));

const ENTRY = /** @type {any} */ ({ id: 'evening' });

/**
 * Create a file on a service.
 * @param {string} path Path relative to the prefix.
 * @returns {any} Asset.
 */
const createAsset = (path) => ({
  id: `uploads/${path}`,
  description: path,
  fileName: path.split('/').pop(),
  downloadURL: `https://cdn.example.com/uploads/${path}`,
});

describe('assets/external/move', () => {
  beforeEach(() => {
    /** @type {any} */ (assetsLocked).current = false;
    vi.mocked(getMoveBlockedMessage).mockReturnValue(undefined);
  });

  describe('getExternalChangeBlockedMessage', () => {
    it('allows files whose entries can be updated', () => {
      expect(getExternalChangeBlockedMessage([ENTRY], 1)).toBeUndefined();
      expect(getMoveBlockedMessage).toHaveBeenCalledWith([ENTRY]);
    });

    it('refuses files a read-only entry uses', () => {
      vi.mocked(getMoveBlockedMessage).mockReturnValue('Read-only');
      expect(getExternalChangeBlockedMessage([ENTRY], 1)).toBe('Read-only');
    });

    it('refuses files that entries use while the media library is locked', () => {
      /** @type {any} */ (assetsLocked).current = true;
      expect(getExternalChangeBlockedMessage([ENTRY], 1)).toBe(
        'cannot_change_used_external_files:1',
      );
      expect(getExternalChangeBlockedMessage([ENTRY], 2)).toBe(
        'cannot_change_used_external_files:2',
      );
      // No entry to update, so nothing to commit
      expect(getExternalChangeBlockedMessage([], 1)).toBeUndefined();
    });
  });

  describe('planExternalReferenceRewrite', () => {
    it('finds the entries by the files’ URLs', async () => {
      const assets = [createAsset('a.png'), createAsset('b.png')];
      const plan = { targets: [], usedEntries: [[ENTRY], [ENTRY]] };

      vi.mocked(planReferenceRewrite).mockResolvedValue(/** @type {any} */ (plan));

      await expect(planExternalReferenceRewrite(assets)).resolves.toBe(plan);
      expect(planReferenceRewrite).toHaveBeenCalledWith([
        { url: assets[0].downloadURL },
        { url: assets[1].downloadURL },
      ]);
      // Each entry counted once
      expect(getMoveBlockedMessage).toHaveBeenCalledWith([ENTRY]);
    });

    it('refuses when the entries can’t be updated', async () => {
      vi.mocked(planReferenceRewrite).mockResolvedValue(
        /** @type {any} */ ({ targets: [], usedEntries: [[ENTRY]] }),
      );
      /** @type {any} */ (assetsLocked).current = true;

      await expect(planExternalReferenceRewrite([createAsset('a.png')])).rejects.toThrow(
        'cannot_change_used_external_files:1',
      );
    });
  });

  describe('moveFilesWithReferences', () => {
    const plan = /** @type {any} */ ({ targets: [], usedEntries: [] });

    /**
     * Create a mock service whose moves land at the given path.
     * @returns {any} Service.
     */
    const createService = () => ({
      move: vi.fn(async (/** @type {any} */ _asset, /** @type {string} */ path) =>
        createAsset(path),
      ),
    });

    it('moves the files, then points the entries at their new URLs', async () => {
      const service = createService();
      const a = createAsset('a.png');

      await expect(
        moveFilesWithReferences({ service, moves: [{ asset: a, path: 'x/a.png' }], plan }),
      ).resolves.toEqual([createAsset('x/a.png')]);
      expect(service.move).toHaveBeenCalledWith(a, 'x/a.png', { apiKey: 'key' });
      expect(saveReferenceChanges).toHaveBeenCalledWith({
        plan,
        newURLs: [createAsset('x/a.png').downloadURL],
        commitType: 'uploadMedia',
      });
    });

    it('moves the files moved so far back when a move or the save fails', async () => {
      const service = createService();
      const error = vi.spyOn(console, 'error').mockImplementation(() => {});

      service.move
        .mockResolvedValueOnce(createAsset('x/a.png'))
        .mockResolvedValueOnce(createAsset('x/b.png'))
        .mockRejectedValueOnce(new Error('Move failed'))
        // Moving back: the first can’t be, the second can
        .mockRejectedValueOnce(new Error('Gone'));

      await expect(
        moveFilesWithReferences({
          service,
          moves: [
            { asset: createAsset('a.png'), path: 'x/a.png' },
            { asset: createAsset('b.png'), path: 'x/b.png' },
            { asset: createAsset('c.png'), path: 'x/c.png' },
          ],
          plan,
        }),
      ).rejects.toThrow('Move failed');
      expect(service.move.mock.calls.slice(3).map((/** @type {any[]} */ [, path]) => path)).toEqual(
        ['a.png', 'b.png'],
      );
      expect(error).toHaveBeenCalledWith(new Error('Gone'));
      expect(saveReferenceChanges).not.toHaveBeenCalled();
    });
  });
});
