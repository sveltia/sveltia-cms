import { get } from 'svelte/store';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { fetchBranchHeadSHA, fetchDeployments } from '$lib/services/backends/git/gitlab/deployment';
import { repository } from '$lib/services/backends/git/gitlab/repository';
import { fetchAPI } from '$lib/services/backends/git/shared/api';

vi.mock('$lib/services/backends/git/gitlab/repository', () => ({
  repository: { owner: 'group/sub', repo: 'project', branch: 'main' },
}));
vi.mock('$lib/services/backends/git/shared/api');
vi.mock('$lib/services/config', () => ({ cmsConfig: { subscribe: vi.fn() } }));
vi.mock('svelte/store', async (importOriginal) => ({
  .../** @type {object} */ (await importOriginal()),
  get: vi.fn(),
}));

const PROJECT_ID = encodeURIComponent('group/sub/project');

/**
 * Create a deploy target.
 * @param {object} [overrides] Properties to override.
 * @returns {any} Target.
 */
const createTarget = (overrides = {}) => ({
  sha: 'abc123',
  branch: 'cms/posts/hello',
  kind: 'preview',
  ...overrides,
});

describe('GitLab deployment service', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(get).mockReturnValue({ backend: { name: 'gitlab' } });
  });

  describe('fetchBranchHeadSHA', () => {
    test('returns the head commit of the configured branch', async () => {
      vi.mocked(fetchAPI).mockResolvedValue({ name: 'main', commit: { id: 'abc123' } });

      await expect(fetchBranchHeadSHA()).resolves.toBe('abc123');

      expect(fetchAPI).toHaveBeenCalledWith(
        `/projects/${PROJECT_ID}/repository/branches/${encodeURIComponent('main')}`,
      );
    });

    test('sends no request before the default branch has been detected', async () => {
      Object.assign(repository, { branch: undefined });

      await expect(fetchBranchHeadSHA()).resolves.toBeUndefined();
      expect(fetchAPI).not.toHaveBeenCalled();

      Object.assign(repository, { branch: 'main' });
    });

    test('returns undefined when the response has no commit', async () => {
      vi.mocked(fetchAPI).mockResolvedValue({});

      await expect(fetchBranchHeadSHA()).resolves.toBeUndefined();
    });
  });

  describe('fetchDeployments', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-08-17T00:00:00Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    /**
     * Resolve the deployments request with the given list, and every commit statuses request with
     * the given list.
     * @param {object} args Arguments.
     * @param {any[]} [args.deployments] Deployments.
     * @param {any[]} [args.statuses] Commit statuses.
     */
    const mockAPI = ({ deployments = [], statuses = [] }) => {
      vi.mocked(fetchAPI).mockImplementation(async (path) =>
        path.includes('/deployments') ? deployments : statuses,
      );
    };

    test('sends no request without a usable target', async () => {
      await expect(fetchDeployments([])).resolves.toEqual({});
      await expect(fetchDeployments([createTarget({ sha: '' })])).resolves.toEqual({});
      expect(fetchAPI).not.toHaveBeenCalled();
    });

    test('requests the deployments within a seven-day window', async () => {
      mockAPI({});

      await fetchDeployments([createTarget()]);

      expect(fetchAPI).toHaveBeenCalledWith(
        `/projects/${PROJECT_ID}/deployments?order_by=updated_at&sort=desc&per_page=100` +
          `&updated_after=${encodeURIComponent('2026-08-10T00:00:00.000Z')}`,
      );

      expect(fetchAPI).toHaveBeenCalledWith(
        `/projects/${PROJECT_ID}/repository/commits/abc123/statuses?per_page=100`,
      );
    });

    test('reads a review app URL from a matching deployment', async () => {
      mockAPI({
        deployments: [
          {
            ref: 'cms/posts/hello',
            status: 'success',
            environment: { name: 'review/hello', external_url: 'https://review.example.com' },
          },
        ],
      });

      const result = await fetchDeployments([createTarget()]);

      expect(result.abc123).toEqual({
        state: 'ready',
        url: 'https://review.example.com',
        context: 'review/hello',
        checkedTime: expect.any(Number),
      });
    });

    test('ignores a deployment for another branch', async () => {
      mockAPI({
        deployments: [
          {
            ref: 'other-branch',
            status: 'success',
            environment: { name: 'review/other', external_url: 'https://other.example.com' },
          },
        ],
      });

      const result = await fetchDeployments([createTarget()]);

      expect(result.abc123).toEqual({ state: 'unknown', checkedTime: expect.any(Number) });
    });

    test('ignores a deployment with an unmapped status', async () => {
      mockAPI({
        deployments: [
          {
            ref: 'cms/posts/hello',
            status: 'skipped',
            environment: { name: 'review', external_url: 'https://review.example.com' },
          },
        ],
      });

      const result = await fetchDeployments([createTarget()]);

      expect(result.abc123.state).toBe('unknown');
    });

    test('tolerates a deployment without environment details', async () => {
      mockAPI({
        deployments: [{ ref: 'cms/posts/hello', status: 'running', environment: null }],
      });

      const result = await fetchDeployments([createTarget()]);

      expect(result.abc123).toEqual(
        expect.objectContaining({ state: 'pending', url: undefined, context: '' }),
      );
    });

    test('reads a deploy preview URL from a commit status', async () => {
      mockAPI({
        statuses: [
          {
            name: 'netlify/site/deploy-preview',
            status: 'success',
            target_url: 'https://preview.netlify.app',
          },
        ],
      });

      const result = await fetchDeployments([createTarget()]);

      expect(result.abc123).toEqual(
        expect.objectContaining({ state: 'ready', url: 'https://preview.netlify.app' }),
      );
    });

    test('skips a canceled deploy in favour of the one that ran', async () => {
      // @see https://github.com/decaporg/decap-cms/issues/5107
      mockAPI({
        statuses: [
          {
            name: 'netlify/site-a/deploy-preview',
            status: 'success',
            target_url: 'https://canceled.example.com',
            description: 'Deploy preview canceled.',
          },
          {
            name: 'netlify/site-b/deploy-preview',
            status: 'success',
            target_url: 'https://ready.example.com',
            description: 'Deploy preview ready!',
          },
        ],
      });

      const result = await fetchDeployments([createTarget()]);

      expect(result.abc123.url).toBe('https://ready.example.com');
    });

    test('ignores a commit status with an unmapped status', async () => {
      mockAPI({
        statuses: [{ name: 'lint', status: 'skipped', target_url: 'https://lint.example.com' }],
      });

      const result = await fetchDeployments([createTarget()]);

      expect(result.abc123.state).toBe('unknown');
    });

    test('tolerates a commit status without a name or URL', async () => {
      mockAPI({ statuses: [{ status: 'pending' }] });

      const result = await fetchDeployments([createTarget()]);

      expect(result.abc123).toEqual(
        expect.objectContaining({ state: 'pending', url: undefined, context: '' }),
      );
    });

    test('prefers the newest of two matching deployments', async () => {
      // The API returns the newest first
      mockAPI({
        deployments: [
          {
            ref: 'cms/posts/hello',
            status: 'success',
            environment: { name: 'review', external_url: 'https://new.example.com' },
          },
          {
            ref: 'cms/posts/hello',
            status: 'success',
            environment: { name: 'review', external_url: 'https://old.example.com' },
          },
        ],
      });

      const result = await fetchDeployments([createTarget()]);

      expect(result.abc123.url).toBe('https://new.example.com');
    });

    test('keeps the commit status data when the deployments request fails', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

      vi.mocked(fetchAPI).mockImplementation(async (path) => {
        if (path.includes('/deployments')) {
          throw new Error('Forbidden');
        }

        return [{ name: 'deploy', status: 'success', target_url: 'https://preview.example.com' }];
      });

      const result = await fetchDeployments([createTarget()]);

      expect(result.abc123).toEqual(
        expect.objectContaining({ state: 'ready', url: 'https://preview.example.com' }),
      );
      expect(warn).toHaveBeenCalled();
      warn.mockRestore();
    });

    test('keeps the deployment data when a commit statuses request fails', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

      vi.mocked(fetchAPI).mockImplementation(async (path) => {
        if (path.includes('/statuses')) {
          throw new Error('Not found');
        }

        return [
          {
            ref: 'cms/posts/hello',
            status: 'success',
            environment: { name: 'review', external_url: 'https://review.example.com' },
          },
        ];
      });

      const result = await fetchDeployments([createTarget()]);

      expect(result.abc123.url).toBe('https://review.example.com');
      expect(warn).toHaveBeenCalled();
      warn.mockRestore();
    });

    test('tolerates an empty response body', async () => {
      vi.mocked(fetchAPI).mockResolvedValue(/** @type {any} */ (null));

      const result = await fetchDeployments([createTarget()]);

      expect(result.abc123.state).toBe('unknown');
    });

    test('looks a shared head commit up only once, but reports it for every target', async () => {
      mockAPI({});

      const result = await fetchDeployments([
        createTarget({ branch: 'cms/posts/a' }),
        createTarget({ branch: 'cms/posts/b' }),
      ]);

      const statusCalls = vi
        .mocked(fetchAPI)
        .mock.calls.filter(([path]) => path.includes('/statuses'));

      expect(statusCalls).toHaveLength(1);
      expect(Object.keys(result)).toEqual(['abc123']);
    });
  });
});
