import { describe, expect, test, vi } from 'vitest';

import { copyProperty } from '$lib/services/contents/draft/save/serialize';

vi.mock('$lib/services/assets');

/**
 * @import { FlattenedEntryContent } from '$lib/types/private';
 * @import { Field } from '$lib/types/public';
 */

describe('Test copyProperty()', () => {
  /** @type {Field[]} */
  const fields = [
    { name: 'title', widget: 'string', required: true },
    { name: 'description', widget: 'string', required: false },
    { name: 'image', widget: 'image', required: false },
    { name: 'hidden', widget: 'boolean', required: false },
    { name: 'threshold', widget: 'number', required: false },
    { name: 'organizers', widget: 'list', required: false },
    { name: 'program', widget: 'object', required: false },
    { name: 'address', widget: 'object', required: false },
    { name: 'variables', widget: 'keyvalue', required: false },
  ];

  /** @type {FlattenedEntryContent} */
  const content = {
    title: 'My Post',
    description: '',
    image: '',
    hidden: false,
    threshold: null,
    organizers: [],
    program: null,
    address: {},
    variables: {},
  };

  /**
   * Wrapper for {@link copyProperty}.
   * @param {boolean} [omitEmptyOptionalFields] The omit option.
   * @returns {FlattenedEntryContent} Copied content. Note: It’s not sorted here because sorting is
   * done in `finalizeContent`.
   */
  const copy = (omitEmptyOptionalFields = false) => {
    /** @type {FlattenedEntryContent} */
    const sortedMap = {};

    /** @type {FlattenedEntryContent} */
    const unsortedMap = {
      ...structuredClone(content),
      'variables.foo': 'foo',
      'variables.bar': 'bar',
    };

    const args = {
      locale: 'en',
      unsortedMap,
      sortedMap,
      isTomlOutput: false,
      omitEmptyOptionalFields,
    };

    fields.forEach((field) => {
      copyProperty({ ...args, key: field.name, field });
    });

    return sortedMap;
  };

  test('omit option unspecified', () => {
    expect(copy()).toEqual(content);
  });

  test('omit option disabled', () => {
    expect(copy(false)).toEqual(content);
  });

  test('omit option enabled', () => {
    // Here `variables.X` are not included but that’s fine; it’s done is `finalizeContent`
    expect(copy(true)).toEqual({ title: 'My Post', variables: {} });
  });

  test('skips internal UUIDs added to list items', () => {
    /** @type {FlattenedEntryContent} */
    const sortedMap = {};

    /** @type {FlattenedEntryContent} */
    const unsortedMap = {
      title: 'My Post',
      'organizers.0.__sc_item_id': 'uuid-123',
      'organizers.0.name': 'John Doe',
      'organizers.1.__sc_item_id': 'uuid-456',
      'organizers.1.name': 'Jane Smith',
      'program.speakers.0.__sc_item_id': 'uuid-789',
      'program.speakers.0.bio': 'Speaker bio',
    };

    const args = {
      locale: 'en',
      unsortedMap,
      sortedMap,
      isTomlOutput: false,
      omitEmptyOptionalFields: false,
    };

    // Test copying properties that should be kept
    copyProperty({ ...args, key: 'title' });
    copyProperty({ ...args, key: 'organizers.0.name' });
    copyProperty({ ...args, key: 'organizers.1.name' });
    copyProperty({ ...args, key: 'program.speakers.0.bio' });

    // Test copying properties that should be skipped (internal UUIDs)
    copyProperty({ ...args, key: 'organizers.0.__sc_item_id' });
    copyProperty({ ...args, key: 'organizers.1.__sc_item_id' });
    copyProperty({ ...args, key: 'program.speakers.0.__sc_item_id' });

    // Check that UUID keys are not in the sorted map
    expect(sortedMap).toEqual({
      title: 'My Post',
      'organizers.0.name': 'John Doe',
      'organizers.1.name': 'Jane Smith',
      'program.speakers.0.bio': 'Speaker bio',
    });

    // Check that UUID keys are removed from the unsorted map
    expect(unsortedMap).not.toHaveProperty('organizers.0.__sc_item_id');
    expect(unsortedMap).not.toHaveProperty('organizers.1.__sc_item_id');
    expect(unsortedMap).not.toHaveProperty('program.speakers.0.__sc_item_id');

    // Check that non-UUID keys are still removed from unsorted map after copying
    expect(unsortedMap).not.toHaveProperty('title');
    expect(unsortedMap).not.toHaveProperty('organizers.0.name');
    expect(unsortedMap).not.toHaveProperty('organizers.1.name');
    expect(unsortedMap).not.toHaveProperty('program.speakers.0.bio');
  });
});
