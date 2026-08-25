// @ts-nocheck
import { describe, expect, test } from 'vitest';

import {
  DEFAULT_ALIASES_KEY,
  getAliasesKey,
  getAliasKeyPaths,
  removeAliases,
} from '$lib/services/contents/entry/aliases';

describe('Test getAliasesKey()', () => {
  /**
   * Create a mock entry collection.
   * @param {any} [aliasesField] The `aliases_field` option value.
   * @returns {any} Mock collection.
   */
  const createCollection = (aliasesField) => ({
    name: 'posts',
    _type: 'entry',
    ...(aliasesField === undefined ? {} : { aliases_field: aliasesField }),
  });

  test('should return the default property name when the option is not defined', () => {
    expect(getAliasesKey({ collection: createCollection() })).toBe(DEFAULT_ALIASES_KEY);
  });

  test('should return the `aliases_field` option value', () => {
    expect(getAliasesKey({ collection: createCollection('redirect_from') })).toBe('redirect_from');
  });

  test('should return the default property name when the option is `true`', () => {
    expect(getAliasesKey({ collection: createCollection(true) })).toBe(DEFAULT_ALIASES_KEY);
  });

  test('should return `undefined` when the option is `false` or an empty string', () => {
    expect(getAliasesKey({ collection: createCollection(false) })).toBeUndefined();
    expect(getAliasesKey({ collection: createCollection('') })).toBeUndefined();
  });

  test('should return `undefined` for a non-entry collection', () => {
    expect(getAliasesKey({ collection: { name: 'pages', _type: 'file' } })).toBeUndefined();
    expect(getAliasesKey({ collection: undefined })).toBeUndefined();
  });

  test('should return `undefined` when a field with the same name is configured', () => {
    const fields = [
      { name: 'title', widget: 'string' },
      { name: 'aliases', widget: 'list' },
    ];

    expect(getAliasesKey({ collection: createCollection(), fields })).toBeUndefined();
    expect(getAliasesKey({ collection: createCollection(true), fields })).toBeUndefined();
    expect(getAliasesKey({ collection: createCollection('aliases'), fields })).toBeUndefined();
  });

  test('should return the property name when no field shares it', () => {
    const fields = [
      { name: 'title', widget: 'string' },
      { name: 'aliases', widget: 'list' },
    ];

    expect(getAliasesKey({ collection: createCollection('redirect_from'), fields })).toBe(
      'redirect_from',
    );
  });
});

describe('Test getAliasKeyPaths()', () => {
  test('should return an empty array when there is no alias', () => {
    expect(getAliasKeyPaths({ title: 'Title' }, 'aliases')).toEqual([]);
  });

  test('should return the key paths sorted by index, not alphabetically', () => {
    const content = {
      title: 'Title',
      'aliases.10': '/posts/j',
      'aliases.2': '/posts/c',
      'aliases.1': '/posts/b',
      aliasesFoo: 'not an alias',
      'aliases.0.foo': 'not an alias either',
      'aliases.0': '/posts/a',
    };

    expect(getAliasKeyPaths(content, 'aliases')).toEqual([
      'aliases.0',
      'aliases.1',
      'aliases.2',
      'aliases.10',
    ]);
  });

  test('should use the given property name', () => {
    const content = { 'aliases.0': '/posts/a', 'redirect_from.0': '/posts/b' };

    expect(getAliasKeyPaths(content, 'redirect_from')).toEqual(['redirect_from.0']);
  });
});

describe('Test removeAliases()', () => {
  test('should remove the property in any shape', () => {
    const content = {
      title: 'Title',
      aliases: '/posts/a',
      'aliases.0': '/posts/b',
      'aliases.1': '/posts/c',
      aliasesFoo: 'not an alias',
    };

    removeAliases(content, 'aliases');

    expect(content).toEqual({ title: 'Title', aliasesFoo: 'not an alias' });
  });

  test('should do nothing when there is no alias', () => {
    const content = { title: 'Title' };

    removeAliases(content, 'aliases');

    expect(content).toEqual({ title: 'Title' });
  });

  test('should do nothing when the property is not managed by the CMS', () => {
    const content = { title: 'Title', 'aliases.0': '/posts/a' };

    removeAliases(content, undefined);

    expect(content).toEqual({ title: 'Title', 'aliases.0': '/posts/a' });
  });
});
