import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock dependencies
const mockLocalStorage = {
  set: vi.fn(),
  delete: vi.fn(),
};

vi.mock('@sveltia/utils/storage', () => ({
  LocalStorage: mockLocalStorage,
}));

const mockWritable = vi.fn();

vi.mock('svelte/store', () => ({
  writable: mockWritable,
}));

describe('user index service', () => {
  /** @type {any} */
  let userModule;
  /** @type {any} */
  let mockUserStore;
  /** @type {any} */
  let subscribeFn;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Set up mock user store
    mockUserStore = {
      set: vi.fn(),
      subscribe: vi.fn(),
      update: vi.fn(),
    };

    mockWritable.mockReturnValue(mockUserStore);

    // Import the module after mocks are set up
    userModule = await import('./index.js');

    // Get the subscribe function that was passed to the store
    const subscribeCalls = mockUserStore.subscribe.mock.calls;

    if (subscribeCalls.length > 0 && subscribeCalls[0].length > 0) {
      const [[firstArg]] = subscribeCalls;

      subscribeFn = firstArg;
    }
  });

  describe('user store', () => {
    it('should create a writable store', () => {
      expect(mockWritable).toHaveBeenCalledWith();
      expect(userModule.user).toBe(mockUserStore);
    });

    it('should save user to localStorage when user is set', async () => {
      const user = { id: '123', name: 'Test User', token: 'test-token' };

      await subscribeFn(user);

      expect(mockLocalStorage.set).toHaveBeenCalledWith('sveltia-cms.user', user);
    });

    it('should delete user from localStorage when user is null', async () => {
      await subscribeFn(null);

      expect(mockLocalStorage.delete).toHaveBeenCalledWith('sveltia-cms.user');
      expect(mockLocalStorage.set).not.toHaveBeenCalled();
    });

    it('should not modify localStorage when user is undefined', async () => {
      await subscribeFn(undefined);

      expect(mockLocalStorage.set).not.toHaveBeenCalled();
      expect(mockLocalStorage.delete).not.toHaveBeenCalled();
    });

    it('should handle localStorage errors gracefully', async () => {
      const user = { id: '123', name: 'Test User' };

      mockLocalStorage.set.mockRejectedValue(new Error('Storage quota exceeded'));

      // Should not throw
      expect(() => subscribeFn(user)).not.toThrow();
    });

    it('should handle localStorage delete errors gracefully', async () => {
      mockLocalStorage.delete.mockRejectedValue(new Error('Permission denied'));

      // Should not throw
      expect(() => subscribeFn(null)).not.toThrow();
    });
  });
});
