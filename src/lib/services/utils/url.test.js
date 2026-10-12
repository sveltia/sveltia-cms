import { describe, expect, test } from 'vitest';

import {
  decodeURIComponentSafely,
  decodeURISafely,
  encodePathSegments,
  encodeRFC3986,
  encodeURLSafely,
  trimTrailingSlashes,
} from './url';

describe('Test decodeURISafely()', () => {
  test('decodes a valid URI like decodeURI()', () => {
    expect(decodeURISafely('/images/my%20photo.png')).toBe('/images/my photo.png');
    // Reserved characters are kept encoded
    expect(decodeURISafely('/images/a%3Fb%23c.png')).toBe('/images/a%3Fb%23c.png');
  });

  test('leaves a malformed escape sequence as is, decoding the valid ones only', () => {
    expect(decodeURISafely('/images/50%off.jpg')).toBe('/images/50%off.jpg');
    expect(decodeURISafely('/images/50%off%20sale%E9%3F.jpg')).toBe(
      '/images/50%off sale%E9%3F.jpg',
    );
  });
});

describe('Test decodeURIComponentSafely()', () => {
  test('decodes a valid URI component like decodeURIComponent()', () => {
    expect(decodeURIComponentSafely('a%3Fb%23c%20d.png')).toBe('a?b#c d.png');
  });

  test('leaves a malformed escape sequence as is, decoding the valid ones only', () => {
    expect(decodeURIComponentSafely('50%off.jpg')).toBe('50%off.jpg');
    expect(decodeURIComponentSafely('50%off%20sale%E9%3F.jpg')).toBe('50%off sale%E9%3F.jpg');
  });
});

describe('Test encodeURLSafely()', () => {
  test('encodes what needs encoding, keeping the escape sequences already there', () => {
    expect(encodeURLSafely('https://example.com/café?q=a b')).toBe(
      'https://example.com/caf%C3%A9?q=a%20b',
    );
    expect(encodeURLSafely('https://example.com/caf%C3%A9')).toBe('https://example.com/caf%C3%A9');
    expect(encodeURLSafely('mailto:alice@example.com')).toBe('mailto:alice@example.com');
    expect(encodeURLSafely('mailto:jos%C3%A9@example.com')).toBe('mailto:jos%C3%A9@example.com');
  });

  test('decodes and encodes again a URL that can’t be parsed', () => {
    expect(encodeURLSafely('/images/caf%C3%A9 1.jpg')).toBe('/images/caf%C3%A9%201.jpg');
    expect(encodeURLSafely('/images/50%off.jpg')).toBe('/images/50%25off.jpg');
    expect(encodeURLSafely('/images/\uD800.jpg')).toBe('/images/%EF%BF%BD.jpg');
  });
});

describe('Test encodeRFC3986()', () => {
  test('encodes the sub-delimiters `encodeURIComponent()` leaves as they are', () => {
    expect(encodeRFC3986("my photo (1)!'*.jpg")).toBe('my%20photo%20%281%29%21%27%2A.jpg');
    expect(encodeRFC3986('a/b?c#d')).toBe('a%2Fb%3Fc%23d');
    expect(encodeRFC3986('-_.~')).toBe('-_.~');
  });
});

describe('Test encodePathSegments()', () => {
  test('keeps the slashes between segments', () => {
    expect(encodePathSegments('cms/posts/hello')).toBe('cms/posts/hello');
  });

  test('encodes characters that would end the path or change its meaning', () => {
    expect(encodePathSegments('cms/posts/c#-tips')).toBe('cms/posts/c%23-tips');
    expect(encodePathSegments('images/photo #1?.jpg')).toBe('images/photo%20%231%3F.jpg');
    expect(encodePathSegments('cms/pages/about%2Fus')).toBe('cms/pages/about%252Fus');
    expect(encodePathSegments('/assets/images/50%off.jpg')).toBe('/assets/images/50%25off.jpg');
    expect(encodePathSegments('日本/写真.jpg')).toBe(
      `${encodeURIComponent('日本')}/${encodeURIComponent('写真.jpg')}`,
    );
  });

  test('keeps empty segments of leading, trailing and double slashes', () => {
    expect(encodePathSegments('/a//b/')).toBe('/a//b/');
    expect(encodePathSegments('')).toBe('');
  });

  test('uses a custom segment encoder when given', () => {
    expect(encodePathSegments('a b/c+d', (segment) => segment.replaceAll(' ', '+'))).toBe(
      'a+b/c+d',
    );
    expect(encodePathSegments("a (1)/b!'*", encodeRFC3986)).toBe('a%20%281%29/b%21%27%2A');
  });
});

describe('Test trimTrailingSlashes()', () => {
  test('removes the trailing slashes only', () => {
    expect(trimTrailingSlashes('https://example.com/media//')).toBe('https://example.com/media');
    expect(trimTrailingSlashes('/media/')).toBe('/media');
    expect(trimTrailingSlashes('https://example.com')).toBe('https://example.com');
  });
});
