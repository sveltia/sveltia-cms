import { describe, expect, it, vi } from 'vitest';

import { deleteAssets } from '$lib/services/assets/data/delete';
import { runCommit } from '$lib/services/backends/commit-prompt';

import { commitAssetDeletion } from './delete-commit.js';

vi.mock('$lib/services/assets/data/delete', () => ({
  deleteAssets: vi.fn(),
}));

vi.mock('$lib/services/backends/commit-prompt', () => ({
  runCommit: vi.fn(),
}));

describe('assets/data/delete-commit', () => {
  describe('commitAssetDeletion()', () => {
    const assets = /** @type {any[]} */ ([{ path: 'static/uploads/a.png' }]);

    it('deletes the assets in a commit', async () => {
      vi.mocked(runCommit).mockImplementation(async (action) => ({
        ok: true,
        cancelled: false,
        result: await action(),
        error: undefined,
      }));

      await expect(commitAssetDeletion(assets)).resolves.toEqual({ ok: true, failed: false });
      expect(deleteAssets).toHaveBeenCalledWith(assets);
    });

    it('reports a failure', async () => {
      vi.mocked(runCommit).mockResolvedValue({
        ok: false,
        cancelled: false,
        result: undefined,
        error: new Error('offline'),
      });

      await expect(commitAssetDeletion(assets)).resolves.toEqual({ ok: false, failed: true });
    });

    it('doesn’t report a cancellation at the commit message prompt as a failure', async () => {
      vi.mocked(runCommit).mockResolvedValue({
        ok: false,
        cancelled: true,
        result: undefined,
        error: new Error('commit_cancelled'),
      });

      await expect(commitAssetDeletion(assets)).resolves.toEqual({ ok: false, failed: false });
    });
  });
});
