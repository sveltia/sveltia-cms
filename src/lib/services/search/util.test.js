import { describe, expect, it } from 'vitest';

import { getNormalizedValueCache, hasAllMatches, hasMatch, normalize, tokenize } from './util';

describe('normalize', () => {
  it('should normalize basic strings', () => {
    expect(normalize('Hello World')).toBe('hello world');
    expect(normalize('UPPERCASE')).toBe('uppercase');
    expect(normalize('MixedCase')).toBe('mixedcase');
  });

  it('should handle empty and whitespace strings', () => {
    expect(normalize('')).toBe('');
    expect(normalize('   ')).toBe('');
    expect(normalize('  hello  ')).toBe('hello');
  });

  it('should remove diacritics', () => {
    expect(normalize('café')).toBe('cafe');
    expect(normalize('naïve')).toBe('naive');
    expect(normalize('résumé')).toBe('resume');
    expect(normalize('piñata')).toBe('pinata');
    expect(normalize('façade')).toBe('facade');
  });

  it('should handle unicode characters', () => {
    expect(normalize('tëst')).toBe('test');
    expect(normalize('Ñoño')).toBe('nono');
    expect(normalize('José')).toBe('jose');
  });

  it('should preserve numbers and special characters', () => {
    expect(normalize('test123')).toBe('test123');
    expect(normalize('test-file_name.txt')).toBe('test-file_name.txt');
    expect(normalize('user@example.com')).toBe('user@example.com');
  });
});

describe('hasMatch', () => {
  it('should find exact matches', () => {
    expect(hasMatch({ value: 'hello world', terms: 'hello' })).toBe(true);
    expect(hasMatch({ value: 'hello world', terms: 'world' })).toBe(true);
    expect(hasMatch({ value: 'hello world', terms: 'hello world' })).toBe(true);
  });

  it('should find case-insensitive matches', () => {
    expect(hasMatch({ value: 'Hello World', terms: 'hello' })).toBe(true);
    expect(hasMatch({ value: 'HELLO WORLD', terms: 'world' })).toBe(true);
    expect(hasMatch({ value: 'hello world', terms: 'hello' })).toBe(true);
  });

  it('should find partial matches', () => {
    expect(hasMatch({ value: 'documentation', terms: 'doc' })).toBe(true);
    expect(hasMatch({ value: 'javascript', terms: 'script' })).toBe(true);
    expect(hasMatch({ value: 'test-file', terms: 'file' })).toBe(true);
  });

  it('should handle diacritics in both value and terms', () => {
    expect(hasMatch({ value: 'café', terms: 'cafe' })).toBe(true);
    expect(hasMatch({ value: 'cafe', terms: 'cafe' })).toBe(true);
    expect(hasMatch({ value: 'résumé', terms: 'resume' })).toBe(true);
    expect(hasMatch({ value: 'naïve', terms: 'naive' })).toBe(true);
  });

  it('should return false for non-matches', () => {
    expect(hasMatch({ value: 'hello world', terms: 'goodbye' })).toBe(false);
    expect(hasMatch({ value: 'test', terms: 'testing' })).toBe(false);
    expect(hasMatch({ value: 'documentation', terms: 'development' })).toBe(false);
  });

  it('should handle empty values and terms', () => {
    expect(hasMatch({ value: '', terms: 'test' })).toBe(false);
    expect(hasMatch({ value: 'test', terms: '' })).toBe(true);
    expect(hasMatch({ value: '', terms: '' })).toBe(true);
  });

  it('should handle whitespace in values and terms', () => {
    expect(hasMatch({ value: '  hello world  ', terms: 'hello' })).toBe(true);
    expect(hasMatch({ value: 'hello world', terms: 'hello' })).toBe(true);
    expect(hasMatch({ value: '  test  ', terms: 'test' })).toBe(true);
  });

  it('should handle special characters', () => {
    expect(hasMatch({ value: 'user@example.com', terms: 'example' })).toBe(true);
    expect(hasMatch({ value: 'test-file_name.txt', terms: 'file_name' })).toBe(true);
    expect(hasMatch({ value: 'version-1.2.3', terms: '1.2' })).toBe(true);
  });

  it('should cache normalized values', () => {
    const normalizedValueCache = new Map();

    expect(hasMatch({ value: 'Café', terms: 'cafe', normalizedValueCache })).toBe(true);
    expect(normalizedValueCache.get('Café')).toBe('cafe');
  });

  it('should reuse cached normalized values', () => {
    const normalizedValueCache = new Map([['Café', 'cached-value']]);

    expect(hasMatch({ value: 'Café', terms: 'cached', normalizedValueCache })).toBe(true);
    expect(normalizedValueCache.get('Café')).toBe('cached-value');
  });
});

describe('getNormalizedValueCache', () => {
  it('should keep one cache per object across calls', () => {
    const entry = { id: 'a' };
    const cache = getNormalizedValueCache(entry);

    expect(cache).toBeInstanceOf(Map);
    expect(getNormalizedValueCache(entry)).toBe(cache);
  });

  it('should keep the caches of different objects apart', () => {
    const a = getNormalizedValueCache({ id: 'a' });
    const b = getNormalizedValueCache({ id: 'b' });

    expect(a).not.toBe(b);
  });

  it('should retain normalized values for later searches', () => {
    const entry = { id: 'a' };
    const normalizedValueCache = getNormalizedValueCache(entry);

    expect(hasMatch({ value: 'Café', terms: 'cafe', normalizedValueCache })).toBe(true);
    // A later search on the same object finds the value already normalized
    expect(getNormalizedValueCache(entry).get('Café')).toBe('cafe');
  });
});

describe('tokenize', () => {
  it('should split the terms on whitespace and normalize each token', () => {
    expect(tokenize('Annual Report cover')).toEqual(['annual', 'report', 'cover']);
    expect(tokenize('  Café \t naïve\n')).toEqual(['cafe', 'naive']);
  });

  it('should drop duplicate tokens', () => {
    expect(tokenize('report Report annual')).toEqual(['report', 'annual']);
  });

  it('should return an empty array for blank terms', () => {
    expect(tokenize('')).toEqual([]);
    expect(tokenize('   ')).toEqual([]);
  });

  it('should keep hyphenated words as one token', () => {
    expect(tokenize('annual-report cover')).toEqual(['annual-report', 'cover']);
  });
});

describe('hasAllMatches', () => {
  it('should require every token to be in the value, in any order', () => {
    const tokens = tokenize('annual report cover');

    expect(hasAllMatches({ value: 'annual-report-cover-photo.png', tokens })).toBe(true);
    expect(hasAllMatches({ value: 'cover-annual-report.png', tokens })).toBe(true);
    expect(hasAllMatches({ value: 'cover-photo.png', tokens })).toBe(false);
    expect(hasAllMatches({ value: 'photo.png', tokens })).toBe(false);
  });

  it('should match case-insensitively and ignore diacritics', () => {
    expect(hasAllMatches({ value: 'CAFÉ-Menu.pdf', tokens: tokenize('cafe menu') })).toBe(true);
  });

  it('should match any value when there are no tokens', () => {
    expect(hasAllMatches({ value: 'photo.png', tokens: [] })).toBe(true);
  });

  it('should use the normalized value cache', () => {
    const normalizedValueCache = new Map([['Café', 'cached-value']]);

    expect(hasAllMatches({ value: 'Café', tokens: ['cached'], normalizedValueCache })).toBe(true);
    expect(hasAllMatches({ value: 'Menu', tokens: ['menu'], normalizedValueCache })).toBe(true);
    expect(normalizedValueCache.get('Menu')).toBe('menu');
  });
});
