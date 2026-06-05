// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockLocalStorage = {
  set: vi.fn(),
  delete: vi.fn(),
};

vi.mock('@sveltia/utils/storage', () => ({
  LocalStorage: mockLocalStorage,
}));

/**
 * Wait for a number of milliseconds.
 * @param {number} [ms] Milliseconds to wait.
 * @returns {Promise<void>} Resolves after the given time.
 */
const wait = (ms = 50) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

describe('user index service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetModules();
  });

  describe('user state', () => {
    it('should export user state with undefined initial value', async () => {
      const { user } = await import('./account.svelte.js');

      expect(user).toBeDefined();
      expect(user.account).toBeUndefined();
    });

    it('should save user to localStorage when user is set', async () => {
      const { user } = await import('./account.svelte.js');
      const testUser = /** @type {any} */ ({ id: '123', name: 'Test User', token: 'test-token' });

      user.account = testUser;
      await wait();

      expect(mockLocalStorage.set).toHaveBeenCalledWith('sveltia-cms.user', testUser);
    });

    it('should delete user from localStorage when user is null', async () => {
      const { user } = await import('./account.svelte.js');

      user.account = null;
      await wait();

      expect(mockLocalStorage.delete).toHaveBeenCalledWith('sveltia-cms.user');
      expect(mockLocalStorage.set).not.toHaveBeenCalled();
    });

    it('should not modify localStorage when user is undefined', async () => {
      await import('./account.svelte.js');
      await wait();

      expect(mockLocalStorage.set).not.toHaveBeenCalled();
      expect(mockLocalStorage.delete).not.toHaveBeenCalled();
    });

    it('should handle localStorage errors gracefully', async () => {
      const { user } = await import('./account.svelte.js');

      mockLocalStorage.set.mockRejectedValue(new Error('Storage quota exceeded'));
      user.account = /** @type {any} */ ({ id: '123', name: 'Test User' });
      await wait();
      // Should not throw - error is caught internally
    });

    it('should handle localStorage delete errors gracefully', async () => {
      const { user } = await import('./account.svelte.js');

      mockLocalStorage.delete.mockRejectedValue(new Error('Permission denied'));
      user.account = null;
      await wait();
      // Should not throw - error is caught internally
    });
  });
});
