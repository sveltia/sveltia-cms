import { describe, expect, it } from 'vitest';

import { hasMatch, normalize } from './util';

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
});
