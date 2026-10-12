import { beforeEach, describe, expect, test, vi } from 'vitest';

import {
  _resetApiSettings,
  fetchAllPages,
  fetchPages,
  getApiSettings,
} from '$lib/services/backends/git/gitea/api';
import { fetchAPI } from '$lib/services/backends/git/shared/api';

vi.mock('$lib/services/backends/git/shared/api');

const REPO_PATH = '/repos/owner/repo';

describe('Gitea API helpers', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    _resetApiSettings();
  });

  describe('getApiSettings', () => {
    test('shares one request between concurrent callers and remembers the result', async () => {
      vi.mocked(fetchAPI).mockResolvedValue({ max_response_items: 20 });

      const [first, second] = await Promise.all([getApiSettings(), getApiSettings()]);

      expect(first).toEqual({ max_response_items: 20 });
      expect(second).toBe(first);
      await expect(getApiSettings()).resolves.toBe(first);
      expect(fetchAPI).toHaveBeenCalledTimes(1);
      expect(fetchAPI).toHaveBeenCalledWith('/settings/api');
    });

    test('asks again after a failed request', async () => {
      vi.mocked(fetchAPI)
        .mockRejectedValueOnce(new Error('boom'))
        .mockResolvedValueOnce({ max_response_items: 20 });

      await expect(getApiSettings()).rejects.toThrow('boom');
      await expect(getApiSettings()).resolves.toEqual({ max_response_items: 20 });
      expect(fetchAPI).toHaveBeenCalledTimes(2);
    });
  });

  describe('fetchAllPages', () => {
    test('reads every page at the size the instance applies', async () => {
      vi.mocked(fetchAPI)
        .mockResolvedValueOnce({ max_response_items: 2 })
        .mockResolvedValueOnce([1, 2])
        .mockResolvedValueOnce([3, 4])
        .mockResolvedValueOnce([5]);

      await expect(fetchAllPages(`${REPO_PATH}/branches`)).resolves.toEqual([1, 2, 3, 4, 5]);

      expect(fetchAPI).toHaveBeenNthCalledWith(1, '/settings/api');
      expect(fetchAPI).toHaveBeenNthCalledWith(2, `${REPO_PATH}/branches?page=1&limit=2`);
      expect(fetchAPI).toHaveBeenNthCalledWith(4, `${REPO_PATH}/branches?page=3&limit=2`);
    });

    test('asks for the page size once, and falls back to the default', async () => {
      vi.mocked(fetchAPI).mockResolvedValueOnce({}).mockResolvedValue([]);

      await fetchAllPages(`${REPO_PATH}/pulls?state=open`);
      await fetchAllPages(`${REPO_PATH}/pulls?state=open`);

      expect(fetchAPI).toHaveBeenCalledTimes(3);
      // The parameters are appended to the ones the path already has
      expect(fetchAPI).toHaveBeenLastCalledWith(`${REPO_PATH}/pulls?state=open&page=1&limit=50`);
    });

    test('stops after a bounded number of pages', async () => {
      vi.mocked(fetchAPI).mockResolvedValueOnce({ max_response_items: 1 }).mockResolvedValue(['x']);

      const result = await fetchAllPages(`${REPO_PATH}/branches`);

      expect(result).toHaveLength(10);
      expect(fetchAPI).toHaveBeenCalledTimes(11);
    });
  });

  describe('fetchPages', () => {
    test('says whether the list was read to the end', async () => {
      vi.mocked(fetchAPI)
        .mockResolvedValueOnce({ max_response_items: 2 })
        .mockResolvedValueOnce([1, 2])
        .mockResolvedValueOnce([3]);

      await expect(fetchPages(`${REPO_PATH}/pulls/1/files`)).resolves.toEqual({
        items: [1, 2, 3],
        complete: true,
      });
    });

    test('says so when the page cap cut the list short', async () => {
      vi.mocked(fetchAPI).mockResolvedValueOnce({ max_response_items: 1 }).mockResolvedValue(['x']);

      await expect(fetchPages(`${REPO_PATH}/pulls/1/files`)).resolves.toMatchObject({
        complete: false,
      });
    });
  });
});
