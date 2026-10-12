import { beforeEach, describe, expect, test, vi } from 'vitest';

import { fetchBranchHeadSHA, fetchDeployments } from '$lib/services/backends/git/gitea/deployment';
import { repository } from '$lib/services/backends/git/gitea/repository';
import { fetchAPI } from '$lib/services/backends/git/shared/api';
import { cmsConfig } from '$lib/services/config';
import { createMockDeployTarget } from '$lib/test/factories';

vi.mock('$lib/services/backends/git/gitea/repository', () => ({
  repository: {
    owner: 'org',
    repo: 'site',
    branch: 'main',
    repoURL: 'https://git.example.org/org/site',
  },
}));
vi.mock('$lib/services/backends/git/shared/api');
vi.mock('$lib/services/config', () => ({ cmsConfig: { current: undefined } }));

/**
 * Create a commit status as Gitea/Forgejo returns it.
 * @param {object} [overrides] Properties to override.
 * @returns {Record<string, any>} Commit status.
 */
const createStatus = (overrides = {}) => ({
  context: 'pages/preview',
  status: 'success',
  target_url: 'https://org.pr.example.org/site@1/',
  description: 'Preview',
  updated_at: '2026-10-11T00:00:00Z',
  ...overrides,
});

/**
 * Create a commit status posted by Gitea/Forgejo Actions for a workflow job, which links to the job
 * log on the instance.
 * @param {object} [overrides] Properties to override.
 * @returns {Record<string, any>} Commit status.
 */
const createJobStatus = (overrides = {}) =>
  createStatus({
    context: 'Preview / preview (pull_request)',
    target_url: 'https://git.example.org/org/site/actions/runs/1/jobs/0',
    description: 'Successful in 42s',
    ...overrides,
  });

