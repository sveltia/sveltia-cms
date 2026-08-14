// @ts-nocheck
import { describe, expect, it } from 'vitest';

import { getLocalizedRelationValue } from './locale';

/**
 * Relation field with a `{{locale}}` prefixed `value_field` option.
 */
const localizedField = {
  name: 'category',
  widget: 'relation',
  collection: 'categories',
  value_field: '{{locale}}/{{slug}}',
};

describe('contents/fields/relation/helpers/locale', () => {
  describe('getLocalizedRelationValue', () => {
    it('should replace the source locale prefix with the target locale', () => {
      expect(
        getLocalizedRelationValue({
          fieldConfig: localizedField,
          value: 'fr/category-a',
          sourceLocale: 'fr',
          targetLocale: 'pl',
        }),
      ).toBe('pl/category-a');
    });

    it('should keep a value that doesn’t have the source locale prefix', () => {
      expect(
        getLocalizedRelationValue({
          fieldConfig: localizedField,
          value: 'en/category-a',
          sourceLocale: 'fr',
          targetLocale: 'pl',
        }),
      ).toBe('en/category-a');
    });

    it('should keep a value if the `value_field` option has no {{locale}} prefix', () => {
      expect(
        getLocalizedRelationValue({
          fieldConfig: { ...localizedField, value_field: '{{slug}}' },
          value: 'fr/category-a',
          sourceLocale: 'fr',
          targetLocale: 'pl',
        }),
      ).toBe('fr/category-a');
    });

    it('should keep a value if the `value_field` option is omitted', () => {
      const { value_field: _valueField, ...fieldConfig } = localizedField;

      expect(
        getLocalizedRelationValue({
          fieldConfig,
          value: 'fr/category-a',
          sourceLocale: 'fr',
          targetLocale: 'pl',
        }),
      ).toBe('fr/category-a');
    });

    it('should keep a value for a non-Relation field', () => {
      expect(
        getLocalizedRelationValue({
          fieldConfig: { name: 'path', widget: 'string' },
          value: 'fr/category-a',
          sourceLocale: 'fr',
          targetLocale: 'pl',
        }),
      ).toBe('fr/category-a');
    });

    it('should keep a non-string value', () => {
      [undefined, null, 0, [], {}].forEach((value) => {
        expect(
          getLocalizedRelationValue({
            fieldConfig: localizedField,
            value,
            sourceLocale: 'fr',
            targetLocale: 'pl',
          }),
        ).toBe(value);
      });
    });
  });
});
