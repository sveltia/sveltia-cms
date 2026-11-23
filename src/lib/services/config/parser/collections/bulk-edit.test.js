import { beforeEach, describe, expect, test, vi } from 'vitest';

import { checkBulkEditFields } from '$lib/services/config/parser/collections/bulk-edit';
import { addMessage } from '$lib/services/config/parser/utils/validator';

vi.mock('$lib/services/config/parser/utils/validator');

/** @type {any} */
const collectors = { errors: new Set(), warnings: new Set() };
/** @type {any} */
const context = { cmsConfig: {}, collection: { name: 'posts' } };

/** @type {any[]} */
const fields = [
  { name: 'title' },
  { name: 'body', widget: 'markdown' },
  { name: 'draft', widget: 'boolean' },
  { name: 'tags', widget: 'select', options: ['a'], multiple: true },
];

/**
 * Run the check.
 * @param {any} bulkEdit `bulk_edit` option value.
 * @param {any[]} [collectionFields] Collection fields.
 */
const check = (bulkEdit, collectionFields = fields) => {
  checkBulkEditFields({ bulkEdit, fields: collectionFields, context, collectors });
};

describe('checkBulkEditFields', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  test('does nothing without a field list', () => {
    check(undefined);
    check(true);
    check(false);
    check({});
    check({ fields: 'title' });
    expect(addMessage).not.toHaveBeenCalled();
  });

  test('adds no message when every listed field can be edited in bulk', () => {
    check({ fields: ['draft', 'title'] });
    check({ fields: [] });
    expect(addMessage).not.toHaveBeenCalled();
  });

  test('reports a field that doesn’t exist', () => {
    check({ fields: ['title', 'missing'] });

    expect(addMessage).toHaveBeenCalledExactlyOnceWith({
      strKey: 'invalid_bulk_edit_field',
      values: { name: 'missing' },
      context,
      collectors,
    });
  });

  test('reports a field that can’t be edited in bulk', () => {
    check({ fields: ['body', 'draft', 'tags'] });

    expect(addMessage).toHaveBeenCalledTimes(2);
    expect(addMessage).toHaveBeenNthCalledWith(1, {
      strKey: 'unsupported_bulk_edit_field',
      values: { name: 'body' },
      context,
      collectors,
    });
    expect(addMessage).toHaveBeenNthCalledWith(2, {
      strKey: 'unsupported_bulk_edit_field',
      values: { name: 'tags' },
      context,
      collectors,
    });
  });

  test('converts a non-string name for the message', () => {
    check({ fields: [42] });

    expect(addMessage).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ strKey: 'invalid_bulk_edit_field', values: { name: '42' } }),
    );
  });

  test('treats missing collection fields as an empty list', () => {
    checkBulkEditFields({
      bulkEdit: { fields: ['title'] },
      fields: undefined,
      context,
      collectors,
    });

    expect(addMessage).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ strKey: 'invalid_bulk_edit_field', values: { name: 'title' } }),
    );
  });
});
