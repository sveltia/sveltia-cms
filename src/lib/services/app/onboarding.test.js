import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Logic function for testing mobile sign-in dialog visibility.
 * @param {[boolean, boolean, any, any]} param Array of conditions.
 * @returns {boolean} Whether dialog can be shown.
 */
const canShowMobileSignInDialogLogic = ([_isLargeScreen, _hasMouse, _backend, _user]) =>
  _isLargeScreen && _hasMouse && !!_backend?.isGit && !!_user?.token;

// Mock dependencies
const mockDerived = vi.fn();
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
        { isGit: true }, // backend with Git support
        { token: 'valid-token' }, // user with token
      ]);

      expect(result).toBe(true);
    });

    it('should return false when screen is not large', () => {
      const result = canShowMobileSignInDialogLogic([
        false, // isLargeScreen
        true, // hasMouse
        { isGit: true }, // backend with Git support
        { token: 'valid-token' }, // user with token
      ]);

      expect(result).toBe(false);
    });

    it('should return false when no mouse is available', () => {
      const result = canShowMobileSignInDialogLogic([
        true, // isLargeScreen
        false, // hasMouse
        { isGit: true }, // backend with Git support
        { token: 'valid-token' }, // user with token
      ]);

      expect(result).toBe(false);
    });

    it('should return false when backend is not Git-based', () => {
      const result = canShowMobileSignInDialogLogic([
        true, // isLargeScreen
        true, // hasMouse
        { isGit: false }, // backend without Git support
        { token: 'valid-token' }, // user with token
      ]);

      expect(result).toBe(false);
    });

    it('should return false when backend is null', () => {
      const result = canShowMobileSignInDialogLogic([
        true, // isLargeScreen
        true, // hasMouse
        null, // no backend
        { token: 'valid-token' }, // user with token
      ]);

      expect(result).toBe(false);
    });

    it('should return false when user has no token', () => {
      const result = canShowMobileSignInDialogLogic([
        true, // isLargeScreen
        true, // hasMouse
        { isGit: true }, // backend with Git support
        { token: null }, // user without token
      ]);

      expect(result).toBe(false);
    });

    it('should return false when user is null', () => {
      const result = canShowMobileSignInDialogLogic([
        true, // isLargeScreen
        true, // hasMouse
        { isGit: true }, // backend with Git support
        null, // no user
      ]);

      expect(result).toBe(false);
    });
  });
});
