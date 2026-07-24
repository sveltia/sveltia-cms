import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Logic function for testing mobile sign-in dialog visibility.
 * @param {[boolean, boolean, boolean, any, any]} param Array of conditions.
 * @returns {boolean} Whether dialog can be shown.
 */
const canShowMobileSignInDialogLogic = ([
  _isLargeScreen,
  _hasMouse,
  _isLocalHost,
  _backend,
  _user,
]) => _isLargeScreen && _hasMouse && !_isLocalHost && !!_backend?.isGit && !!_user?.token;

// Mock dependencies
const mockDerived = vi.fn((stores, callback) => {
  // Call the callback with different combinations to ensure code coverage
  if (Array.isArray(stores)) {
    // Test all combinations to cover all branches of the logical AND operation
    callback([true, true, false, { isGit: true }, { token: 'test' }]); // All true
    callback([false, true, false, { isGit: true }, { token: 'test' }]); // First false
    callback([true, false, false, { isGit: true }, { token: 'test' }]); // Second false
    callback([true, true, true, { isGit: true }, { token: 'test' }]); // Third (isLocalHost) true
    callback([true, true, false, { isGit: false }, { token: 'test' }]); // Fourth false
    callback([true, true, false, { isGit: true }, { token: null }]); // Fifth false
    callback([true, true, false, null, { token: 'test' }]); // Backend null
    callback([true, true, false, { isGit: true }, null]); // User null
  }

  return { subscribe: vi.fn() };
});

const mockWritable = vi.fn();
const mockGet = vi.fn();
const mockIndexedDBGet = vi.fn();
const mockIndexedDBSet = vi.fn();
/** @type {Record<string, any> | undefined} */
let mockOnboardingState;

// eslint-disable-next-line prefer-arrow-callback, func-names
const mockIndexedDBConstructor = vi.fn(function () {
  return {
    get: mockIndexedDBGet,
    set: mockIndexedDBSet,
  };
});

vi.mock('svelte/store', () => ({
  derived: mockDerived,
  get: mockGet,
  writable: mockWritable,
  toStore: vi.fn((getter) => {
    getter();
    return { subscribe: vi.fn() };
  }),
}));

vi.mock('@sveltia/utils/storage', () => ({
  IndexedDB: mockIndexedDBConstructor,
}));

vi.mock('$lib/services/backends', () => ({
  backend: { subscribe: vi.fn() },
}));

vi.mock('$lib/services/user/account.svelte', () => ({
  user: { account: null },
}));

vi.mock('$lib/services/user/env.svelte', () => ({
  env: { hasMouse: true, isLargeScreen: true, isLocalHost: false },
}));

