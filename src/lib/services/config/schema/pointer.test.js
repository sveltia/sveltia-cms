import { describe, expect, test } from 'vitest';

import { decodeSegment, getSegments } from '$lib/services/config/schema/pointer';

describe('Test decodeSegment()', () => {
  test('decodes the escaped slash and tilde', () => {
    expect(decodeSegment('a~1b~0c')).toBe('a/b~c');
    expect(decodeSegment('plain')).toBe('plain');
  });

  test('decodes `~01` as a literal `~1` rather than a slash', () => {
    expect(decodeSegment('~01')).toBe('~1');
  });
});

describe('Test getSegments()', () => {
  test('splits a URI fragment into decoded segments', () => {
    expect(getSegments('#/definitions/Root')).toEqual(['definitions', 'Root']);
    expect(getSegments('#/properties/a~1b/$ref')).toEqual(['properties', 'a/b', '$ref']);
  });

  test('splits a bare JSON pointer', () => {
    expect(getSegments('/collections/0/name')).toEqual(['collections', '0', 'name']);
  });

  test('returns no segments for the root', () => {
    expect(getSegments('#')).toEqual([]);
    expect(getSegments('')).toEqual([]);
  });
});
