// @ts-nocheck
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { warnDeprecation, warnedOnceMap, warningMessages } from './deprecations';

describe('Test warnedOnceMap', () => {
  test('should have all deprecation keys set to false initially', () => {
    expect(warnedOnceMap).toEqual({
      slug_length: false,
      yaml_quote: false,
      uuid_read_only: false,
      save_all_locales: false,
      automatic_deployments: false,
      multiple_folders_i18n_root: false,
      omit_default_locale_from_filename: false,
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
    expect(warningMessages).toHaveProperty('slug_length');
    expect(warningMessages).toHaveProperty('yaml_quote');
    expect(warningMessages).toHaveProperty('uuid_read_only');
    expect(warningMessages).toHaveProperty('save_all_locales');
    expect(warningMessages).toHaveProperty('automatic_deployments');
    expect(warningMessages).toHaveProperty('multiple_folders_i18n_root');
  });

  test('should have string messages', () => {
    Object.values(warningMessages).forEach((message) => {
      expect(typeof message).toBe('string');
      expect(message.length).toBeGreaterThan(0);
    });
  });

  test('should contain useful information in slug_length message', () => {
    expect(warningMessages.slug_length).toContain('slug_length');
    expect(warningMessages.slug_length).toContain('deprecated');
    expect(warningMessages.slug_length).toContain('slug.maxlength');
  });

  test('should contain useful information in yaml_quote message', () => {
    expect(warningMessages.yaml_quote).toContain('yaml_quote');
    expect(warningMessages.yaml_quote).toContain('deprecated');
    expect(warningMessages.yaml_quote).toContain('output.yaml.quote');
  });

  test('should contain useful information in uuid_read_only message', () => {
    expect(warningMessages.uuid_read_only).toContain('read_only');
    expect(warningMessages.uuid_read_only).toContain('readonly');
    expect(warningMessages.uuid_read_only).toContain('UUID field type');
  });

  test('should contain useful information in save_all_locales message', () => {
    expect(warningMessages.save_all_locales).toContain('save_all_locales');
    expect(warningMessages.save_all_locales).toContain('initial_locales');
  });

  test('should contain useful information in automatic_deployments message', () => {
    expect(warningMessages.automatic_deployments).toContain('automatic_deployments');
    expect(warningMessages.automatic_deployments).toContain('skip_ci');
  });

  test('should contain useful information in multiple_folders_i18n_root message', () => {
    expect(warningMessages.multiple_folders_i18n_root).toContain('multiple_folders_i18n_root');
    expect(warningMessages.multiple_folders_i18n_root).toContain('deprecated');
    expect(warningMessages.multiple_folders_i18n_root).toContain('multiple_root_folders');
  });

  test('should contain useful information in omit_default_locale_from_filename message', () => {
    expect(warningMessages.omit_default_locale_from_filename).toContain(
      'omit_default_locale_from_filename',
    );
    expect(warningMessages.omit_default_locale_from_filename).toContain('deprecated');
    expect(warningMessages.omit_default_locale_from_filename).toContain(
      'omit_default_locale_from_file_path',
    );
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
    warnDeprecation('yaml_quote');

    // In VITEST environment, warnDeprecation should return early
    expect(consoleWarnSpy).not.toHaveBeenCalled();
  });

  test('should reset warnedOnceMap between tests', () => {
    // This test verifies that beforeEach properly resets the map
    expect(warnedOnceMap.slug_length).toBe(false);
    expect(warnedOnceMap.yaml_quote).toBe(false);
    expect(warnedOnceMap.uuid_read_only).toBe(false);
    expect(warnedOnceMap.save_all_locales).toBe(false);
    expect(warnedOnceMap.automatic_deployments).toBe(false);
    expect(warnedOnceMap.multiple_folders_i18n_root).toBe(false);
  });

  test('should handle different keys without errors', () => {
    // Even though warnings won't be displayed in tests, the function should not throw
    expect(() => warnDeprecation('slug_length')).not.toThrow();
    expect(() => warnDeprecation('yaml_quote')).not.toThrow();
    expect(() => warnDeprecation('uuid_read_only')).not.toThrow();
    expect(() => warnDeprecation('save_all_locales')).not.toThrow();
    expect(() => warnDeprecation('automatic_deployments')).not.toThrow();
    expect(() => warnDeprecation('multiple_folders_i18n_root')).not.toThrow();
  });

  test('should handle custom message parameter without errors', () => {
    const customMessage = 'This is a custom deprecation warning';

    expect(() => warnDeprecation('save_all_locales', customMessage)).not.toThrow();
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
    warnDeprecation('yaml_quote');
    expect(consoleWarnSpy).toHaveBeenCalledOnce();
    expect(consoleWarnSpy).toHaveBeenCalledWith(warningMessages.yaml_quote);
  });

  test('should call console.warn with custom message when provided', () => {
    const customMessage = 'Custom deprecation message';

    warnDeprecation('slug_length', customMessage);
    expect(consoleWarnSpy).toHaveBeenCalledOnce();
    expect(consoleWarnSpy).toHaveBeenCalledWith(customMessage);
  });

  test('should only warn once per key', () => {
    warnDeprecation('slug_length');
    warnDeprecation('slug_length');
    warnDeprecation('slug_length');
    expect(consoleWarnSpy).toHaveBeenCalledOnce();
    expect(warnedOnceMap.slug_length).toBe(true);
  });

  test('should warn independently for different keys', () => {
    warnDeprecation('slug_length');
    warnDeprecation('yaml_quote');
    expect(consoleWarnSpy).toHaveBeenCalledTimes(2);
  });
});
