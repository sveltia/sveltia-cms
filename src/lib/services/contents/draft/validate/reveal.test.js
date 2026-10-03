import { describe, expect, test, vi } from 'vitest';

import { validateEntry } from '$lib/services/contents/draft/validate';
import { awaitCustomFieldValidations } from '$lib/services/contents/draft/validate/custom-fields';
import {
  countInvalidFields,
  hasInvalidFields,
  revealInvalidFields,
  validateAndRevealErrors,
} from '$lib/services/contents/draft/validate/reveal';
import { expandInvalidFields } from '$lib/services/contents/editor/fields';
import { awaitPendingFieldUpdates } from '$lib/services/contents/editor/pending';

vi.mock('$lib/services/contents/draft/validate');
vi.mock('$lib/services/contents/draft/validate/custom-fields');
vi.mock('$lib/services/contents/editor/fields');
vi.mock('$lib/services/contents/editor/pending');

const draft = /** @type {any} */ ({ collectionName: 'posts' });

describe('contents/draft/validate/reveal', () => {
  describe('revealInvalidFields()', () => {
    test('leaves the fields alone when the draft is valid', () => {
      vi.mocked(validateEntry).mockReturnValue(true);

      expect(revealInvalidFields({ draft })).toBe(true);
      expect(validateEntry).toHaveBeenCalledWith({ draft, enforceRequired: true });
      expect(expandInvalidFields).not.toHaveBeenCalled();
    });

    test('expands the invalid fields when the draft is invalid', () => {
      vi.mocked(validateEntry).mockReturnValue(false);

      expect(revealInvalidFields({ draft, enforceRequired: false })).toBe(false);
      expect(validateEntry).toHaveBeenCalledWith({ draft, enforceRequired: false });
      expect(expandInvalidFields).toHaveBeenCalledWith({ draft });
    });
  });

  describe('validateAndRevealErrors()', () => {
    test('waits for the field updates and the custom validations before validating', async () => {
      /** @type {string[]} */
      const calls = [];

      vi.mocked(awaitPendingFieldUpdates).mockImplementation(async () => {
        calls.push('fields');
      });
      vi.mocked(awaitCustomFieldValidations).mockImplementation(async () => {
        calls.push('custom');
      });
      vi.mocked(validateEntry).mockImplementation(() => {
        calls.push('validate');

        return false;
      });

      expect(await validateAndRevealErrors({ draft })).toBe(false);
      expect(calls).toEqual(['fields', 'custom', 'validate']);
      expect(validateEntry).toHaveBeenCalledWith({ draft, enforceRequired: true });
      expect(expandInvalidFields).toHaveBeenCalledWith({ draft });
    });

    test('can skip waiting for the field updates', async () => {
      vi.mocked(validateEntry).mockReturnValue(true);

      expect(
        await validateAndRevealErrors({ draft, enforceRequired: false, awaitFieldUpdates: false }),
      ).toBe(true);
      expect(awaitPendingFieldUpdates).not.toHaveBeenCalled();
      expect(awaitCustomFieldValidations).toHaveBeenCalled();
      expect(validateEntry).toHaveBeenCalledWith({ draft, enforceRequired: false });
      expect(expandInvalidFields).not.toHaveBeenCalled();
    });
  });

  describe('hasInvalidFields()', () => {
    test('checks whether any field of a locale is invalid', () => {
      expect(hasInvalidFields(undefined)).toBe(false);
      expect(hasInvalidFields({})).toBe(false);
      expect(hasInvalidFields(/** @type {any} */ ({ title: { valid: true } }))).toBe(false);
      expect(
        hasInvalidFields(/** @type {any} */ ({ title: { valid: true }, body: { valid: false } })),
      ).toBe(true);
    });
  });

  describe('countInvalidFields()', () => {
    test('counts the invalid fields across the locales', () => {
      expect(countInvalidFields({})).toBe(0);
      expect(
        countInvalidFields(
          /** @type {any} */ ({
            en: { title: { valid: false }, body: { valid: true } },
            ja: { title: { valid: false }, body: { valid: false } },
            fr: {},
          }),
        ),
      ).toBe(3);
    });
  });
});
