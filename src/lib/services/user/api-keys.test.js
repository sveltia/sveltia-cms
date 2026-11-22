import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getAdditions } from '$lib/services/app/additions';
import { prefs } from '$lib/services/user/prefs.svelte';

import {
  getApiKey,
  getDeployHook,
  isInvalidApiKey,
  isSharedApiKey,
  isSharedDeployHook,
  saveApiKey,
  setApiKey,
} from './api-keys';

vi.mock('$lib/services/user/prefs.svelte', () => ({ prefs: {} }));

const { sharedCredentials } = vi.hoisted(() => ({
  sharedCredentials: /** @type {any} */ ({ apiKeys: {}, deployHook: null }),
}));

vi.mock('$lib/services/app/additions', () => ({
  getAdditions: vi.fn(() => ({ sharedCredentials })),
}));

describe('user/api-keys', () => {
  beforeEach(() => {
    delete prefs.apiKeys;
  });

  describe('setApiKey', () => {
    it('should create the key map if needed', () => {
      setApiKey('google', 'abc');

      expect(prefs.apiKeys).toEqual({ google: 'abc' });
    });

    it('should keep the other keys', () => {
      prefs.apiKeys = { deepl: 'xyz', google: 'old' };

      setApiKey('google', '');

      expect(prefs.apiKeys).toEqual({ deepl: 'xyz', google: '' });
    });
  });

  describe('saveApiKey', () => {
    it('should save a trimmed key that matches the pattern', () => {
      expect(saveApiKey('google', '  abc123  ', /^[a-z0-9]+$/)).toBe('abc123');
      expect(prefs.apiKeys).toEqual({ google: 'abc123' });
    });

    it('should not save a key that doesn’t match the pattern', () => {
      prefs.apiKeys = { google: 'old' };

      expect(saveApiKey('google', 'ABC!', /^[a-z0-9]+$/)).toBeUndefined();
      expect(prefs.apiKeys).toEqual({ google: 'old' });
    });

    it('should not save a key without a pattern', () => {
      expect(saveApiKey('google', 'abc', undefined)).toBeUndefined();
      expect(prefs.apiKeys).toBeUndefined();
    });
  });

  describe('shared credentials', () => {
    beforeEach(() => {
      delete prefs.deployHookURL;
      delete prefs.deployHookAuthHeader;
      Object.assign(sharedCredentials, {
        apiKeys: { deepl: 'shared' },
        deployHook: { url: 'https://example.com/shared', authHeader: 'Bearer shared' },
      });
    });

    it('should use the user’s own API key over the shared one', () => {
      expect(getApiKey('deepl')).toBe('shared');
      expect(isSharedApiKey('deepl')).toBe(true);
      expect(getApiKey('google')).toBe('');
      expect(isSharedApiKey('google')).toBe(false);

      prefs.apiKeys = { deepl: 'mine', google: '' };
      expect(getApiKey('deepl')).toBe('mine');
      expect(isSharedApiKey('deepl')).toBe(false);
    });

    it('should use the user’s own deploy hook over the shared one, never mixing the two', () => {
      expect(getDeployHook()).toEqual({
        url: 'https://example.com/shared',
        authHeader: 'Bearer shared',
      });
      expect(isSharedDeployHook()).toBe(true);

      prefs.deployHookURL = 'https://example.com/mine';
      expect(getDeployHook()).toEqual({ url: 'https://example.com/mine', authHeader: '' });
      expect(isSharedDeployHook()).toBe(false);

      prefs.deployHookAuthHeader = 'Bearer mine';
      expect(getDeployHook()?.authHeader).toBe('Bearer mine');

      delete prefs.deployHookURL;
      sharedCredentials.deployHook = null;
      expect(getDeployHook()).toBeUndefined();
      expect(isSharedDeployHook()).toBe(false);
    });

    it('should share nothing without Sveltia CMS Additions', () => {
      vi.mocked(getAdditions).mockReturnValue(undefined);

      try {
        expect(getApiKey('deepl')).toBe('');
        expect(getDeployHook()).toBeUndefined();
      } finally {
        vi.mocked(getAdditions).mockReturnValue(/** @type {any} */ ({ sharedCredentials }));
      }
    });
  });

  describe('isInvalidApiKey', () => {
    it('flags a key that doesn’t match its service’s format, but not an empty or unchecked one', () => {
      expect(isInvalidApiKey('abc', /^sk-/)).toBe(true);
      expect(isInvalidApiKey('sk-abc', /^sk-/)).toBe(false);
      expect(isInvalidApiKey('', /^sk-/)).toBe(false);
      expect(isInvalidApiKey('abc', undefined)).toBe(false);
    });
  });
});
