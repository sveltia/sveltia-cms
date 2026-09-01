// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';

import { parseXml } from '$lib/services/utils/xml';

describe('parseXml', () => {
  it('should parse simple XML to object', () => {
    const xml = '<Root><Name>test</Name><Size>123</Size></Root>';
    const result = parseXml(xml);

    expect(result).toEqual({
      Name: 'test',
      Size: '123',
    });
  });

  it('should handle array elements', () => {
    const xml = '<Root><Item>first</Item><Item>second</Item><Item>third</Item></Root>';
    const result = parseXml(xml);

    expect(result).toEqual({
      Item: ['first', 'second', 'third'],
    });
  });

  it('should handle nested elements', () => {
    const xml = '<Root><Parent><Child>value</Child></Parent></Root>';
    const result = parseXml(xml);

    expect(result).toEqual({
      Parent: {
        Child: 'value',
      },
    });
  });

  it('should handle hyphenated tag names', () => {
    const xml = '<Root><Content-Length>1024</Content-Length></Root>';
    const result = parseXml(xml);

    expect(result).toEqual({
      'Content-Length': '1024',
    });
  });

  it('should return an empty string for an empty element', () => {
    expect(parseXml('<Root />')).toBe('');
    expect(parseXml('<Root><Child /></Root>')).toEqual({ Child: '' });
  });
});
