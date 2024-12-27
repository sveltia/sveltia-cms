import { describe, expect, test } from 'vitest';
import { isFieldRequired } from '$lib/services/contents/entry/fields';

describe('Test isFieldRequired()', () => {
  const name = 'title';
  const locale = 'en';

  test('required: undefined', () => {
    expect(isFieldRequired({ fieldConfig: { name }, locale })).toBe(true);
  });

  test('required: boolean', () => {
    expect(isFieldRequired({ fieldConfig: { name, required: true }, locale })).toBe(true);
    expect(isFieldRequired({ fieldConfig: { name, required: false }, locale })).toBe(false);
  });

  test('required: array', () => {
    expect(isFieldRequired({ fieldConfig: { name, required: ['en'] }, locale })).toBe(true);
    expect(isFieldRequired({ fieldConfig: { name, required: ['ja'] }, locale })).toBe(false);
    expect(isFieldRequired({ fieldConfig: { name, required: ['en', 'ja'] }, locale })).toBe(true);
    expect(isFieldRequired({ fieldConfig: { name, required: [] }, locale })).toBe(false);
  });
});
