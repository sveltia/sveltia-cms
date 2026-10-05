/* eslint-disable jsdoc/require-jsdoc, jsdoc/require-returns-description */

import { beforeEach, describe, expect, test, vi } from 'vitest';

import { validateStringField } from './validate';

/**
 * @import { StringField, TextField } from '$lib/types/public';
 */

/** @type {Pick<StringField, 'widget' | 'name'>} */
const baseFieldConfig = {
  widget: 'string',
  name: 'test',
};

/**
 * Create a mock input element with type validation.
 * @param {string} type Input type.
 * @param {string} value Input value.
 * @returns {{type: string, value: string, validity: {typeMismatch: boolean}}}
 */
const createMockInputElement = (type, value) => {
  const element = {
    type,
    value,
    validity: { typeMismatch: false },
  };

  // Validate type based on native HTML5 input validation rules
  if (type === 'email') {
    // Simple email validation - must have @
    element.validity.typeMismatch = !/.+@.+/.test(value);
  } else if (type === 'url') {
    // Simple URL validation - must be valid URL
    try {
      // eslint-disable-next-line no-new
      new URL(value);
    } catch {
      element.validity.typeMismatch = true;
    }
  } else if (type === 'number') {
    // Number validation - must be numeric
    element.validity.typeMismatch = Number.isNaN(Number(value));
  }

  return element;
};

beforeEach(() => {
  // Set up document mock for type validation tests
  vi.stubGlobal('document', {
    createElement: (/** @type {string} */ tagName) => {
      if (tagName === 'input') {
        // Return a default text input
        return {
          type: 'text',
          value: '',
          validity: { typeMismatch: false },
        };
      }

      return {};
    },
  });
});

