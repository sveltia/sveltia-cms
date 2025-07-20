import { beforeEach, describe, expect, test, vi } from 'vitest';
import { triggerDeployment } from '$lib/services/backends/git/github/deployment';
import { repository } from '$lib/services/backends/git/github/repository';
import { fetchAPI } from '$lib/services/backends/git/shared/api';

// Mock dependencies
vi.mock('$lib/services/backends/git/github/repository');
vi.mock('$lib/services/backends/git/shared/api');

describe('GitHub deployment service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(repository, {
      owner: 'test-owner',
      repo: 'test-repo',
    });
  });

  describe('triggerDeployment', () => {
    test('triggers deployment successfully', async () => {
      const mockResponse = { status: 204, ok: true };

      vi.mocked(fetchAPI).mockResolvedValue(mockResponse);

      const result = await triggerDeployment();

      expect(fetchAPI).toHaveBeenCalledWith('/repos/test-owner/test-repo/dispatches', {
        method: 'POST',
        body: { event_type: 'sveltia-cms-publish' },
        responseType: 'raw',
      });
      expect(result).toBe(mockResponse);
    });

    test('handles API errors', async () => {
      const error = new Error('API Error');

      vi.mocked(fetchAPI).mockRejectedValue(error);

      await expect(triggerDeployment()).rejects.toThrow('API Error');
    });
  });
});
