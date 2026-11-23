import { describe, expect, test, vi } from 'vitest';

import { validateFields } from '$lib/services/contents/draft/validate/fields';
import { validateComponentValues } from '$lib/services/contents/fields/rich-text/components/validate';

vi.mock('$lib/services/contents/draft/validate/fields', () => ({ validateFields: vi.fn() }));

/**
 * Create a draft with existing validation results.
 * @returns {any} Draft.
 */
const createDraft = () => ({
  validities: { en: { title: { valid: true } }, fr: {} },
  validationMessages: { en: { title: [] }, fr: {} },
});

describe('validateComponentValues()', () => {
  test('merges the results into the draft and reports the component as valid', () => {
    const draft = createDraft();

    vi.mocked(validateFields).mockReturnValue(
      /** @type {any} */ ({
        validities: {
          en: { 'body:c1:src': { valid: true }, 'body:c2:src': { valid: false } },
          fr: { 'body:c1:src': { valid: true } },
        },
        validationMessages: { en: { 'body:c2:src': ['Required'] }, fr: {} },
      }),
    );

    expect(validateComponentValues({ draft, locale: 'en', keyPathPrefix: 'body:c1:' })).toBe(true);
    expect(validateFields).toHaveBeenCalledWith('extraValues', { draft });
    expect(draft.validities).toEqual({
      en: {
        title: { valid: true },
        'body:c1:src': { valid: true },
        'body:c2:src': { valid: false },
      },
      fr: { 'body:c1:src': { valid: true } },
    });
    expect(draft.validationMessages).toEqual({
      en: { title: [], 'body:c2:src': ['Required'] },
      fr: {},
    });
  });

  test('reports the component as invalid', () => {
    vi.mocked(validateFields).mockReturnValue(
      /** @type {any} */ ({
        validities: { en: { 'body:c1:src': { valid: false } } },
        validationMessages: { en: { 'body:c1:src': ['Required'] } },
      }),
    );

    expect(
      validateComponentValues({ draft: createDraft(), locale: 'en', keyPathPrefix: 'body:c1:' }),
    ).toBe(false);
  });

  test('reports the component as valid without results in its locale', () => {
    vi.mocked(validateFields).mockReturnValue(
      /** @type {any} */ ({ validities: {}, validationMessages: {} }),
    );

    expect(
      validateComponentValues({ draft: createDraft(), locale: 'de', keyPathPrefix: 'body:c1:' }),
    ).toBe(true);
  });
});
