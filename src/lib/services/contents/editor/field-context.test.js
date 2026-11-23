import { describe, expect, test, vi } from 'vitest';

import {
  getFieldEditorContext,
  isInEditorComponent,
  setFieldEditorContext,
} from '$lib/services/contents/editor/field-context';

const { getContext, setContext } = vi.hoisted(() => ({ getContext: vi.fn(), setContext: vi.fn() }));

vi.mock('svelte', async (importOriginal) => ({
  .../** @type {object} */ (await importOriginal()),
  getContext,
  setContext,
}));

describe('isInEditorComponent()', () => {
  test('returns true for a field storing its values in `extraValues`', () => {
    expect(isInEditorComponent('extraValues')).toBe(true);
  });

  test('returns false for an entry field', () => {
    expect(isInEditorComponent('currentValues')).toBe(false);
    expect(isInEditorComponent(undefined)).toBe(false);
  });
});

describe('getFieldEditorContext()', () => {
  test('returns the context of the nearest field editor', () => {
    const context = { parentComponentNames: [], valueStoreKey: 'currentValues' };

    getContext.mockReturnValue(context);
    expect(getFieldEditorContext()).toBe(context);
    expect(getContext).toHaveBeenCalledWith('field-editor');
  });

  test('returns an empty object outside of a field editor', () => {
    getContext.mockReturnValue(undefined);
    expect(getFieldEditorContext()).toEqual({});
  });
});

describe('setFieldEditorContext()', () => {
  test('provides the context under the field editor key', () => {
    const context = /** @type {any} */ ({ parentComponentNames: [], valueStoreKey: 'extraValues' });

    setFieldEditorContext(context);
    expect(setContext).toHaveBeenCalledWith('field-editor', context);
  });
});
