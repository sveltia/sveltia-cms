import { writable } from 'svelte/store';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { getDefaultValueMap } from './defaults';

/**
 * @import { MediaField } from '$lib/types/public';
 */

// Mock the shared media library functions
vi.mock('$lib/services/integrations/media-libraries/shared', () => ({
  isMultiple: vi.fn(),
}));

// Mock the config store
vi.mock('$lib/services/config', () => ({
  cmsConfig: writable({}),
}));

/** @type {Pick<MediaField, 'widget' | 'name'>} */
const baseFieldConfig = {
  widget: 'file',
  name: 'attachment',
};

describe('Test getDefaultValueMap()', () => {
  /** @type {import('vitest').MockedFunction<any>} */
  let isMultipleMock;

  beforeEach(async () => {
    // Reset all mocks before each test
    vi.resetAllMocks();

    const { isMultiple } = await import('$lib/services/integrations/media-libraries/shared');

    isMultipleMock = /** @type {any} */ (vi.mocked(isMultiple));
  });

  test('should return empty string for single file field without default', () => {
    isMultipleMock.mockReturnValue(false);

    /** @type {MediaField} */
    const fieldConfig = {
      ...baseFieldConfig,
    };

    const keyPath = 'attachment';
    const result = getDefaultValueMap({ fieldConfig, keyPath, locale: '_default' });

    expect(result).toEqual({ attachment: '' });
    expect(isMultipleMock).toHaveBeenCalledWith(fieldConfig);
  });

  test('should return default value for single file field with string default', () => {
    isMultipleMock.mockReturnValue(false);

    /** @type {MediaField} */
    const fieldConfig = {
      ...baseFieldConfig,
      default: '/path/to/default-file.pdf',
    };

    const keyPath = 'attachment';
    const result = getDefaultValueMap({ fieldConfig, keyPath, locale: '_default' });

    expect(result).toEqual({ attachment: '/path/to/default-file.pdf' });
    expect(isMultipleMock).toHaveBeenCalledWith(fieldConfig);
  });

  test('should return empty string for single file field with empty string default', () => {
    isMultipleMock.mockReturnValue(false);

    /** @type {MediaField} */
    const fieldConfig = {
      ...baseFieldConfig,
      default: '',
    };

    const keyPath = 'attachment';
    const result = getDefaultValueMap({ fieldConfig, keyPath, locale: '_default' });

    expect(result).toEqual({ attachment: '' });
    expect(isMultipleMock).toHaveBeenCalledWith(fieldConfig);
  });

  test('should return empty string for single file field with whitespace-only default', () => {
    isMultipleMock.mockReturnValue(false);

    /** @type {MediaField} */
    const fieldConfig = {
      ...baseFieldConfig,
      default: '   ',
    };

    const keyPath = 'attachment';
    const result = getDefaultValueMap({ fieldConfig, keyPath, locale: '_default' });

    expect(result).toEqual({ attachment: '' });
    expect(isMultipleMock).toHaveBeenCalledWith(fieldConfig);
  });

  test('should return empty array for multiple file field without default', () => {
    isMultipleMock.mockReturnValue(true);

    /** @type {MediaField} */
    const fieldConfig = {
      ...baseFieldConfig,
      multiple: true,
    };

    const keyPath = 'attachments';
    const result = getDefaultValueMap({ fieldConfig, keyPath, locale: '_default' });

    expect(result).toEqual({});
    expect(isMultipleMock).toHaveBeenCalledWith(fieldConfig);
  });

  test('should return indexed values for multiple file field with array default', () => {
    isMultipleMock.mockReturnValue(true);

    /** @type {MediaField} */
    const fieldConfig = {
      ...baseFieldConfig,
      multiple: true,
      default: ['/path/to/file1.pdf', '/path/to/file2.jpg'],
    };

    const keyPath = 'attachments';
    const result = getDefaultValueMap({ fieldConfig, keyPath, locale: '_default' });

    expect(result).toEqual({
      attachments: [],
      'attachments.0': '/path/to/file1.pdf',
      'attachments.1': '/path/to/file2.jpg',
    });
    expect(isMultipleMock).toHaveBeenCalledWith(fieldConfig);
  });

  test('should return empty array for multiple file field with empty array default', () => {
    isMultipleMock.mockReturnValue(true);

    /** @type {MediaField} */
    const fieldConfig = {
      ...baseFieldConfig,
      multiple: true,
      default: [],
    };

    const keyPath = 'attachments';
    const result = getDefaultValueMap({ fieldConfig, keyPath, locale: '_default' });

    expect(result).toEqual({});
    expect(isMultipleMock).toHaveBeenCalledWith(fieldConfig);
  });

  test('should filter out empty values for multiple file field with array containing empty strings', () => {
    isMultipleMock.mockReturnValue(true);

    /** @type {MediaField} */
    const fieldConfig = {
      ...baseFieldConfig,
      multiple: true,
      default: ['/path/to/file1.pdf', '', '   ', '/path/to/file2.jpg'],
    };

    const keyPath = 'attachments';
    const result = getDefaultValueMap({ fieldConfig, keyPath, locale: '_default' });

    expect(result).toEqual({
      attachments: [],
      'attachments.0': '/path/to/file1.pdf',
      'attachments.1': '/path/to/file2.jpg',
    });
    expect(isMultipleMock).toHaveBeenCalledWith(fieldConfig);
  });

  test('should handle dynamic value for single file field', () => {
    isMultipleMock.mockReturnValue(false);

    /** @type {MediaField} */
    const fieldConfig = {
      ...baseFieldConfig,
    };

    const keyPath = 'attachment';
    const dynamicValue = '/dynamic/path/file.pdf';
    const result = getDefaultValueMap({ fieldConfig, keyPath, locale: '_default', dynamicValue });

    expect(result).toEqual({ attachment: '/dynamic/path/file.pdf' });
    expect(isMultipleMock).toHaveBeenCalledWith(fieldConfig);
  });

  test('should handle empty dynamic value for single file field', () => {
    isMultipleMock.mockReturnValue(false);

    /** @type {MediaField} */
    const fieldConfig = {
      ...baseFieldConfig,
    };

    const keyPath = 'attachment';
    const dynamicValue = '';
    const result = getDefaultValueMap({ fieldConfig, keyPath, locale: '_default', dynamicValue });

    expect(result).toEqual({ attachment: '' });
    expect(isMultipleMock).toHaveBeenCalledWith(fieldConfig);
  });

  test('should handle dynamic value for multiple file field', () => {
    isMultipleMock.mockReturnValue(true);

    /** @type {MediaField} */
    const fieldConfig = {
      ...baseFieldConfig,
      multiple: true,
    };

    const keyPath = 'attachments';
    const dynamicValue = '/path/to/file1.pdf, /path/to/file2.jpg, /path/to/file3.png';
    const result = getDefaultValueMap({ fieldConfig, keyPath, locale: '_default', dynamicValue });

    expect(result).toEqual({
      attachments: [],
      'attachments.0': '/path/to/file1.pdf',
      'attachments.1': '/path/to/file2.jpg',
      'attachments.2': '/path/to/file3.png',
    });
    expect(isMultipleMock).toHaveBeenCalledWith(fieldConfig);
  });

  test('should handle dynamic value with empty elements for multiple file field', () => {
    isMultipleMock.mockReturnValue(true);

    /** @type {MediaField} */
    const fieldConfig = {
      ...baseFieldConfig,
      multiple: true,
    };

    const keyPath = 'attachments';
    const dynamicValue = '/path/to/file1.pdf, , /path/to/file2.jpg,   , /path/to/file3.png';
    const result = getDefaultValueMap({ fieldConfig, keyPath, locale: '_default', dynamicValue });

    expect(result).toEqual({
      attachments: [],
      'attachments.0': '/path/to/file1.pdf',
      'attachments.1': '/path/to/file2.jpg',
      'attachments.2': '/path/to/file3.png',
    });
    expect(isMultipleMock).toHaveBeenCalledWith(fieldConfig);
  });

  test('should handle empty dynamic value for multiple file field', () => {
    isMultipleMock.mockReturnValue(true);

    /** @type {MediaField} */
    const fieldConfig = {
      ...baseFieldConfig,
      multiple: true,
    };

    const keyPath = 'attachments';
    const dynamicValue = '';
    const result = getDefaultValueMap({ fieldConfig, keyPath, locale: '_default', dynamicValue });

    expect(result).toEqual({});
    expect(isMultipleMock).toHaveBeenCalledWith(fieldConfig);
  });

  test('should handle single value dynamic value for multiple file field', () => {
    isMultipleMock.mockReturnValue(true);

    /** @type {MediaField} */
    const fieldConfig = {
      ...baseFieldConfig,
      multiple: true,
    };

    const keyPath = 'attachments';
    const dynamicValue = '/path/to/single-file.pdf';
    const result = getDefaultValueMap({ fieldConfig, keyPath, locale: '_default', dynamicValue });

    expect(result).toEqual({
      attachments: [],
      'attachments.0': '/path/to/single-file.pdf',
    });
    expect(isMultipleMock).toHaveBeenCalledWith(fieldConfig);
  });

  test('should prefer dynamicValue over default value for single file field', () => {
    isMultipleMock.mockReturnValue(false);

    /** @type {MediaField} */
    const fieldConfig = {
      ...baseFieldConfig,
      default: '/path/to/default-file.pdf',
    };

    const keyPath = 'attachment';
    const dynamicValue = '/path/to/dynamic-file.pdf';
    const result = getDefaultValueMap({ fieldConfig, keyPath, locale: '_default', dynamicValue });

    expect(result).toEqual({ attachment: '/path/to/dynamic-file.pdf' });
    expect(isMultipleMock).toHaveBeenCalledWith(fieldConfig);
  });

  test('should prefer dynamicValue over default value for multiple file field', () => {
    isMultipleMock.mockReturnValue(true);

    /** @type {MediaField} */
    const fieldConfig = {
      ...baseFieldConfig,
      multiple: true,
      default: ['/path/to/default1.pdf', '/path/to/default2.jpg'],
    };

    const keyPath = 'attachments';
    const dynamicValue = '/path/to/dynamic1.pdf, /path/to/dynamic2.jpg';
    const result = getDefaultValueMap({ fieldConfig, keyPath, locale: '_default', dynamicValue });

    expect(result).toEqual({
      attachments: [],
      'attachments.0': '/path/to/dynamic1.pdf',
      'attachments.1': '/path/to/dynamic2.jpg',
    });
    expect(isMultipleMock).toHaveBeenCalledWith(fieldConfig);
  });

  test('should handle non-string default value for single file field', () => {
    isMultipleMock.mockReturnValue(false);

    /** @type {MediaField} */
    const fieldConfig = {
      ...baseFieldConfig,
      // @ts-ignore Testing invalid type
      default: 123,
    };

    const keyPath = 'attachment';
    const result = getDefaultValueMap({ fieldConfig, keyPath, locale: '_default' });

    expect(result).toEqual({ attachment: '' });
    expect(isMultipleMock).toHaveBeenCalledWith(fieldConfig);
  });

  test('should handle non-array default value for multiple file field', () => {
    isMultipleMock.mockReturnValue(true);

    /** @type {MediaField} */
    const fieldConfig = {
      ...baseFieldConfig,
      multiple: true,
      // @ts-ignore Testing invalid type
      default: 'should-be-array',
    };

    const keyPath = 'attachments';
    const result = getDefaultValueMap({ fieldConfig, keyPath, locale: '_default' });

    expect(result).toEqual({});
    expect(isMultipleMock).toHaveBeenCalledWith(fieldConfig);
  });
});
