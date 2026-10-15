import { describe, expect, test } from 'vitest';

import { isInEditorComponent } from '$lib/services/contents/editor/field-context';

describe('isInEditorComponent()', () => {
  test('returns true for a field storing its values in `extraValues`', () => {
    expect(isInEditorComponent('extraValues')).toBe(true);
  });

  test('returns false for an entry field', () => {
    expect(isInEditorComponent('currentValues')).toBe(false);
    expect(isInEditorComponent(undefined)).toBe(false);
  });
});