describe('Test validateStringField()', () => {
  test('should return valid result for value within limits', () => {
    /** @type {StringField} */
    const fieldConfig = {
      ...baseFieldConfig,
      minlength: 5,
      maxlength: 10,
    };

    const value = 'hello';
    const result = validateStringField({ fieldConfig, locale: 'en', value });

    expect(result).toEqual({
      validity: {
        tooShort: false,
        tooLong: false,
        typeMismatch: false,
      },
      detail: {
        count: 5,
        hasMin: true,
        hasMax: true,
        invalid: false,
      },
    });
  });

  test('should return tooShort=true for value below minimum length', () => {
    /** @type {StringField} */
    const fieldConfig = {
      ...baseFieldConfig,
      minlength: 5,
      maxlength: 10,
    };

    const value = 'hi';
    const result = validateStringField({ fieldConfig, locale: 'en', value });

    expect(result).toEqual({
      validity: {
        tooShort: true,
        tooLong: false,
        typeMismatch: false,
      },
      detail: {
        count: 2,
        hasMin: true,
        hasMax: true,
        invalid: true,
      },
    });
  });

  test('should return tooLong=true for value above maximum length', () => {
    /** @type {StringField} */
    const fieldConfig = {
      ...baseFieldConfig,
      minlength: 5,
      maxlength: 10,
    };

    const value = 'this is a very long string';
    const result = validateStringField({ fieldConfig, locale: 'en', value });

    expect(result).toEqual({
      validity: {
        tooShort: false,
        tooLong: true,
        typeMismatch: false,
      },
      detail: {
        count: 26,
        hasMin: true,
        hasMax: true,
        invalid: true,
      },
    });
  });

  test('should handle undefined value as empty string', () => {
    /** @type {StringField} */
    const fieldConfig = {
      ...baseFieldConfig,
      minlength: 1,
      maxlength: 10,
    };

    const value = undefined;
    const result = validateStringField({ fieldConfig, locale: 'en', value });

    expect(result).toEqual({
      validity: {
        tooShort: true,
        tooLong: false,
        typeMismatch: false,
      },
      detail: {
        count: 0,
        hasMin: true,
        hasMax: true,
        invalid: true,
      },
    });
  });

  test('should handle empty string', () => {
    /** @type {StringField} */
    const fieldConfig = {
      ...baseFieldConfig,
      minlength: 1,
      maxlength: 10,
    };

    const value = '';
    const result = validateStringField({ fieldConfig, locale: 'en', value });

    expect(result).toEqual({
      validity: {
        tooShort: true,
        tooLong: false,
        typeMismatch: false,
      },
      detail: {
        count: 0,
        hasMin: true,
        hasMax: true,
        invalid: true,
      },
    });
  });

  test('should trim whitespace when counting characters', () => {
    /** @type {StringField} */
    const fieldConfig = {
      ...baseFieldConfig,
      minlength: 3,
      maxlength: 10,
    };

    const value = '  hello  ';
    const result = validateStringField({ fieldConfig, locale: 'en', value });

    expect(result).toEqual({
      validity: {
        tooShort: false,
        tooLong: false,
        typeMismatch: false,
      },
      detail: {
        count: 5,
        hasMin: true,
        hasMax: true,
        invalid: false,
      },
    });
  });

  test('should handle no minimum length constraint', () => {
    /** @type {StringField} */
    const fieldConfig = {
      ...baseFieldConfig,
      maxlength: 10,
    };

    const value = 'hi';
    const result = validateStringField({ fieldConfig, locale: 'en', value });

    expect(result).toEqual({
      validity: {
        tooShort: false,
        tooLong: false,
        typeMismatch: false,
      },
      detail: {
        count: 2,
        hasMin: false,
        hasMax: true,
        invalid: false,
      },
    });
  });

  test('should handle no maximum length constraint', () => {
    /** @type {StringField} */
    const fieldConfig = {
      ...baseFieldConfig,
      minlength: 3,
    };

    const value = 'hello world';
    const result = validateStringField({ fieldConfig, locale: 'en', value });

    expect(result).toEqual({
      validity: {
        tooShort: false,
        tooLong: false,
        typeMismatch: false,
      },
      detail: {
        count: 11,
        hasMin: true,
        hasMax: false,
        invalid: false,
      },
    });
  });

  test('should handle no length constraints', () => {
    /** @type {StringField} */
    const fieldConfig = {
      ...baseFieldConfig,
    };

    const value = 'any length string';
    const result = validateStringField({ fieldConfig, locale: 'en', value });

    expect(result).toEqual({
      validity: {
        tooShort: false,
        tooLong: false,
        typeMismatch: false,
      },
      detail: {
        count: 17,
        hasMin: false,
        hasMax: false,
        invalid: false,
      },
    });
  });

  test('should handle invalid minlength/maxlength configuration', () => {
    /** @type {StringField} */
    const fieldConfig = {
      ...baseFieldConfig,
      minlength: 10,
      maxlength: 5, // max < min
    };

    const value = 'hello';
    const result = validateStringField({ fieldConfig, locale: 'en', value });

    expect(result).toEqual({
      validity: {
        tooShort: false,
        tooLong: false,
        typeMismatch: false,
      },
      detail: {
        count: 5,
        hasMin: false, // invalid constraint
        hasMax: false, // invalid constraint
        invalid: false,
      },
    });
  });

  test('should count Unicode characters correctly', () => {
    /** @type {StringField} */
    const fieldConfig = {
      ...baseFieldConfig,
      minlength: 3,
      maxlength: 10,
    };

    const value = '🚀🌟✨'; // 3 emoji characters
    const result = validateStringField({ fieldConfig, locale: 'en', value });

    expect(result).toEqual({
      validity: {
        tooShort: false,
        tooLong: false,
        typeMismatch: false,
      },
      detail: {
        count: 3,
        hasMin: true,
        hasMax: true,
        invalid: false,
      },
    });
  });

  describe('Type validation (URL, Email, etc)', () => {
    test('should validate valid email address', () => {
      // Mock document.createElement to return an input element with type validation
      vi.stubGlobal('document', {
        createElement: (/** @type {string} */ tagName) => {
          if (tagName === 'input') {
            return createMockInputElement('email', 'user@example.com');
          }

          return {};
        },
      });

      /** @type {StringField} */
      const fieldConfig = {
        ...baseFieldConfig,
        type: 'email',
      };

      const value = 'user@example.com';
      const result = validateStringField({ fieldConfig, locale: 'en', value });

      expect(result).toEqual({
        validity: {
          tooShort: false,
          tooLong: false,
          typeMismatch: false,
        },
        detail: {
          count: 16,
          hasMin: false,
          hasMax: false,
          invalid: false,
        },
      });
    });

    test('should reject invalid email address without domain dot', () => {
      // Mock document.createElement to return an input element with type validation
      vi.stubGlobal('document', {
        createElement: (/** @type {string} */ tagName) => {
          if (tagName === 'input') {
            return createMockInputElement('email', 'user@example');
          }

          return {};
        },
      });

      /** @type {StringField} */
      const fieldConfig = {
        ...baseFieldConfig,
        type: 'email',
      };

      const value = 'user@example';
      const result = validateStringField({ fieldConfig, locale: 'en', value });

      expect(result).toEqual({
        validity: {
          tooShort: false,
          tooLong: false,
          typeMismatch: true,
        },
        detail: {
          count: 12,
          hasMin: false,
          hasMax: false,
          invalid: true,
        },
      });
    });

    test('should reject invalid email format', () => {
      // Mock document.createElement to return an input element with type validation
      vi.stubGlobal('document', {
        createElement: (/** @type {string} */ tagName) => {
          if (tagName === 'input') {
            return createMockInputElement('email', 'not-an-email');
          }

          return {};
        },
      });

      /** @type {StringField} */
      const fieldConfig = {
        ...baseFieldConfig,
        type: 'email',
      };

      const value = 'not-an-email';
      const result = validateStringField({ fieldConfig, locale: 'en', value });

      expect(result).toEqual({
        validity: {
          tooShort: false,
          tooLong: false,
          typeMismatch: true,
        },
        detail: {
          count: 12,
          hasMin: false,
          hasMax: false,
          invalid: true,
        },
      });
    });

    test('should validate valid URL', () => {
      // Mock document.createElement to return an input element with type validation
      vi.stubGlobal('document', {
        createElement: (/** @type {string} */ tagName) => {
          if (tagName === 'input') {
            return createMockInputElement('url', 'https://example.com');
          }

          return {};
        },
      });

      /** @type {StringField} */
      const fieldConfig = {
        ...baseFieldConfig,
        type: 'url',
      };

      const value = 'https://example.com';
      const result = validateStringField({ fieldConfig, locale: 'en', value });

      expect(result).toEqual({
        validity: {
          tooShort: false,
          tooLong: false,
          typeMismatch: false,
        },
        detail: {
          count: 19,
          hasMin: false,
          hasMax: false,
          invalid: false,
        },
      });
    });

    test('should reject invalid URL', () => {
      // Mock document.createElement to return an input element with type validation
      vi.stubGlobal('document', {
        createElement: (/** @type {string} */ tagName) => {
          if (tagName === 'input') {
            return createMockInputElement('url', 'not a url');
          }

          return {};
        },
      });

      /** @type {StringField} */
      const fieldConfig = {
        ...baseFieldConfig,
        type: 'url',
      };

      const value = 'not a url';
      const result = validateStringField({ fieldConfig, locale: 'en', value });

      expect(result).toEqual({
        validity: {
          tooShort: false,
          tooLong: false,
          typeMismatch: true,
        },
        detail: {
          count: 9,
          hasMin: false,
          hasMax: false,
          invalid: true,
        },
      });
    });

    test('should not validate type for text widget type', () => {
      // Mock document.createElement to return an input element with type validation
      vi.stubGlobal('document', {
        createElement: (/** @type {string} */ tagName) => {
          if (tagName === 'input') {
            // Even though we set type=text, validation should not happen
            return {
              type: 'text',
              value: 'any text',
              validity: { typeMismatch: false },
            };
          }

          return {};
        },
      });

      /** @type {StringField} */
      const fieldConfig = {
        ...baseFieldConfig,
        widget: 'string',
        type: 'text',
      };

      const value = 'any text';
      const result = validateStringField({ fieldConfig, locale: 'en', value });

      expect(result).toEqual({
        validity: {
          tooShort: false,
          tooLong: false,
          typeMismatch: false,
        },
        detail: {
          count: 8,
          hasMin: false,
          hasMax: false,
          invalid: false,
        },
      });
    });

    test('should skip type validation for empty value', () => {
      // Mock should not be called for empty value
      vi.stubGlobal('document', {
        createElement: (/** @type {string} */ tagName) => {
          if (tagName === 'input') {
            return createMockInputElement('email', '');
          }

          return {};
        },
      });

      /** @type {StringField} */
      const fieldConfig = {
        ...baseFieldConfig,
        type: 'email',
      };

      const value = '';
      const result = validateStringField({ fieldConfig, locale: 'en', value });

      expect(result).toEqual({
        validity: {
          tooShort: false,
          tooLong: false,
          typeMismatch: false,
        },
        detail: {
          count: 0,
          hasMin: false,
          hasMax: false,
          invalid: false,
        },
      });
    });

    test('should skip type validation for undefined value', () => {
      // Mock should not be called for undefined value
      vi.stubGlobal('document', {
        createElement: (/** @type {string} */ tagName) => {
          if (tagName === 'input') {
            return createMockInputElement('email', '');
          }

          return {};
        },
      });

      /** @type {StringField} */
      const fieldConfig = {
        ...baseFieldConfig,
        type: 'email',
      };

      const value = undefined;
      const result = validateStringField({ fieldConfig, locale: 'en', value });

      expect(result).toEqual({
        validity: {
          tooShort: false,
          tooLong: false,
          typeMismatch: false,
        },
        detail: {
          count: 0,
          hasMin: false,
          hasMax: false,
          invalid: false,
        },
      });
    });

    describe('Prefix and Suffix handling', () => {
      test('should strip prefix before type validation', () => {
        // Mock document.createElement to validate email after prefix removal
        vi.stubGlobal('document', {
          createElement: (/** @type {string} */ tagName) => {
            if (tagName === 'input') {
              return createMockInputElement('email', 'user@example.com');
            }

            return {};
          },
        });

        /** @type {StringField} */
        const fieldConfig = {
          ...baseFieldConfig,
          type: 'email',
          prefix: 'Contact: ',
        };

        const value = 'Contact: user@example.com';
        const result = validateStringField({ fieldConfig, locale: 'en', value });

        expect(result).toEqual({
          validity: {
            tooShort: false,
            tooLong: false,
            typeMismatch: false,
          },
          detail: {
            count: 16,
            hasMin: false,
            hasMax: false,
            invalid: false,
          },
        });
      });

      test('should strip suffix before type validation', () => {
        // Mock document.createElement to validate URL after suffix removal
        vi.stubGlobal('document', {
          createElement: (/** @type {string} */ tagName) => {
            if (tagName === 'input') {
              return createMockInputElement('url', 'https://example.com/page');
            }

            return {};
          },
        });

        /** @type {StringField} */
        const fieldConfig = {
          ...baseFieldConfig,
          type: 'url',
          suffix: '.html',
        };

        const value = 'https://example.com/page.html';
        const result = validateStringField({ fieldConfig, locale: 'en', value });

        expect(result).toEqual({
          validity: {
            tooShort: false,
            tooLong: false,
            typeMismatch: false,
          },
          detail: {
            count: 24,
            hasMin: false,
            hasMax: false,
            invalid: false,
          },
        });
      });

      test('should strip both prefix and suffix before type validation', () => {
        // Mock document.createElement to validate email after prefix/suffix removal
        vi.stubGlobal('document', {
          createElement: (/** @type {string} */ tagName) => {
            if (tagName === 'input') {
              return createMockInputElement('email', 'user@example.com');
            }

            return {};
          },
        });

        /** @type {StringField} */
        const fieldConfig = {
          ...baseFieldConfig,
          type: 'email',
          prefix: '[',
          suffix: ']',
        };

        const value = '[user@example.com]';
        const result = validateStringField({ fieldConfig, locale: 'en', value });

        expect(result).toEqual({
          validity: {
            tooShort: false,
            tooLong: false,
            typeMismatch: false,
          },
          detail: {
            count: 16,
            hasMin: false,
            hasMax: false,
            invalid: false,
          },
        });
      });

      test('should leave the prefix and suffix out of the count', () => {
        /** @type {StringField} */
        const fieldConfig = {
          ...baseFieldConfig,
          prefix: 'Room ',
          suffix: ' (East)',
          maxlength: 3,
        };

        const value = 'Room 101 (East)';
        const result = validateStringField({ fieldConfig, locale: 'en', value });

        expect(result.detail.count).toBe(3);
        expect(result.validity.tooLong).toBe(false);
      });

      test('should count the prefix and suffix of a text field, which has neither', () => {
        /** @type {TextField} */
        const fieldConfig = {
          name: 'notes',
          widget: 'text',
          maxlength: 3,
          // @ts-ignore
          prefix: 'Room ',
        };

        const value = 'Room 101';
        const result = validateStringField({ fieldConfig, locale: 'en', value });

        expect(result.detail.count).toBe(8);
        expect(result.validity.tooLong).toBe(true);
      });

      test('should handle missing prefix gracefully', () => {
        // Mock document.createElement to validate email when prefix is not present
        vi.stubGlobal('document', {
          createElement: (/** @type {string} */ tagName) => {
            if (tagName === 'input') {
              return createMockInputElement('email', 'user@example.com');
            }

            return {};
          },
        });

        /** @type {StringField} */
        const fieldConfig = {
          ...baseFieldConfig,
          type: 'email',
          prefix: 'Email: ',
        };

        const value = 'user@example.com'; // prefix not present
        const result = validateStringField({ fieldConfig, locale: 'en', value });

        expect(result).toEqual({
          validity: {
            tooShort: false,
            tooLong: false,
            typeMismatch: false,
          },
          detail: {
            count: 16,
            hasMin: false,
            hasMax: false,
            invalid: false,
          },
        });
      });

      test('should handle missing suffix gracefully', () => {
        // Mock document.createElement to validate email when suffix is not present
        vi.stubGlobal('document', {
          createElement: (/** @type {string} */ tagName) => {
            if (tagName === 'input') {
              return createMockInputElement('email', 'user@example.com');
            }

            return {};
          },
        });

        /** @type {StringField} */
        const fieldConfig = {
          ...baseFieldConfig,
          type: 'email',
          suffix: '!',
        };

        const value = 'user@example.com'; // suffix not present
        const result = validateStringField({ fieldConfig, locale: 'en', value });

        expect(result).toEqual({
          validity: {
            tooShort: false,
            tooLong: false,
            typeMismatch: false,
          },
          detail: {
            count: 16,
            hasMin: false,
            hasMax: false,
            invalid: false,
          },
        });
      });
    });

    describe('Email domain validation', () => {
      test('should require domain to have a dot', () => {
        // Mock document.createElement
        vi.stubGlobal('document', {
          createElement: (/** @type {string} */ tagName) => {
            if (tagName === 'input') {
              return createMockInputElement('email', 'user@localhost');
            }

            return {};
          },
        });

        /** @type {StringField} */
        const fieldConfig = {
          ...baseFieldConfig,
          type: 'email',
        };

        const value = 'user@localhost';
        const result = validateStringField({ fieldConfig, locale: 'en', value });

        expect(result.validity.typeMismatch).toBe(true);
        expect(result.detail.invalid).toBe(true);
      });

      test('should allow domain with multiple dots', () => {
        // Mock document.createElement
        vi.stubGlobal('document', {
          createElement: (/** @type {string} */ tagName) => {
            if (tagName === 'input') {
              return createMockInputElement('email', 'user@mail.example.co.uk');
            }

            return {};
          },
        });

        /** @type {StringField} */
        const fieldConfig = {
          ...baseFieldConfig,
          type: 'email',
        };

        const value = 'user@mail.example.co.uk';
        const result = validateStringField({ fieldConfig, locale: 'en', value });

        expect(result.validity.typeMismatch).toBe(false);
        expect(result.detail.invalid).toBe(false);
      });

      test('should allow domain with subdomain', () => {
        // Mock document.createElement
        vi.stubGlobal('document', {
          createElement: (/** @type {string} */ tagName) => {
            if (tagName === 'input') {
              return createMockInputElement('email', 'user@mail.example.com');
            }

            return {};
          },
        });

        /** @type {StringField} */
        const fieldConfig = {
          ...baseFieldConfig,
          type: 'email',
        };

        const value = 'user@mail.example.com';
        const result = validateStringField({ fieldConfig, locale: 'en', value });

        expect(result.validity.typeMismatch).toBe(false);
        expect(result.detail.invalid).toBe(false);
      });

      test('should handle email with no @ symbol', () => {
        // Mock document.createElement
        vi.stubGlobal('document', {
          createElement: (/** @type {string} */ tagName) => {
            if (tagName === 'input') {
              return createMockInputElement('email', 'userexample.com');
            }

            return {};
          },
        });

        /** @type {StringField} */
        const fieldConfig = {
          ...baseFieldConfig,
          type: 'email',
        };

        const value = 'userexample.com';
        const result = validateStringField({ fieldConfig, locale: 'en', value });

        expect(result.validity.typeMismatch).toBe(true);
        expect(result.detail.invalid).toBe(true);
      });
    });
  });
});
