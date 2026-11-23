import { describe, expect, test, vi } from 'vitest';

import { getResetConfirmation, getResetLabel } from '$lib/services/contents/editor/reset';

vi.mock('@sveltia/i18n', () => ({
  _: vi.fn((key, { values } = {}) => (values ? `${key}(${values.locale})` : key)),
}));
vi.mock('$lib/services/contents/i18n', () => ({
  getLocaleLabel: vi.fn((locale) => (locale === 'fr' ? 'French' : undefined)),
}));

describe('getResetLabel()', () => {
  test('labels an action for its scope', () => {
    expect(getResetLabel('revert', 'field')).toBe('revert_changes');
    expect(getResetLabel('clear', 'field')).toBe('clear');
    expect(getResetLabel('revert', 'locale')).toBe('revert_changes');
    expect(getResetLabel('clear', 'locale')).toBe('clear_all');
    expect(getResetLabel('revert', 'entry')).toBe('revert_all_changes');
    expect(getResetLabel('restore', 'entry')).toBe('restore_default');
  });
});

describe('getResetConfirmation()', () => {
  test('names the locale the action applies to', () => {
    expect(getResetConfirmation('revert', 'fr')).toBe('confirm_reverting_changes_x_locale(French)');
    expect(getResetConfirmation('restore', 'x-custom')).toBe(
      'confirm_restoring_defaults_x_locale(x-custom)',
    );
  });

  test('refers to the entry for every locale or a monolingual entry', () => {
    expect(getResetConfirmation('clear')).toBe('confirm_clearing_fields');
    expect(getResetConfirmation('clear', '_default')).toBe('confirm_clearing_fields');
  });
});