describe('Gitea deployment service', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    cmsConfig.current = /** @type {any} */ ({ backend: { name: 'gitea' } });
  });

  describe('fetchBranchHeadSHA', () => {
    test('returns the head commit of the configured branch', async () => {
      vi.mocked(fetchAPI).mockResolvedValue({ name: 'main', commit: { id: 'abc123' } });

      await expect(fetchBranchHeadSHA()).resolves.toBe('abc123');
      expect(fetchAPI).toHaveBeenCalledWith('/repos/org/site/branches/main');
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
    /**
     * Resolve every combined status request with the given statuses.
     * @param {any[]} statuses Commit statuses.
     */
    const mockStatuses = (statuses) => {
      vi.mocked(fetchAPI).mockResolvedValue({ state: 'success', statuses });
    };

    test('sends no request without a usable target', async () => {
      await expect(fetchDeployments([])).resolves.toEqual({});
      await expect(fetchDeployments([createMockDeployTarget({ sha: '' })])).resolves.toEqual({});
      expect(fetchAPI).not.toHaveBeenCalled();
    });

    test('requests the combined status, which only has the latest status of each context', async () => {
      mockStatuses([]);

      await fetchDeployments([createMockDeployTarget()]);

      expect(fetchAPI).toHaveBeenCalledWith('/repos/org/site/commits/abc123/status?limit=50');
    });

    test('reads a preview URL from a commit status', async () => {
      mockStatuses([createStatus()]);

      const result = await fetchDeployments([createMockDeployTarget()]);

      expect(result.abc123).toEqual({
        state: 'ready',
        url: 'https://org.pr.example.org/site@1',
        context: 'pages/preview',
        checkedTime: expect.any(Number),
      });
    });

    test('prefers the preview status to the Actions job that posted it', async () => {
      // The job finishes after posting the preview status, so it’s the newer of the two
      mockStatuses([createJobStatus({ updated_at: '2026-10-11T00:01:00Z' }), createStatus()]);

      const result = await fetchDeployments([createMockDeployTarget()]);

      expect(result.abc123).toEqual(
        expect.objectContaining({
          state: 'ready',
          url: 'https://org.pr.example.org/site@1',
          context: 'pages/preview',
        }),
      );
    });

    test('reports the Actions job as pending until the preview status is posted', async () => {
      mockStatuses([createJobStatus({ status: 'pending', description: 'In progress' })]);

      const result = await fetchDeployments([createMockDeployTarget()]);

      expect(result.abc123).toEqual(
        expect.objectContaining({
          state: 'pending',
          url: undefined,
          context: 'Preview / preview (pull_request)',
        }),
      );
    });

    test('never takes a job log on the instance for the site', async () => {
      mockStatuses([createJobStatus()]);

      const result = await fetchDeployments([createMockDeployTarget()]);

      expect(result.abc123).toEqual(expect.objectContaining({ state: 'ready', url: undefined }));
    });

    test('narrows the statuses to `preview_context`', async () => {
      cmsConfig.current = /** @type {any} */ ({
        backend: { name: 'gitea', preview_context: 'pages/preview' },
      });

      mockStatuses([createJobStatus({ status: 'pending' })]);

      const result = await fetchDeployments([createMockDeployTarget()]);

      expect(result.abc123).toEqual({ state: 'unknown', checkedTime: expect.any(Number) });
    });

    test.each([
      ['success', 'ready'],
      ['warning', 'ready'],
      ['pending', 'pending'],
      ['failure', 'error'],
      ['error', 'error'],
    ])('maps the `%s` status to `%s`', async (status, state) => {
      mockStatuses([createStatus({ status })]);

      const result = await fetchDeployments([createMockDeployTarget()]);

      expect(result.abc123.state).toBe(state);
    });

    test('ignores a skipped job and an unknown status', async () => {
      mockStatuses([
        createJobStatus({ status: 'skipped', description: 'Has been skipped' }),
        createStatus({ status: 'whatever' }),
      ]);

      const result = await fetchDeployments([createMockDeployTarget()]);

      expect(result.abc123).toEqual({ state: 'unknown', checkedTime: expect.any(Number) });
    });

    test.each([['Canceled after 3s'], ['Has been cancelled']])(
      'ignores a job canceled with Gitea’s or Forgejo’s message: %s',
      async (description) => {
        mockStatuses([createJobStatus({ status: 'failure', description })]);

        const result = await fetchDeployments([createMockDeployTarget()]);

        expect(result.abc123).toEqual({ state: 'unknown', checkedTime: expect.any(Number) });
      },
    );

    test('lets the latest of two equally good statuses win, whatever order they come in', async () => {
      mockStatuses([
        createStatus({
          context: 'deploy/b',
          target_url: 'https://b.example.org',
          updated_at: '2026-10-11T00:02:00Z',
        }),
        createStatus({
          context: 'deploy/a',
          target_url: 'https://a.example.org',
          updated_at: '2026-10-11T00:01:00Z',
        }),
      ]);

      const result = await fetchDeployments([createMockDeployTarget()]);

      expect(result.abc123).toEqual(
        expect.objectContaining({ context: 'deploy/b', url: 'https://b.example.org' }),
      );
    });

    test('orders the statuses by time across a change of UTC offset', async () => {
      // Daylight saving time ends between the two, so the newer one has the earlier wall clock time
      mockStatuses([
        createStatus({
          context: 'deploy/b',
          target_url: 'https://b.example.org',
          updated_at: '2026-10-25T02:10:00+01:00',
        }),
        createStatus({
          context: 'deploy/a',
          target_url: 'https://a.example.org',
          updated_at: '2026-10-25T02:30:00+02:00',
        }),
      ]);

      const result = await fetchDeployments([createMockDeployTarget()]);

      expect(result.abc123).toEqual(expect.objectContaining({ context: 'deploy/b' }));
    });

    test('tolerates a status with empty fields and a response without statuses', async () => {
      vi.mocked(fetchAPI).mockImplementation(async (path) =>
        path.includes('abc123')
          ? { statuses: [{ status: 'pending', target_url: '', description: '' }] }
          : /** @type {any} */ (undefined),
      );

      const result = await fetchDeployments([
        createMockDeployTarget(),
        createMockDeployTarget({ sha: 'def456', branch: 'main', kind: 'production' }),
      ]);

      expect(result).toEqual({
        abc123: { state: 'pending', url: undefined, context: '', checkedTime: expect.any(Number) },
        def456: { state: 'unknown', checkedTime: expect.any(Number) },
      });
    });

    test('keeps the other commits when one lookup fails', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

      vi.mocked(fetchAPI).mockImplementation(async (path) => {
        if (path.includes('abc123')) {
          throw new Error('Not Found');
        }

        return { statuses: [createStatus()] };
      });

      const result = await fetchDeployments([
        createMockDeployTarget(),
        createMockDeployTarget({ sha: 'def456', branch: 'main', kind: 'production' }),
      ]);

      expect(result.abc123).toEqual({ state: 'unknown', checkedTime: expect.any(Number) });
      expect(result.def456).toEqual(expect.objectContaining({ state: 'ready' }));
      expect(warn).toHaveBeenCalledWith('Failed to fetch the deployment info.', expect.any(Error));

      warn.mockRestore();
    });
  });
});
