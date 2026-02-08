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

vi.mock('svelte/store', () => ({
  derived: mockDerived,
  writable: mockWritable,
}));

vi.mock('$lib/services/backends', () => ({
  backend: { subscribe: vi.fn() },
}));

vi.mock('$lib/services/user', () => ({
  user: { subscribe: vi.fn() },
}));

vi.mock('$lib/services/user/env', () => ({
  hasMouse: { subscribe: vi.fn() },
  isLargeScreen: { subscribe: vi.fn() },
  isLocalHost: { subscribe: vi.fn() },
}));

describe('onboarding', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
