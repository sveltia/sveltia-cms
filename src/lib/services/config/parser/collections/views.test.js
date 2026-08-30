import { beforeEach, describe, expect, it, vi } from 'vitest';

import { checkViewOptions } from './views';

/**
 * @import { ConfigParserCollectors } from '$lib/types/private';
 * @import { Field } from '$lib/types/public';
 */

const { mockAddMessage, mockCheckName } = vi.hoisted(() => ({
  mockAddMessage: vi.fn(),
  mockCheckName: vi.fn((/** @type {any} */ _args) => true),
}));

vi.mock('$lib/services/config/parser/utils/validator', () => ({
  addMessage: mockAddMessage,
  checkName: mockCheckName,
}));

/**
 * Create a fresh collectors object for testing.
 * @returns {ConfigParserCollectors} Collectors instance.
 */
const createCollectors = () => ({
  errors: new Set(),
  warnings: new Set(),
  mediaFields: new Set(),
  relationFields: new Set(),
});

/**
 * Call {@link checkViewOptions} with the given collection options.
 * @param {Record<string, any>} collection Partial collection config.
 */
const check = (collection) => {
  checkViewOptions(
    /** @type {any} */ ({ cmsConfig: {}, collection: { name: 'posts', ...collection } }),
    createCollectors(),
  );
};

/** @type {Field[]} */
const fields = [
  { name: 'title', label: 'Title', widget: 'string' },
  {
    name: 'author',
    label: 'Author',
    widget: 'object',
    fields: [{ name: 'name', label: 'Name', widget: 'string' }],
  },
  {
    name: 'images',
    label: 'Images',
    widget: 'list',
    fields: [
      { name: 'src', label: 'Source', widget: 'image' },
      { name: 'alt', label: 'Alt Text', widget: 'string' },
    ],
  },
  {
    name: 'thumbnail',
    label: 'Thumbnail',
    widget: 'list',
    field: { name: 'src', label: 'Source', widget: 'image' },
  },
  {
    name: 'blocks',
    label: 'Blocks',
    widget: 'list',
    types: [
      {
        name: 'heading',
        label: 'Heading',
        widget: 'object',
        fields: [{ name: 'text', label: 'Text', widget: 'string' }],
      },
      {
        name: 'image',
        label: 'Image',
        widget: 'object',
        fields: [{ name: 'src', label: 'Source', widget: 'image' }],
      },
    ],
  },
];

describe('Test checkViewOptions()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should skip validation when the collection has no fields', () => {
    check({
      fields: [],
      sortable_fields: ['nonexistent'],
      view_groups: [{ field: 'nonexistent' }],
    });

    expect(mockAddMessage).not.toHaveBeenCalled();
  });

  it('should accept sortable fields defined in the collection', () => {
    check({ fields, sortable_fields: ['title', 'author.name', 'images.0.src'] });

    expect(mockAddMessage).not.toHaveBeenCalled();
  });

  it('should add an error for an undefined sortable field', () => {
    check({ fields, sortable_fields: ['title', 'category'] });

    expect(mockAddMessage).toHaveBeenCalledTimes(1);
    expect(mockAddMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        strKey: 'invalid_sortable_field',
        values: { name: 'category' },
      }),
    );
  });

  it('should validate sortable fields in the object format, including the default field', () => {
    check({
      fields,
      sortable_fields: { fields: ['title'], default: { field: 'title', direction: 'descending' } },
    });

    expect(mockAddMessage).not.toHaveBeenCalled();

    check({
      fields,
      sortable_fields: { fields: ['title'], default: { field: 'published_date' } },
    });

    expect(mockAddMessage).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        strKey: 'invalid_sortable_field',
        values: { name: 'published_date' },
      }),
    );
  });

  it('should accept entry metadata and internal sort keys', () => {
    check({
      fields,
      sortable_fields: ['slug', 'commit_author', 'commit_date', '_summary', '_manual'],
    });

    expect(mockAddMessage).not.toHaveBeenCalled();
  });

  it('should ignore an invalid sortable fields configuration', () => {
    check({ fields, sortable_fields: 'title' });
    check({ fields, sortable_fields: [''] });

    expect(mockAddMessage).not.toHaveBeenCalled();
  });

  it('should validate view groups in both formats', () => {
    check({ fields, view_groups: [{ label: 'Author', field: 'author.name' }] });
    check({
      fields,
      view_groups: { groups: [{ name: 'slugs', label: 'Slugs', field: 'slug' }] },
    });

    expect(mockAddMessage).not.toHaveBeenCalled();

    check({ fields, view_groups: [{ label: 'Year', field: 'date', pattern: '\\d{4}' }] });
    check({ fields, view_groups: { groups: [{ name: 'years', label: 'Year', field: 'date' }] } });

    expect(mockAddMessage).toHaveBeenCalledTimes(2);
    expect(mockAddMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        strKey: 'invalid_view_group_field',
        values: { name: 'date' },
      }),
    );
  });

  it('should validate view filters in both formats', () => {
    check({ fields, view_filters: [{ label: 'Titled', field: 'title', pattern: '.' }] });
    check({
      fields,
      view_filters: { filters: [{ name: 'titled', field: 'title', pattern: '.' }] },
    });

    expect(mockAddMessage).not.toHaveBeenCalled();

    check({ fields, view_filters: [{ label: 'Drafts', field: 'draft', pattern: true }] });

    expect(mockAddMessage).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        strKey: 'invalid_view_filter_field',
        values: { name: 'draft' },
      }),
    );
  });

  it('should ignore a view option without a valid field', () => {
    check({
      fields,
      view_groups: [{ label: 'Empty' }, { label: 'Invalid', field: 123 }, 'invalid'],
      view_filters: { filters: [{ label: 'Empty', pattern: 'x' }] },
    });

    expect(mockAddMessage).not.toHaveBeenCalled();
  });

  it('should check the name of each option in the object format', () => {
    check({
      fields,
      view_groups: {
        groups: [
          { name: 'categories', label: 'Categories', field: 'title' },
          { name: 'categories', label: 'Categories', field: 'title' },
        ],
      },
    });

    expect(mockCheckName).toHaveBeenCalledTimes(2);

    expect(mockCheckName).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ name: 'categories', index: 0, strKeyBase: 'view_group_name' }),
    );

    expect(mockCheckName).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ name: 'categories', index: 1, strKeyBase: 'view_group_name' }),
    );

    // The same name counter must be shared between the options, so the duplicate can be detected
    expect(mockCheckName.mock.calls[1][0].nameCounts).toBe(
      mockCheckName.mock.calls[0][0].nameCounts,
    );
  });

  it('should require a name in the object format only', () => {
    check({ fields, view_filters: { filters: [{ label: 'Titled', field: 'title' }] } });

    expect(mockCheckName).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        name: undefined,
        index: 0,
        strKeyBase: 'view_filter_name',
        required: true,
      }),
    );

    mockCheckName.mockClear();

    // A name is optional in the array format, so a missing one isn’t reported
    check({
      fields,
      view_filters: [
        { label: 'Titled', field: 'title' },
        { name: 'authored', label: 'Authored', field: 'author.name' },
      ],
    });

    expect(mockCheckName).toHaveBeenCalledTimes(2);
    expect(mockCheckName).toHaveBeenLastCalledWith(
      expect.objectContaining({
        name: 'authored',
        index: 1,
        strKeyBase: 'view_filter_name',
        required: false,
      }),
    );
  });
});
