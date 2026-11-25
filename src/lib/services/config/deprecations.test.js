// @ts-nocheck
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { warnDeprecation, warnedOnceMap, warningMessages } from './deprecations';

describe('Test warnedOnceMap', () => {
  test('should have all deprecation keys set to false initially', () => {
    expect(warnedOnceMap).toEqual({
      logo_url: false,
      flat_metadata_keys: false,
    });
  });

  test('should be an object with boolean values', () => {
    expect(typeof warnedOnceMap).toBe('object');
    Object.values(warnedOnceMap).forEach((value) => {
      expect(typeof value).toBe('boolean');
    });
  });
});

describe('Test warningMessages', () => {
  test('should contain all deprecation warning messages', () => {
    expect(Object.keys(warningMessages)).toEqual(['logo_url', 'flat_metadata_keys']);
  });

  test('should have string messages', () => {
    Object.values(warningMessages).forEach((message) => {
      expect(typeof message).toBe('string');
      expect(message.length).toBeGreaterThan(0);
    });
  });

  test('should contain useful information in flat_metadata_keys message', () => {
    expect(warningMessages.flat_metadata_keys).toContain('fieldsMetaData');
    expect(warningMessages.flat_metadata_keys).toContain('deprecated');
    expect(warningMessages.flat_metadata_keys).toContain('books.0.author');
  });

  test('should contain useful information in logo_url message', () => {
    expect(warningMessages.logo_url).toContain('logo_url');
    expect(warningMessages.logo_url).toContain('deprecated');
    expect(warningMessages.logo_url).toContain('logo.src');
    // It isn’t scheduled for removal in 5.0
    expect(warningMessages.logo_url).toContain('a future version');
  });
});

describe('Test warnDeprecation()', () => {
  let consoleWarnSpy;

  beforeEach(() => {
    // Reset the warned state before each test
    Object.keys(warnedOnceMap).forEach((key) => {
      warnedOnceMap[key] = false;
    });

    // Spy on console.warn
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
  });

  test('should not warn during VITEST environment', () => {
    warnDeprecation('flat_metadata_keys');

    // In VITEST environment, warnDeprecation should return early
    expect(consoleWarnSpy).not.toHaveBeenCalled();
  });

  test('should reset warnedOnceMap between tests', () => {
    // This test verifies that beforeEach properly resets the map
    expect(warnedOnceMap.logo_url).toBe(false);
    expect(warnedOnceMap.flat_metadata_keys).toBe(false);
  });

  test('should handle different keys without errors', () => {
    // Even though warnings won't be displayed in tests, the function should not throw
    expect(() => warnDeprecation('logo_url')).not.toThrow();
    expect(() => warnDeprecation('flat_metadata_keys')).not.toThrow();
  });

  test('should handle custom message parameter without errors', () => {
    const customMessage = 'This is a custom deprecation warning';

    expect(() => warnDeprecation('logo_url', customMessage)).not.toThrow();
  });

  test('should work with valid deprecation keys', () => {
    Object.keys(warningMessages).forEach((key) => {
      expect(() => warnDeprecation(key)).not.toThrow();
    });
  });
});

describe('Test warnDeprecation() outside VITEST environment', () => {
  let consoleWarnSpy;

  beforeEach(() => {
    // Reset the warned state before each test
    Object.keys(warnedOnceMap).forEach((key) => {
      warnedOnceMap[key] = false;
    });

    // Simulate non-test environment by stubbing VITEST env var to undefined
    vi.stubEnv('VITEST', undefined);
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    consoleWarnSpy.mockRestore();
  });

  test('should call console.warn with default message on first call', () => {
    warnDeprecation('flat_metadata_keys');
    expect(consoleWarnSpy).toHaveBeenCalledOnce();
    expect(consoleWarnSpy).toHaveBeenCalledWith(warningMessages.flat_metadata_keys);
  });

  test('should call console.warn with custom message when provided', () => {
    const customMessage = 'Custom deprecation message';

    warnDeprecation('logo_url', customMessage);
    expect(consoleWarnSpy).toHaveBeenCalledOnce();
    expect(consoleWarnSpy).toHaveBeenCalledWith(customMessage);
  });

  test('should only warn once per key', () => {
    warnDeprecation('logo_url');
    warnDeprecation('logo_url');
    warnDeprecation('logo_url');
    expect(consoleWarnSpy).toHaveBeenCalledOnce();
    expect(warnedOnceMap.logo_url).toBe(true);
  });

  test('should warn independently for different keys', () => {
    warnDeprecation('logo_url');
    warnDeprecation('flat_metadata_keys');
    expect(consoleWarnSpy).toHaveBeenCalledTimes(2);
  });
});
