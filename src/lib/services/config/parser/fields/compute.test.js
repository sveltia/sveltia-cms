import { beforeEach, describe, expect, test, vi } from 'vitest';

import { parseComputeFieldConfig } from '$lib/services/config/parser/fields/compute';
import { addMessage } from '$lib/services/config/parser/utils/validator';

vi.mock('$lib/services/config/parser/utils/validator');

/** @type {any} */
const collectors = { errors: new Set(), warnings: new Set() };

/** @type {any[]} */
const fields = [
  { name: 'title', widget: 'string' },
  { name: 'items', widget: 'list', fields: [{ name: 'id', widget: 'compute', value: '' }] },
];

/**
 * Parse a Compute field with the given value template in the given context.
 * @param {string} value The `value` option.
 * @param {object} [contextOverrides] Context to override the collection context with.
 * @returns {any} The context the check ran with.
 */
const check = (value, contextOverrides = {}) => {
  const context = {
    cmsConfig: {},
    collection: { name: 'posts', folder: 'content/posts', fields },
    typedKeyPath: 'items.*.id',
    ...contextOverrides,
  };

  parseComputeFieldConfig({
    config: /** @type {any} */ ({ name: 'id', widget: 'compute', value }),
    context: /** @type {any} */ (context),
    collectors,
  });

  return context;
};

describe('parseComputeFieldConfig', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  test('accepts prefixed tags that name fields of the entry', () => {
    check('posts-{{fields.title}}-{{fields.items.*.id}}');
    expect(addMessage).not.toHaveBeenCalled();
  });

  test('ignores the index tag and other bare tags, which never read a field', () => {
    check('{{index}}-{{title}}-{{slug}}');
    expect(addMessage).not.toHaveBeenCalled();
  });

  test('reports a prefixed tag that names no field', () => {
    const context = check('posts-{{fields.slug}}');

    expect(addMessage).toHaveBeenCalledExactlyOnceWith({
      strKey: 'option_field_not_found',
      values: { option: 'value', name: 'fields.slug' },
      context,
      collectors,
    });
  });

  test('checks against the fields of a collection file', () => {
    check('{{fields.title}}', {
      collection: { name: 'settings', files: [] },
      collectionFile: { name: 'general', file: 'general.yaml', fields: [{ name: 'siteName' }] },
    });

    expect(addMessage).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ values: { option: 'value', name: 'fields.title' } }),
    );
  });

  test('checks against the fields of an index file when it has its own', () => {
    check('{{fields.title}}', {
      collection: {
        name: 'posts',
        folder: 'content/posts',
        fields,
        index_file: { fields: [{ name: 'heading' }] },
      },
      isIndexFile: true,
    });

    expect(addMessage).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ values: { option: 'value', name: 'fields.title' } }),
    );
  });

  test('says nothing for a field of a custom editor component', () => {
    check('{{fields.slug}}', { collection: undefined, componentName: 'my-component' });
    expect(addMessage).not.toHaveBeenCalled();
  });

  test('says nothing when the collection has no fields, which is reported separately', () => {
    check('{{fields.slug}}', {
      collection: { name: 'posts', folder: 'content/posts', fields: [] },
    });
    expect(addMessage).not.toHaveBeenCalled();
  });
});