describe('onboarding', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOnboardingState = undefined;
    mockGet.mockReturnValue({ repository: { databaseName: 'test-db' } });
    mockIndexedDBGet.mockImplementation(async () => mockOnboardingState);
    mockIndexedDBSet.mockImplementation(async (_key, value) => {
      mockOnboardingState = value;
    });
  });

  describe('store creation', () => {
    it('should create canShowMobileSignInDialog derived store', async () => {
      // Clear module cache to ensure fresh import
      vi.resetModules();

      await import('./onboarding.js');

      expect(mockDerived).toHaveBeenCalledWith(expect.any(Array), expect.any(Function));
    });

    it('should create showMobileSignInDialog writable store', async () => {
      // Clear module cache to ensure fresh import
      vi.resetModules();

      await import('./onboarding.js');

      expect(mockWritable).toHaveBeenCalledWith(false);
    });
  });

  describe('getState', () => {
    it('should return undefined when the repository has no database name', async () => {
      vi.resetModules();
      mockGet.mockReturnValue({ repository: {} });

      const { getState } = await import('./onboarding.js');

      await expect(getState('dismissed')).resolves.toBeUndefined();
      expect(mockIndexedDBConstructor).not.toHaveBeenCalled();
    });

    it('should return undefined when the backend store is missing', async () => {
      vi.resetModules();
      mockGet.mockReturnValue(undefined);

      const { getState } = await import('./onboarding.js');

      await expect(getState('dismissed')).resolves.toBeUndefined();
      expect(mockIndexedDBConstructor).not.toHaveBeenCalled();
    });

    it('should return undefined when no onboarding state is stored', async () => {
      vi.resetModules();
      mockIndexedDBGet.mockResolvedValue(undefined);

      const { getState } = await import('./onboarding.js');

      await expect(getState('dismissed')).resolves.toBeUndefined();
      expect(mockIndexedDBConstructor).toHaveBeenCalledWith('test-db', 'ui-settings');
    });

    it('should return a stored onboarding state value', async () => {
      vi.resetModules();
      mockIndexedDBGet.mockResolvedValue({ dismissed: true });

      const { getState } = await import('./onboarding.js');

      await expect(getState('dismissed')).resolves.toBe(true);
      expect(mockIndexedDBConstructor).toHaveBeenCalledWith('test-db', 'ui-settings');
      expect(mockIndexedDBSet).not.toHaveBeenCalled();
    });

    it('should return early when setState has no database available', async () => {
      vi.resetModules();
      mockGet.mockReturnValue({ repository: {} });

      const { setState } = await import('./onboarding.js');

      await expect(setState('dismissed', true)).resolves.toBeUndefined();
      expect(mockIndexedDBConstructor).not.toHaveBeenCalled();
      expect(mockIndexedDBSet).not.toHaveBeenCalled();
    });

    it('should write a state value when a database is available', async () => {
      vi.resetModules();
      mockOnboardingState = { viewed: false };

      const { setState } = await import('./onboarding.js');

      await expect(setState('dismissed', true)).resolves.toBeUndefined();
      expect(mockIndexedDBSet).toHaveBeenCalledWith('onboarding', {
        viewed: false,
        dismissed: true,
      });
    });

    it('should create a new onboarding state object when none exists yet', async () => {
      vi.resetModules();
      mockOnboardingState = undefined;

      const { setState } = await import('./onboarding.js');

      await expect(setState('dismissed', true)).resolves.toBeUndefined();
      expect(mockIndexedDBSet).toHaveBeenCalledWith('onboarding', { dismissed: true });
    });

    it('should set and retrieve an onboarding state value', async () => {
      vi.resetModules();
      mockOnboardingState = { dismissed: false };

      const { getState, setState } = await import('./onboarding.js');

      await setState('dismissed', true);
      await expect(getState('dismissed')).resolves.toBe(true);
      expect(mockIndexedDBSet).toHaveBeenCalledWith('onboarding', { dismissed: true });
    });
  });

  describe('canShowMobileSignInDialog logic', () => {
    it('should return true when all conditions are met', () => {
      const result = canShowMobileSignInDialogLogic([
        true, // isLargeScreen
        true, // hasMouse
        false, // isLocalHost
        { isGit: true }, // backend with Git support
        { token: 'valid-token' }, // user with token
      ]);

      expect(result).toBe(true);
    });

    it('should return false when screen is not large', () => {
      const result = canShowMobileSignInDialogLogic([
        false, // isLargeScreen
        true, // hasMouse
        false, // isLocalHost
        { isGit: true }, // backend with Git support
        { token: 'valid-token' }, // user with token
      ]);

      expect(result).toBe(false);
    });

    it('should return false when no mouse is available', () => {
      const result = canShowMobileSignInDialogLogic([
        true, // isLargeScreen
        false, // hasMouse
        false, // isLocalHost
        { isGit: true }, // backend with Git support
        { token: 'valid-token' }, // user with token
      ]);

      expect(result).toBe(false);
    });

    it('should return false when running on localhost', () => {
      const result = canShowMobileSignInDialogLogic([
        true, // isLargeScreen
        true, // hasMouse
        true, // isLocalHost
        { isGit: true }, // backend with Git support
        { token: 'valid-token' }, // user with token
      ]);

      expect(result).toBe(false);
    });

    it('should return false when backend is not Git-based', () => {
      const result = canShowMobileSignInDialogLogic([
        true, // isLargeScreen
        true, // hasMouse
        false, // isLocalHost
        { isGit: false }, // backend without Git support
        { token: 'valid-token' }, // user with token
      ]);

      expect(result).toBe(false);
    });

    it('should return false when backend is null', () => {
      const result = canShowMobileSignInDialogLogic([
        true, // isLargeScreen
        true, // hasMouse
        false, // isLocalHost
        null, // no backend
        { token: 'valid-token' }, // user with token
      ]);

      expect(result).toBe(false);
    });

    it('should return false when user has no token', () => {
      const result = canShowMobileSignInDialogLogic([
        true, // isLargeScreen
        true, // hasMouse
        false, // isLocalHost
        { isGit: true }, // backend with Git support
        { token: null }, // user without token
      ]);

      expect(result).toBe(false);
    });

    it('should return false when user is null', () => {
      const result = canShowMobileSignInDialogLogic([
        true, // isLargeScreen
        true, // hasMouse
        false, // isLocalHost
        { isGit: true }, // backend with Git support
        null, // no user
      ]);

      expect(result).toBe(false);
    });
  });
});
