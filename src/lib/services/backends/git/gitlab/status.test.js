import { beforeEach, describe, expect, test, vi } from 'vitest';
import { checkStatus } from '$lib/services/backends/git/gitlab/status';
import { sendRequest } from '$lib/services/utils/networking';

// Mock dependencies
vi.mock('$lib/services/utils/networking');

describe('GitLab status service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('checkStatus', () => {
    test('returns none when GitLab API is operational', async () => {
      vi.mocked(sendRequest).mockResolvedValue({
        result: {
          status_overall: {
            status_code: 100,
          },
        },
      });

      const result = await checkStatus();

      expect(sendRequest).toHaveBeenCalledWith(
        'https://status-api.hostedstatus.com/1.0/status/5b36dc6502d06804c08349f7',
      );
      expect(result).toBe('none');
    });

    test('returns minor when GitLab has minor issues (status 200)', async () => {
      vi.mocked(sendRequest).mockResolvedValue({
        result: {
          status_overall: {
            status_code: 200,
          },
        },
      });

      const result = await checkStatus();

      expect(result).toBe('minor');
    });

    test('returns minor when GitLab has minor issues (status 300)', async () => {
      vi.mocked(sendRequest).mockResolvedValue({
        result: {
          status_overall: {
            status_code: 300,
          },
        },
      });

      const result = await checkStatus();

      expect(result).toBe('minor');
    });

    test('returns minor when GitLab has minor issues (status 400)', async () => {
      vi.mocked(sendRequest).mockResolvedValue({
        result: {
          status_overall: {
            status_code: 400,
          },
        },
      });

      const result = await checkStatus();

      expect(result).toBe('minor');
    });

    test('returns major when GitLab has major issues (status 500)', async () => {
      vi.mocked(sendRequest).mockResolvedValue({
        result: {
          status_overall: {
            status_code: 500,
          },
        },
      });

      const result = await checkStatus();

      expect(result).toBe('major');
    });

    test('returns major when GitLab has major issues (status 600)', async () => {
      vi.mocked(sendRequest).mockResolvedValue({
        result: {
          status_overall: {
            status_code: 600,
          },
        },
      });

      const result = await checkStatus();

      expect(result).toBe('major');
    });

    test('returns unknown when request fails', async () => {
      vi.mocked(sendRequest).mockRejectedValue(new Error('Network error'));

      const result = await checkStatus();

      expect(result).toBe('unknown');
    });

    test('returns unknown when status code is not recognized', async () => {
      vi.mocked(sendRequest).mockResolvedValue({
        result: {
          status_overall: {
            status_code: 999,
          },
        },
      });

      const result = await checkStatus();

      expect(result).toBe('unknown');
    });

    test('returns unknown when response format is invalid', async () => {
      vi.mocked(sendRequest).mockResolvedValue({
        invalidResponse: true,
      });

      const result = await checkStatus();

      expect(result).toBe('unknown');
    });
  });
});
