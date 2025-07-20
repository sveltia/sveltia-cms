import { beforeEach, describe, expect, test, vi } from 'vitest';
import { checkStatus, STATUS_DASHBOARD_URL } from '$lib/services/backends/git/github/status';

// Mock dependencies
vi.mock('$lib/services/utils/networking', () => ({
  sendRequest: vi.fn(),
}));

describe('GitHub status service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('STATUS_DASHBOARD_URL', () => {
    test('has correct GitHub status dashboard URL', () => {
      expect(STATUS_DASHBOARD_URL).toBe('https://www.githubstatus.com/');
    });
  });

  describe('checkStatus', () => {
    test('returns "none" for normal status', async () => {
      const { sendRequest } = await import('$lib/services/utils/networking');

      vi.mocked(sendRequest).mockResolvedValue({
        status: { indicator: 'none' },
      });

      const result = await checkStatus();

      expect(sendRequest).toHaveBeenCalledWith('https://www.githubstatus.com/api/v2/status.json');
      expect(result).toBe('none');
    });

    test('returns "minor" for minor issues', async () => {
      const { sendRequest } = await import('$lib/services/utils/networking');

      vi.mocked(sendRequest).mockResolvedValue({
        status: { indicator: 'minor' },
      });

      const result = await checkStatus();

      expect(result).toBe('minor');
    });

    test('returns "major" for major issues', async () => {
      const { sendRequest } = await import('$lib/services/utils/networking');

      vi.mocked(sendRequest).mockResolvedValue({
        status: { indicator: 'major' },
      });

      const result = await checkStatus();

      expect(result).toBe('major');
    });

    test('returns "major" for critical issues', async () => {
      const { sendRequest } = await import('$lib/services/utils/networking');

      vi.mocked(sendRequest).mockResolvedValue({
        status: { indicator: 'critical' },
      });

      const result = await checkStatus();

      expect(result).toBe('major');
    });

    test('returns "unknown" on API failure', async () => {
      const { sendRequest } = await import('$lib/services/utils/networking');

      vi.mocked(sendRequest).mockRejectedValue(new Error('Network error'));

      const result = await checkStatus();

      expect(result).toBe('unknown');
    });

    test('returns "unknown" for unknown indicator', async () => {
      const { sendRequest } = await import('$lib/services/utils/networking');

      vi.mocked(sendRequest).mockResolvedValue({
        status: { indicator: 'maintenance' },
      });

      const result = await checkStatus();

      expect(result).toBe('unknown');
    });
  });
});
