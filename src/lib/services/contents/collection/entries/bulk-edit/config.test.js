import { describe, expect, test } from 'vitest';

import { getBulkEditableFields, isBulkEditableField, isBulkEditEnabled } from './config';

describe('isBulkEditableField()', () => {
  test.each(['boolean', 'color', 'datetime', 'number', 'relation', 'select', 'string'])(
    'accepts a %s field',
    (widget) => {
      expect(isBulkEditableField(/** @type {any} */ ({ name: 'field', widget }))).toBe(true);
    },
  );

  test('accepts a field without a type, which is a String field', () => {
    expect(isBulkEditableField({ name: 'title' })).toBe(true);
  });

  test.each(['text', 'markdown', 'richtext', 'list', 'object', 'image', 'file', 'hidden'])(
    'rejects a %s field',
    (widget) => {
      expect(isBulkEditableField(/** @type {any} */ ({ name: 'field', widget }))).toBe(false);
    },
  );

  test('rejects a field with the `multiple` option', () => {
    expect(
      isBulkEditableField(/** @type {any} */ ({ name: 'tags', widget: 'select', multiple: true })),
    ).toBe(false);
    expect(
      isBulkEditableField(/** @type {any} */ ({ name: 'tags', widget: 'select', multiple: false })),
    ).toBe(true);
  });

  test('rejects a read-only field', () => {
    expect(isBulkEditableField(/** @type {any} */ ({ name: 'title', readonly: true }))).toBe(false);
    expect(isBulkEditableField(/** @type {any} */ ({ name: 'title', readonly: false }))).toBe(true);
  });

  test('rejects an auto-increment Number field', () => {
    expect(
      isBulkEditableField(
        /** @type {any} */ ({ name: 'id', widget: 'number', auto_increment: true }),
      ),
    ).toBe(false);
    expect(
      isBulkEditableField(
        /** @type {any} */ ({ name: 'id', widget: 'number', auto_increment: false }),
      ),
    ).toBe(true);
  });

  test('rejects a DateTime field with the `auto_now` option', () => {
    expect(
      isBulkEditableField(
        /** @type {any} */ ({ name: 'updated', widget: 'datetime', auto_now: true }),
      ),
    ).toBe(false);
    expect(
      isBulkEditableField(
        /** @type {any} */ ({ name: 'created', widget: 'datetime', auto_now: ['create'] }),
      ),
    ).toBe(false);
    expect(
      isBulkEditableField(
        /** @type {any} */ ({ name: 'date', widget: 'datetime', auto_now: false }),
      ),
    ).toBe(true);
  });
});

describe('isBulkEditEnabled()', () => {
  test('returns true for an entry collection with the `bulk_edit` option', () => {
    expect(isBulkEditEnabled({ _type: 'entry', bulk_edit: true })).toBe(true);
    expect(isBulkEditEnabled({ _type: 'entry', bulk_edit: { fields: ['title'] } })).toBe(true);
    expect(isBulkEditEnabled({ _type: 'entry', bulk_edit: {} })).toBe(true);
  });

  test('returns false otherwise', () => {
    expect(isBulkEditEnabled({ _type: 'entry' })).toBe(false);
    expect(isBulkEditEnabled({ _type: 'entry', bulk_edit: false })).toBe(false);
    expect(isBulkEditEnabled({ _type: 'file', bulk_edit: true })).toBe(false);
    expect(isBulkEditEnabled(undefined)).toBe(false);
    expect(isBulkEditEnabled(null)).toBe(false);
  });
});

describe('getBulkEditableFields()', () => {
  const fields = [
    { name: 'title' },
    { name: 'body', widget: 'markdown' },
    { name: 'draft', widget: 'boolean' },
    { name: 'tags', widget: 'select', options: ['a', 'b'], multiple: true },
    { name: 'updated', widget: 'datetime', auto_now: true },
    { name: 'order', widget: 'number' },
  ];

  /**
   * Build a minimal entry collection mock.
   * @param {any} bulkEdit `bulk_edit` option value.
   * @returns {any} Collection.
   */
  const makeCollection = (bulkEdit) => ({
    name: 'posts',
    _type: 'entry',
    bulk_edit: bulkEdit,
    fields,
  });

  /**
   * Get the names of the bulk-editable fields.
   * @param {any} collection Collection.
   * @returns {string[]} Field names.
   */
  const names = (collection) => getBulkEditableFields(collection).map(({ name }) => name);

  test('returns no fields when the bulk editor is not enabled', () => {
    expect(getBulkEditableFields(undefined)).toEqual([]);
    expect(getBulkEditableFields(makeCollection(false))).toEqual([]);
    expect(getBulkEditableFields(makeCollection(undefined))).toEqual([]);
    expect(getBulkEditableFields(/** @type {any} */ ({ _type: 'file', bulk_edit: true }))).toEqual(
      [],
    );
  });

  test('returns every eligible field in the configured order', () => {
    expect(names(makeCollection(true))).toEqual(['title', 'draft', 'order']);
  });

  test('returns every eligible field when the object option has no field list', () => {
    expect(names(makeCollection({}))).toEqual(['title', 'draft', 'order']);
    expect(names(makeCollection({ fields: 'title' }))).toEqual(['title', 'draft', 'order']);
  });

  test('returns the listed fields in the listed order', () => {
    expect(names(makeCollection({ fields: ['order', 'title'] }))).toEqual(['order', 'title']);
  });

  test('leaves out the listed fields that are missing or not eligible', () => {
    expect(
      names(makeCollection({ fields: ['draft', 'missing', 'body', 'tags', 'updated', 'title'] })),
    ).toEqual(['draft', 'title']);
  });

  test('returns no fields for an empty list', () => {
    expect(names(makeCollection({ fields: [] }))).toEqual([]);
  });
});
