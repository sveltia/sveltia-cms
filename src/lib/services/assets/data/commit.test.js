import { beforeEach, describe, expect, it, vi } from 'vitest';

import { assetCommitToast } from '$lib/services/assets/data';
import { runCommit } from '$lib/services/backends/commit-prompt';

import { runAssetCommit } from './commit.js';

/** The failure flag as it was whenever the toast state was flushed with `tick()`. */
const tickStates = vi.hoisted(() => /** @type {boolean[]} */ ([]));

vi.mock('svelte', async (importOriginal) => ({
  .../** @type {object} */ (await importOriginal()),
  tick: vi.fn(async () => {
    const { assetCommitToast: toast } = await import('$lib/services/assets/data');

    tickStates.push(toast.current.failed);
  }),
}));

vi.mock('$lib/services/backends/commit-prompt', () => ({
  runCommit: vi.fn(),
}));

vi.mock('$lib/services/assets/data', () => ({
  assetCommitToast: { current: {} },
}));

describe('assets/data/commit', () => {
  describe('runAssetCommit()', () => {
    const messages = { progress: 'creating_folder', failure: 'creating_folder_failed' };

    beforeEach(() => {
      assetCommitToast.current = { pending: 0, progress: '', failed: false, failure: '' };
    });

    it('runs the action, showing the progress while it’s under way', async () => {
      const action = vi.fn(async () => 'done');

      vi.mocked(runCommit).mockImplementation(async (fn) => {
        // The progress is shown before the commit starts
        expect(assetCommitToast.current).toEqual({
          pending: 1,
          progress: 'creating_folder',
          failed: false,
          failure: '',
        });

        return { ok: true, cancelled: false, result: await fn(), error: undefined };
      });

      await expect(runAssetCommit(action, messages)).resolves.toEqual({
        ok: true,
        cancelled: false,
        result: 'done',
        error: undefined,
      });
      expect(action).toHaveBeenCalledOnce();
      expect(assetCommitToast.current).toEqual({
        pending: 0,
        progress: 'creating_folder',
        failed: false,
        failure: '',
      });
    });

    it('keeps the progress up until every commit under way has settled', async () => {
      /** @type {((value: any) => void)[]} */
      const resolvers = [];

      vi.mocked(runCommit).mockImplementation(
        () =>
          new Promise((resolve) => {
            resolvers.push(resolve);
          }),
      );

      const first = runAssetCommit(vi.fn(), messages);
      const second = runAssetCommit(vi.fn(), { ...messages, progress: 'renaming_folder' });

      expect(assetCommitToast.current.pending).toBe(2);
      expect(assetCommitToast.current.progress).toBe('renaming_folder');

      // The latest commit still running is shown, whichever finishes first
      resolvers[1]({ ok: true, cancelled: false });
      await second;
      expect(assetCommitToast.current.pending).toBe(1);
      expect(assetCommitToast.current.progress).toBe('creating_folder');

      resolvers[0]({ ok: true, cancelled: false });
      await first;
      expect(assetCommitToast.current.pending).toBe(0);
    });

    it('shows a failure again from the start when another one comes in', async () => {
      vi.mocked(runCommit).mockResolvedValue({
        ok: false,
        cancelled: false,
        result: undefined,
        error: new Error('x'),
      });
      assetCommitToast.current.failed = true;
      tickStates.length = 0;

      await runAssetCommit(vi.fn(), messages);

      // The toast is hidden for a tick, which restarts its timer once it’s shown again
      expect(tickStates).toEqual([false]);
      expect(assetCommitToast.current.failed).toBe(true);
    });

    it('reports a failure', async () => {
      const outcome = /** @type {const} */ ({
        ok: false,
        cancelled: false,
        result: undefined,
        error: new Error('x'),
      });

      vi.mocked(runCommit).mockResolvedValue(outcome);

      await expect(runAssetCommit(vi.fn(), messages)).resolves.toBe(outcome);
      expect(assetCommitToast.current).toEqual({
        pending: 0,
        progress: 'creating_folder',
        failed: true,
        failure: 'creating_folder_failed',
      });
    });

    it('doesn’t report a cancellation at the commit message prompt as a failure', async () => {
      vi.mocked(runCommit).mockResolvedValue({
        ok: false,
        cancelled: true,
        result: undefined,
        error: new Error('commit_cancelled'),
      });

      await runAssetCommit(vi.fn(), messages);
      expect(assetCommitToast.current.failed).toBe(false);
    });

    it('shows no progress without a message', async () => {
      vi.mocked(runCommit).mockImplementation(async () => {
        expect(assetCommitToast.current.pending).toBe(0);

        return { ok: false, cancelled: false, result: undefined, error: new Error('x') };
      });

      await runAssetCommit(vi.fn(), { failure: 'deleting_assets_failed' });
      expect(assetCommitToast.current).toEqual({
        pending: 0,
        progress: '',
        failed: true,
        failure: 'deleting_assets_failed',
      });
    });
  });
});
