// @ts-nocheck
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { warnDeprecation, warnedOnceMap, warningMessages } from './deprecations';

describe('Test warnedOnceMap', () => {
  test('should have all deprecation keys set to false initially', () => {
    expect(warnedOnceMap).toEqual({
      yaml_quote: false,
      uuid_read_only: false,
      save_all_locales: false,
      automatic_deployments: false,
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
    expect(warningMessages).toHaveProperty('yaml_quote');
    expect(warningMessages).toHaveProperty('uuid_read_only');
    expect(warningMessages).toHaveProperty('save_all_locales');
    expect(warningMessages).toHaveProperty('automatic_deployments');
  });

  test('should have string messages', () => {
    Object.values(warningMessages).forEach((message) => {
      expect(typeof message).toBe('string');
      expect(message.length).toBeGreaterThan(0);
    });
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
    expect(warnedOnceMap.yaml_quote).toBe(false);
    expect(warnedOnceMap.uuid_read_only).toBe(false);
    expect(warnedOnceMap.save_all_locales).toBe(false);
    expect(warnedOnceMap.automatic_deployments).toBe(false);
  });

  test('should handle different keys without errors', () => {
    // Even though warnings won't be displayed in tests, the function should not throw
    expect(() => warnDeprecation('yaml_quote')).not.toThrow();
    expect(() => warnDeprecation('uuid_read_only')).not.toThrow();
    expect(() => warnDeprecation('save_all_locales')).not.toThrow();
    expect(() => warnDeprecation('automatic_deployments')).not.toThrow();
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
