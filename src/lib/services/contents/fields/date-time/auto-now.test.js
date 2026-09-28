import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { getField } from '$lib/services/contents/entry/fields';

import { assignAutoNowValues, getAutoNowStages, isAutoNowField } from './auto-now';

/**
 * @import { EntryDraft } from '$lib/types/private';
 * @import { DateTimeField, Field } from '$lib/types/public';
 */

vi.mock('$lib/services/contents/entry/fields');

/**
 * Create a DateTime field configuration.
 * @param {Partial<DateTimeField>} [props] Extra properties.
 * @returns {DateTimeField} Field configuration.
 */
const dateTimeField = (props = {}) => ({ name: 'date', widget: 'datetime', ...props });

describe('getAutoNowStages', () => {
  test('returns no stages by default', () => {
    expect(getAutoNowStages(dateTimeField())).toEqual([]);
  });

  test('expands a boolean', () => {
    expect(getAutoNowStages(dateTimeField({ auto_now: true }))).toEqual(['create', 'update']);
    expect(getAutoNowStages(dateTimeField({ auto_now: false }))).toEqual([]);
  });

  test('returns the stages given as an array', () => {
    expect(getAutoNowStages(dateTimeField({ auto_now: ['create'] }))).toEqual(['create']);
    expect(getAutoNowStages(dateTimeField({ auto_now: ['update'] }))).toEqual(['update']);
  });

  test('ignores a value of another type', () => {
    expect(getAutoNowStages(dateTimeField({ auto_now: /** @type {any} */ ('create') }))).toEqual(
      [],
    );
  });

  test('ignores the option on another field type', () => {
    expect(
      getAutoNowStages(/** @type {Field} */ ({ name: 'date', widget: 'string', auto_now: true })),
    ).toEqual([]);
  });
});

describe('isAutoNowField', () => {
  test('tells whether any stage is enabled', () => {
    expect(isAutoNowField(dateTimeField({ auto_now: true }))).toBe(true);
    expect(isAutoNowField(dateTimeField({ auto_now: ['update'] }))).toBe(true);
    expect(isAutoNowField(dateTimeField({ auto_now: [] }))).toBe(false);
    expect(isAutoNowField(dateTimeField())).toBe(false);
  });
});

describe('assignAutoNowValues', () => {
  const created = dateTimeField({ name: 'created', auto_now: ['create'], output_utc: true });
  const updated = dateTimeField({ name: 'updated', auto_now: true, output_utc: true });
  const updatedOnly = dateTimeField({ name: 'modified', auto_now: ['update'], output_utc: true });
  const date = dateTimeField({ output_utc: true });

  const formatted = dateTimeField({
    name: 'items.*.time',
    auto_now: true,
    format: 'YYYY/MM/DD',
    input_timezone: 'utc',
  });

  /** @type {Record<string, Field>} */
  const fieldMap = {
    created,
    updated,
    modified: updatedOnly,
    date,
    'items.0.time': formatted,
    'items.1.time': formatted,
  };

  /**
   * Create a draft holding the given values.
   * @param {boolean} isNew Whether the draft is for a new entry.
   * @returns {EntryDraft} Draft.
   */
  const createDraft = (isNew) =>
    /** @type {EntryDraft} */ (
      /** @type {unknown} */ ({
        isNew,
        collectionName: 'posts',
        fileName: undefined,
        isIndexFile: false,
        currentValues: {
          en: {
            title: 'Hello',
            created: '',
            updated: '2020-01-01T00:00:00.000Z',
            modified: '',
            date: '2020-01-01T00:00:00.000Z',
            'items.0.time': '',
            'items.1.time': '',
          },
          ja: { title: 'こんにちは', updated: '' },
        },
      })
    );

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-28T12:34:56.789Z'));
    vi.mocked(getField).mockImplementation(({ keyPath }) => fieldMap[keyPath]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('sets the fields covering the `create` stage for a new entry', () => {
    const draft = createDraft(true);

    assignAutoNowValues(draft);

    expect(draft.currentValues).toEqual({
      en: {
        title: 'Hello',
        created: '2026-09-28T12:34:56Z',
        updated: '2026-09-28T12:34:56Z',
        modified: '',
        date: '2020-01-01T00:00:00.000Z',
        'items.0.time': '2026/09/28',
        'items.1.time': '2026/09/28',
      },
      ja: { title: 'こんにちは', updated: '2026-09-28T12:34:56Z' },
    });
    expect(getField).toHaveBeenCalledWith({
      collectionName: 'posts',
      fileName: undefined,
      keyPath: 'created',
      valueMap: draft.currentValues.en,
      isIndexFile: false,
    });
  });

  test('sets the fields covering the `update` stage for an existing entry', () => {
    const draft = createDraft(false);

    draft.currentValues.en.created = '2019-01-01T00:00:00.000Z';
    assignAutoNowValues(draft);

    expect(draft.currentValues.en).toMatchObject({
      created: '2019-01-01T00:00:00.000Z',
      updated: '2026-09-28T12:34:56Z',
      modified: '2026-09-28T12:34:56Z',
      date: '2020-01-01T00:00:00.000Z',
    });
    expect(draft.currentValues.ja.updated).toBe('2026-09-28T12:34:56Z');
  });

  test('sets an empty `create` value of an existing entry, such as in a List item just added', () => {
    const draft = createDraft(false);

    draft.currentValues.en['items.0.time'] = '2019/01/01';
    // `items.*.time` covers both stages, so use a field covering `create` alone for the new item
    fieldMap['items.1.time'] = created;
    assignAutoNowValues(draft);
    fieldMap['items.1.time'] = formatted;

    expect(draft.currentValues.en).toMatchObject({
      // Not set before the option was enabled
      created: '2026-09-28T12:34:56Z',
      // Added to the existing entry
      'items.1.time': '2026-09-28T12:34:56Z',
    });
  });

  test('keeps the seconds in local time without a timezone option', () => {
    const local = dateTimeField({ name: 'local', auto_now: true });

    const draft = /** @type {EntryDraft} */ (
      /** @type {unknown} */ ({
        isNew: true,
        collectionName: 'posts',
        currentValues: { en: { local: '' } },
      })
    );

    vi.mocked(getField).mockReturnValue(local);
    assignAutoNowValues(draft);

    // The local time depends on the time zone the tests run in, but the seconds don’t
    expect(draft.currentValues.en.local).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:56$/);
  });

  test('gives every field and locale the same time even if the clock ticks over', () => {
    const draft = createDraft(true);
    let tick = 0;

    vi.mocked(getField).mockImplementation(({ keyPath }) => {
      tick += 1;
      vi.setSystemTime(new Date(Date.UTC(2026, 8, 28, 0, tick)));

      return fieldMap[keyPath];
    });

    assignAutoNowValues(draft);

    // The time is taken before the first field is looked up
    expect(draft.currentValues.en.created).toBe('2026-09-28T12:34:56Z');
    expect(draft.currentValues.en.updated).toBe('2026-09-28T12:34:56Z');
    expect(draft.currentValues.ja.updated).toBe('2026-09-28T12:34:56Z');
  });
});
