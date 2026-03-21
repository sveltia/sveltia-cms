import { writable } from 'svelte/store';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { validateKeyValueField } from './validate';

/**
 * @import { EntryValidityState } from '$lib/types/private';
 */

const mockGetField = vi.hoisted(() => vi.fn());

vi.mock('$lib/services/contents/entry/fields', () => ({ getField: mockGetField }));

vi.mock('$lib/services/contents/draft', () => ({
  entryDraft: writable(null),
  i18nAutoDupEnabled: { subscribe: vi.fn() },
}));

vi.mock('$lib/services/contents/fields/rich-text', () => ({
  COMPONENT_NAME_PREFIX_REGEX: /^__component__\./,
}));

/**
 * Creates a fresh validity state with all flags set to false.
 * @returns {EntryValidityState} Default-false validity object.
 */
const freshValidity = () => ({
  valueMissing: false,
  tooShort: false,
  tooLong: false,
  rangeUnderflow: false,
  rangeOverflow: false,
  patternMismatch: false,
  typeMismatch: false,
});

/** @type {import('$lib/types/private').GetFieldArgs} */
const baseGetFieldArgs = {
  collectionName: 'posts',
  fileName: undefined,
  componentName: undefined,
  valueMap: {},
  keyPath: 'meta',
  isIndexFile: false,
};

describe('validateKeyValueField()', () => {
  beforeEach(() => {
    mockGetField.mockReset();
  });

  test('skips when keyPath is already validated', () => {
    mockGetField.mockReturnValue({ widget: 'keyvalue' });

    const validity = freshValidity();

    const result = validateKeyValueField({
      keyPath: 'meta.someKey',
      getFieldArgs: baseGetFieldArgs,
      validity,
      validities: { _default: { meta: validity } },
      locale: '_default',
      required: true,
      min: 0,
      max: Infinity,
    });

    expect(result.skip).toBe(true);
    expect(validity.valueMissing).toBe(false);
  });

  test('skips when parent field is not a keyvalue widget', () => {
    mockGetField.mockReturnValue({ widget: 'string' });

    const validity = freshValidity();

    const result = validateKeyValueField({
      keyPath: 'title.sub',
      getFieldArgs: { ...baseGetFieldArgs, keyPath: 'title' },
      validity,
      validities: { _default: {} },
      locale: '_default',
      required: true,
      min: 0,
      max: Infinity,
    });

    expect(result.skip).toBe(true);
  });

  test('resolves to parent keyPath when parent widget is keyvalue', async () => {
    mockGetField.mockReturnValue({ widget: 'keyvalue' });

    const { entryDraft } = await import('$lib/services/contents/draft');

    // @ts-expect-error - minimal mock
    entryDraft.set({
      currentValues: { _default: { 'meta.key1': 'val1', 'meta.key2': 'val2' } },
    });

    const validity = freshValidity();

    const result = validateKeyValueField({
      keyPath: 'meta.key1',
      getFieldArgs: { ...baseGetFieldArgs, keyPath: 'meta' },
      validity,
      validities: { _default: {} },
      locale: '_default',
      required: false,
      min: 0,
      max: Infinity,
    });

    expect(result.skip).toBe(false);
    expect(result.keyPath).toBe('meta');
  });

  test('sets valueMissing when required and no pairs exist', async () => {
    mockGetField.mockReturnValue({ widget: 'keyvalue' });

    const { entryDraft } = await import('$lib/services/contents/draft');

    // @ts-expect-error - minimal mock
    entryDraft.set({ currentValues: { _default: {} } });

    const validity = freshValidity();

    validateKeyValueField({
      keyPath: 'meta.key1',
      getFieldArgs: { ...baseGetFieldArgs, keyPath: 'meta' },
      validity,
      validities: { _default: {} },
      locale: '_default',
      required: true,
      min: 0,
      max: Infinity,
    });

    expect(validity.valueMissing).toBe(true);
  });

  test('sets rangeUnderflow when pair count is below min', async () => {
    mockGetField.mockReturnValue({ widget: 'keyvalue' });

    const { entryDraft } = await import('$lib/services/contents/draft');

    // @ts-expect-error - minimal mock
    entryDraft.set({ currentValues: { _default: { 'meta.k1': 'v1' } } });

    const validity = freshValidity();

    validateKeyValueField({
      keyPath: 'meta.k1',
      getFieldArgs: { ...baseGetFieldArgs, keyPath: 'meta' },
      validity,
      validities: { _default: {} },
      locale: '_default',
      required: false,
      min: 3,
      max: Infinity,
    });

    expect(validity.rangeUnderflow).toBe(true);
  });

  test('sets rangeOverflow when pair count exceeds max', async () => {
    mockGetField.mockReturnValue({ widget: 'keyvalue' });

    const { entryDraft } = await import('$lib/services/contents/draft');

    // @ts-expect-error - minimal mock
    entryDraft.set({
      currentValues: { _default: { 'meta.k1': 'v1', 'meta.k2': 'v2', 'meta.k3': 'v3' } },
    });

    const validity = freshValidity();

    validateKeyValueField({
      keyPath: 'meta.k1',
      getFieldArgs: { ...baseGetFieldArgs, keyPath: 'meta' },
      validity,
      validities: { _default: {} },
      locale: '_default',
      required: false,
      min: 0,
      max: 2,
    });

    expect(validity.rangeOverflow).toBe(true);
  });
});
