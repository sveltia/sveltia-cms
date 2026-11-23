import { beforeEach, describe, expect, test, vi } from 'vitest';

import { getEditorEntryValues } from '$lib/services/contents/editor/entry-values';
import { getDraftSharedValues } from '$lib/services/contents/i18n/shared-values';

/**
 * @import { EntryDraft } from '$lib/types/private';
 */

const { getContext } = vi.hoisted(() => ({ getContext: vi.fn() }));

vi.mock('svelte', async (importOriginal) => ({
  .../** @type {object} */ (await importOriginal()),
  getContext,
}));

vi.mock('$lib/services/contents/i18n/shared-values', () => ({
  getDraftSharedValues: vi.fn(),
}));

/** @type {Record<string, any>} */
let contexts = {};

const draft = /** @type {EntryDraft} */ (
  /** @type {unknown} */ ({
    currentValues: { en: { title: 'Hello' }, ja: { title: 'こんにちは' } },
    extraValues: { en: { src: 'a.png' } },
    currentSlugs: { _: 'hello', ja: 'konnichiwa' },
  })
);

/** @type {any} */
const sharedValues = { values: { team: 'red' }, isShared: vi.fn(() => true) };

beforeEach(() => {
  contexts = {};
  getContext.mockImplementation((key) => contexts[key]);
  vi.mocked(getDraftSharedValues).mockReturnValue(sharedValues);
});

describe('getEditorEntryValues()', () => {
  test('reads the draft in the entry editor', () => {
    contexts['entry-draft'] = { current: draft };
    // A row is ignored while there is a draft
    contexts['bulk-edit-row'] = { values: { title: 'Row' }, slug: 'row' };

    const { getValues, getSharedValues, getSlug } = getEditorEntryValues();

    expect(getValues('en')).toEqual({ title: 'Hello' });
    expect(getValues('ja')).toEqual({ title: 'こんにちは' });
    expect(getValues('fr')).toBeUndefined();
    expect(getSlug('ja')).toBe('konnichiwa');
    // Falls back to the canonical slug
    expect(getSlug('en')).toBe('hello');
    expect(getSharedValues('ja')).toBe(sharedValues);
    expect(getDraftSharedValues).toHaveBeenCalledWith(draft, 'ja');
  });

  test('reads the values of a rich text editor component, without the shared values', () => {
    contexts['entry-draft'] = { current: draft };
    contexts['field-editor'] = { valueStoreKey: 'extraValues' };

    const { getValues, getSharedValues } = getEditorEntryValues();

    expect(getValues('en')).toEqual({ src: 'a.png' });
    expect(getSharedValues('ja')).toBeUndefined();
    expect(getDraftSharedValues).not.toHaveBeenCalled();
  });

  test('reads the entry of the row in the bulk editor, which has no draft', () => {
    contexts['entry-draft'] = { current: undefined };
    contexts['bulk-edit-row'] = { values: { title: 'Row' }, slug: 'row' };
    vi.mocked(getDraftSharedValues).mockReturnValue(undefined);

    const { getValues, getSharedValues, getSlug } = getEditorEntryValues();

    expect(getValues('en')).toEqual({ title: 'Row' });
    expect(getSlug('en')).toBe('row');
    expect(getSharedValues('en')).toBeUndefined();
    expect(getDraftSharedValues).toHaveBeenCalledWith(undefined, 'en');
  });

  test('reads the current draft and row on each call, so a reaction tracks them', () => {
    const entryDraft = { current: /** @type {EntryDraft | undefined} */ (undefined) };
    const row = { values: { title: 'Row' }, slug: 'row' };

    contexts['entry-draft'] = entryDraft;
    contexts['bulk-edit-row'] = row;

    const { getValues, getSlug } = getEditorEntryValues();

    expect(getValues('en')).toEqual({ title: 'Row' });

    row.values = { title: 'Edited' };
    row.slug = 'edited';

    expect(getValues('en')).toEqual({ title: 'Edited' });
    expect(getSlug('en')).toBe('edited');

    entryDraft.current = draft;

    expect(getValues('en')).toEqual({ title: 'Hello' });
  });

  test('returns nothing without a draft or a row', () => {
    const { getValues, getSlug } = getEditorEntryValues();

    expect(getValues('en')).toBeUndefined();
    expect(getSlug('en')).toBeUndefined();
  });
});
