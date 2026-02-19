/* eslint-disable jsdoc/require-jsdoc, jsdoc/require-returns-description */

import { beforeEach, describe, expect, test, vi } from 'vitest';

import { validateStringField } from './validate';

/**
 * @import { StringField } from '$lib/types/public';
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
    const result = validateStringField({ fieldConfig, value });

    expect(result).toEqual({
      count: 5,
      hasMin: true,
      hasMax: true,
      invalid: false,
      validity: {
        tooShort: false,
        tooLong: false,
        typeMismatch: false,
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
    const result = validateStringField({ fieldConfig, value });

    expect(result).toEqual({
      count: 2,
      hasMin: true,
      hasMax: true,
      invalid: true,
      validity: {
        tooShort: true,
        tooLong: false,
        typeMismatch: false,
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
    const result = validateStringField({ fieldConfig, value });

    expect(result).toEqual({
      count: 26,
      hasMin: true,
      hasMax: true,
      invalid: true,
      validity: {
        tooShort: false,
        tooLong: true,
        typeMismatch: false,
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
    const result = validateStringField({ fieldConfig, value });

    expect(result).toEqual({
      count: 0,
      hasMin: true,
      hasMax: true,
      invalid: true,
      validity: {
        tooShort: true,
        tooLong: false,
        typeMismatch: false,
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
    const result = validateStringField({ fieldConfig, value });

    expect(result).toEqual({
      count: 0,
      hasMin: true,
      hasMax: true,
      invalid: true,
      validity: {
        tooShort: true,
        tooLong: false,
        typeMismatch: false,
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
    const result = validateStringField({ fieldConfig, value });

    expect(result).toEqual({
      count: 5,
      hasMin: true,
      hasMax: true,
      invalid: false,
      validity: {
        tooShort: false,
        tooLong: false,
        typeMismatch: false,
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
    const result = validateStringField({ fieldConfig, value });

    expect(result).toEqual({
      count: 2,
      hasMin: false,
      hasMax: true,
      invalid: false,
      validity: {
        tooShort: false,
        tooLong: false,
        typeMismatch: false,
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
    const result = validateStringField({ fieldConfig, value });

    expect(result).toEqual({
      count: 11,
      hasMin: true,
      hasMax: false,
      invalid: false,
      validity: {
        tooShort: false,
        tooLong: false,
        typeMismatch: false,
      },
    });
  });

  test('should handle no length constraints', () => {
    /** @type {StringField} */
    const fieldConfig = {
      ...baseFieldConfig,
    };

    const value = 'any length string';
    const result = validateStringField({ fieldConfig, value });

    expect(result).toEqual({
      count: 17,
      hasMin: false,
      hasMax: false,
      invalid: false,
      validity: {
        tooShort: false,
        tooLong: false,
        typeMismatch: false,
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
    const result = validateStringField({ fieldConfig, value });

    expect(result).toEqual({
      count: 5,
      hasMin: false, // invalid constraint
      hasMax: false, // invalid constraint
      invalid: false,
      validity: {
        tooShort: false,
        tooLong: false,
        typeMismatch: false,
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
    const result = validateStringField({ fieldConfig, value });

    expect(result).toEqual({
      count: 3,
      hasMin: true,
      hasMax: true,
      invalid: false,
      validity: {
        tooShort: false,
        tooLong: false,
        typeMismatch: false,
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
      const result = validateStringField({ fieldConfig, value });

      expect(result).toEqual({
        count: 16,
        hasMin: false,
        hasMax: false,
        invalid: false,
        validity: {
          tooShort: false,
          tooLong: false,
          typeMismatch: false,
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
      const result = validateStringField({ fieldConfig, value });

      expect(result).toEqual({
        count: 12,
        hasMin: false,
        hasMax: false,
        invalid: true,
        validity: {
          tooShort: false,
          tooLong: false,
          typeMismatch: true,
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
      const result = validateStringField({ fieldConfig, value });

      expect(result).toEqual({
        count: 12,
        hasMin: false,
        hasMax: false,
        invalid: true,
        validity: {
          tooShort: false,
          tooLong: false,
          typeMismatch: true,
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
      const result = validateStringField({ fieldConfig, value });

      expect(result).toEqual({
        count: 19,
        hasMin: false,
        hasMax: false,
        invalid: false,
        validity: {
          tooShort: false,
          tooLong: false,
          typeMismatch: false,
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
      const result = validateStringField({ fieldConfig, value });

      expect(result).toEqual({
        count: 9,
        hasMin: false,
        hasMax: false,
        invalid: true,
        validity: {
          tooShort: false,
          tooLong: false,
          typeMismatch: true,
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
      const result = validateStringField({ fieldConfig, value });

      expect(result).toEqual({
        count: 8,
        hasMin: false,
        hasMax: false,
        invalid: false,
        validity: {
          tooShort: false,
          tooLong: false,
          typeMismatch: false,
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
      const result = validateStringField({ fieldConfig, value });

      expect(result).toEqual({
        count: 0,
        hasMin: false,
        hasMax: false,
        invalid: false,
        validity: {
          tooShort: false,
          tooLong: false,
          typeMismatch: false,
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
      const result = validateStringField({ fieldConfig, value });

      expect(result).toEqual({
        count: 0,
        hasMin: false,
        hasMax: false,
        invalid: false,
        validity: {
          tooShort: false,
          tooLong: false,
          typeMismatch: false,
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
        const result = validateStringField({ fieldConfig, value });

        expect(result).toEqual({
          count: 25,
          hasMin: false,
          hasMax: false,
          invalid: false,
          validity: {
            tooShort: false,
            tooLong: false,
            typeMismatch: false,
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
        const result = validateStringField({ fieldConfig, value });

        expect(result).toEqual({
          count: 29,
          hasMin: false,
          hasMax: false,
          invalid: false,
          validity: {
            tooShort: false,
            tooLong: false,
            typeMismatch: false,
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
        const result = validateStringField({ fieldConfig, value });

        expect(result).toEqual({
          count: 18,
          hasMin: false,
          hasMax: false,
          invalid: false,
          validity: {
            tooShort: false,
            tooLong: false,
            typeMismatch: false,
          },
        });
      });

      test('should not affect count when stripping prefix/suffix', () => {
        /** @type {StringField} */
        const fieldConfig = {
          ...baseFieldConfig,
          prefix: '$ ',
        };

        const value = '$ 100';
        const result = validateStringField({ fieldConfig, value });

        expect(result.count).toBe(5);
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
        const result = validateStringField({ fieldConfig, value });

        expect(result).toEqual({
          count: 16,
          hasMin: false,
          hasMax: false,
          invalid: false,
          validity: {
            tooShort: false,
            tooLong: false,
            typeMismatch: false,
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
        const result = validateStringField({ fieldConfig, value });

        expect(result).toEqual({
          count: 16,
          hasMin: false,
          hasMax: false,
          invalid: false,
          validity: {
            tooShort: false,
            tooLong: false,
            typeMismatch: false,
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
        const result = validateStringField({ fieldConfig, value });

        expect(result.validity.typeMismatch).toBe(true);
        expect(result.invalid).toBe(true);
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
        const result = validateStringField({ fieldConfig, value });

        expect(result.validity.typeMismatch).toBe(false);
        expect(result.invalid).toBe(false);
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
        const result = validateStringField({ fieldConfig, value });

        expect(result.validity.typeMismatch).toBe(false);
        expect(result.invalid).toBe(false);
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
        const result = validateStringField({ fieldConfig, value });

        expect(result.validity.typeMismatch).toBe(true);
        expect(result.invalid).toBe(true);
      });
    });
  });
});
