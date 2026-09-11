import { beforeEach, describe, expect, it, vi } from 'vitest';

import { backend } from '$lib/services/backends';
import { user } from '$lib/services/user/account.svelte';
import { env } from '$lib/services/user/env.svelte';

import {
  canShowMobileSignInDialog,
  getState,
  setState,
  showMobileSignInDialog,
} from './onboarding';

// Mock dependencies
const { mockIndexedDBGet, mockIndexedDBSet, mockIndexedDBConstructor } = vi.hoisted(() => {
  const get = vi.fn();
  const set = vi.fn();

  return {
    mockIndexedDBGet: get,
    mockIndexedDBSet: set,
    // eslint-disable-next-line prefer-arrow-callback, func-names
    mockIndexedDBConstructor: vi.fn(function () {
      return { get, set };
    }),
  };
});

/** @type {Record<string, any> | undefined} */
let mockOnboardingState;

vi.mock('@sveltia/utils/storage', () => ({
  IndexedDB: mockIndexedDBConstructor,
}));

vi.mock('$lib/services/backends', () => ({
  backend: { current: undefined },
}));

vi.mock('$lib/services/user/account.svelte', () => ({
  user: { account: null },
}));

vi.mock('$lib/services/user/env.svelte', () => ({
  env: { hasMouse: true, isLargeScreen: true, isLocalHost: false },
}));

/**
 * Set the conditions the mobile sign-in dialog depends on.
 * @param {object} args Arguments.
 * @param {boolean} [args.isLargeScreen] Whether the screen is large.
 * @param {boolean} [args.hasMouse] Whether the user has a mouse.
 * @param {boolean} [args.isLocalHost] Whether the app is running on localhost.
 * @param {any} [args.backend] Backend service.
 * @param {any} [args.user] User account.
 */
const setConditions = ({
  isLargeScreen = true,
  hasMouse = true,
  isLocalHost = false,
  backend: _backend = { isGit: true },
  user: _user = { token: 'test' },
}) => {
  env.isLargeScreen = isLargeScreen;
  env.hasMouse = hasMouse;
  env.isLocalHost = isLocalHost;
  /** @type {any} */ (backend).current = _backend;
  user.account = _user;
};

describe('onboarding', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOnboardingState = undefined;
    /** @type {any} */ (backend).current = { repository: { databaseName: 'test-db' } };
    mockIndexedDBGet.mockImplementation(async () => mockOnboardingState);
    mockIndexedDBSet.mockImplementation(async (_key, value) => {
      mockOnboardingState = value;
    });
  });

  describe('canShowMobileSignInDialog', () => {
    it('should be true when all conditions are met', () => {
      setConditions({});
      expect(canShowMobileSignInDialog.current).toBe(true);
    });

    it('should be false when screen is not large', () => {
      setConditions({ isLargeScreen: false });
      expect(canShowMobileSignInDialog.current).toBe(false);
    });

    it('should be false when there is no mouse', () => {
      setConditions({ hasMouse: false });
      expect(canShowMobileSignInDialog.current).toBe(false);
    });

    it('should be false on localhost', () => {
      setConditions({ isLocalHost: true });
      expect(canShowMobileSignInDialog.current).toBe(false);
    });

    it('should be false when the backend is not Git-based', () => {
      setConditions({ backend: { isGit: false } });
      expect(canShowMobileSignInDialog.current).toBe(false);
    });

    it('should be false when there is no backend', () => {
      setConditions({ backend: null });
      expect(canShowMobileSignInDialog.current).toBe(false);
    });

    it('should be false when the user has no token', () => {
      setConditions({ user: { token: null } });
      expect(canShowMobileSignInDialog.current).toBe(false);
    });

    it('should be false when there is no user', () => {
      setConditions({ user: null });
      expect(canShowMobileSignInDialog.current).toBe(false);
    });
  });

  describe('showMobileSignInDialog', () => {
    it('should be hidden by default', () => {
      expect(showMobileSignInDialog.current).toBe(false);
    });
  });

  describe('getState', () => {
    it('should return undefined when the repository has no database name', async () => {
      vi.resetModules();
      /** @type {any} */ (backend).current = { repository: {} };

      const { getState: _getState } = await import('./onboarding.js');

      await expect(_getState('dismissed')).resolves.toBeUndefined();
      expect(mockIndexedDBConstructor).not.toHaveBeenCalled();
    });

    it('should return undefined when the backend state is missing', async () => {
      vi.resetModules();
      /** @type {any} */ (backend).current = undefined;

      const { getState: _getState } = await import('./onboarding.js');

      await expect(_getState('dismissed')).resolves.toBeUndefined();
      expect(mockIndexedDBConstructor).not.toHaveBeenCalled();
    });

    it('should return undefined when no onboarding state is stored', async () => {
      vi.resetModules();
      mockIndexedDBGet.mockResolvedValue(undefined);

      const { getState: _getState } = await import('./onboarding.js');

      await expect(_getState('dismissed')).resolves.toBeUndefined();
      expect(mockIndexedDBConstructor).toHaveBeenCalledWith('test-db', 'ui-settings');
    });

    it('should return a stored onboarding state value', async () => {
      vi.resetModules();
      mockIndexedDBGet.mockResolvedValue({ dismissed: true });

      const { getState: _getState } = await import('./onboarding.js');

      await expect(_getState('dismissed')).resolves.toBe(true);
      expect(mockIndexedDBConstructor).toHaveBeenCalledWith('test-db', 'ui-settings');
      expect(mockIndexedDBSet).not.toHaveBeenCalled();
    });

    it('should return early when setState has no database available', async () => {
      vi.resetModules();
      /** @type {any} */ (backend).current = { repository: {} };

      const { setState: _setState } = await import('./onboarding.js');

      await expect(_setState('dismissed', true)).resolves.toBeUndefined();
      expect(mockIndexedDBConstructor).not.toHaveBeenCalled();
      expect(mockIndexedDBSet).not.toHaveBeenCalled();
    });

    it('should write a state value when a database is available', async () => {
      vi.resetModules();
      mockOnboardingState = { viewed: false };

      const { setState: _setState } = await import('./onboarding.js');

      await expect(_setState('dismissed', true)).resolves.toBeUndefined();
      expect(mockIndexedDBSet).toHaveBeenCalledWith('onboarding', {
        viewed: false,
        dismissed: true,
      });
    });

    it('should create a new onboarding state object when none exists yet', async () => {
      vi.resetModules();
      mockOnboardingState = undefined;

      const { setState: _setState } = await import('./onboarding.js');

      await expect(_setState('dismissed', true)).resolves.toBeUndefined();
      expect(mockIndexedDBSet).toHaveBeenCalledWith('onboarding', { dismissed: true });
    });

    it('should set and retrieve an onboarding state value', async () => {
      mockOnboardingState = { dismissed: false };

      await setState('dismissed', true);
      await expect(getState('dismissed')).resolves.toBe(true);
      expect(mockIndexedDBSet).toHaveBeenCalledWith('onboarding', { dismissed: true });
    });
  });
});
