import { beforeEach, describe, expect, test, vi } from 'vitest';

import { createStatusChecker } from '$lib/services/backends/git/shared/status';
import { sendRequest } from '$lib/services/utils/networking';

vi.mock('$lib/services/utils/networking', () => ({
  sendRequest: vi.fn(),
}));

describe('createStatusChecker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('fetches the URL and maps the response to a level', async () => {
    vi.mocked(sendRequest).mockResolvedValue({ level: 'minor' });

    const checkStatus = createStatusChecker('https://status.example.com/', (r) => r.level);

    await expect(checkStatus()).resolves.toBe('minor');
    expect(sendRequest).toHaveBeenCalledWith('https://status.example.com/');
  });

  test('returns "unknown" when the response cannot be mapped', async () => {
    vi.mocked(sendRequest).mockResolvedValue({});

    await expect(
      createStatusChecker('https://status.example.com/', () => undefined)(),
    ).resolves.toBe('unknown');
  });

  test('returns "unknown" when the request or the mapping fails', async () => {
    vi.mocked(sendRequest).mockRejectedValue(new Error('Network error'));

    await expect(createStatusChecker('https://status.example.com/', () => 'none')()).resolves.toBe(
      'unknown',
    );
  });
});
