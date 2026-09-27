import { beforeEach, describe, expect, it, vi } from 'vitest';

import { prefs } from '$lib/services/user/prefs.svelte';

import { saveApiKey, setApiKey } from './api-keys';

vi.mock('$lib/services/user/prefs.svelte', () => ({ prefs: {} }));

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
});
