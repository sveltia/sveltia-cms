// @ts-nocheck

import { describe, expect, it } from 'vitest';

import { DEFAULT_VALIDITY, finalizeValidity } from '$lib/services/contents/draft/validate/validity';

describe('DEFAULT_VALIDITY', () => {
  it('should have all validity flags set to false', () => {
    expect(DEFAULT_VALIDITY).toEqual({
      valueMissing: false,
      tooShort: false,
      tooLong: false,
      rangeUnderflow: false,
      rangeOverflow: false,
      patternMismatch: false,
      typeMismatch: false,
      customError: false,
    });
  });

  it('should be a new object each time (not mutated)', () => {
    const copy1 = { ...DEFAULT_VALIDITY };
    const copy2 = { ...DEFAULT_VALIDITY };

    expect(copy1).toEqual(copy2);
    copy1.valueMissing = true;
    expect(copy2.valueMissing).toBe(false);
  });
});

describe('finalizeValidity', () => {
  it('should add a valid property that reflects all other properties', () => {
    expect(finalizeValidity({ ...DEFAULT_VALIDITY }).valid).toBe(true);
    expect(finalizeValidity({ ...DEFAULT_VALIDITY, valueMissing: true }).valid).toBe(false);
  });

  it('should return false if any validity flag is true', () => {
    const validity = finalizeValidity({
      valueMissing: false,
      tooShort: false,
      tooLong: true,
      rangeUnderflow: false,
      rangeOverflow: false,
      patternMismatch: false,
      typeMismatch: false,
    });

    expect(validity.valid).toBe(false);
  });

  it('should keep the other properties as plain own properties', () => {
    const validity = finalizeValidity({ ...DEFAULT_VALIDITY, valueMissing: true });

    expect(validity.valueMissing).toBe(true);
    expect(validity.tooShort).toBe(false);
    expect(Object.keys(validity)).toContain('valid');
  });
});
