import { beforeEach, describe, expect, test, vi } from 'vitest';

const { customStringTransformationRegistry } = await import('$lib/services/api/registries');

const { registerStringTransformation } =
  await import('$lib/services/api/methods/register-string-transformation');

describe('CMS.registerStringTransformation()', () => {
  beforeEach(() => {
    customStringTransformationRegistry.clear();
  });

  test('registers a transformation', () => {
    const transform = vi.fn((value) => String(value));

    registerStringTransformation('reverse', transform);
    registerStringTransformation('_with_digits_123', transform);

    expect(customStringTransformationRegistry.get('reverse')).toBe(transform);
    expect(customStringTransformationRegistry.get('_with_digits_123')).toBe(transform);
  });

  test('replaces a transformation registered with the same name', () => {
    const first = vi.fn();
    const second = vi.fn();

    registerStringTransformation('reverse', first);
    registerStringTransformation('reverse', second);

    expect(customStringTransformationRegistry.size).toBe(1);
    expect(customStringTransformationRegistry.get('reverse')).toBe(second);
  });

  test('throws TypeError if name is not a valid transformation name', () => {
    [undefined, 123, '', ' ', '1abc', 'my-transform', 'wrap()', 'a b'].forEach((name) => {
      // @ts-ignore
      expect(() => registerStringTransformation(name, () => '')).toThrow(
        'The `name` option for `CMS.registerStringTransformation()` must be a string consisting ' +
          'of letters, digits and underscores, not starting with a digit',
      );
    });

    expect(customStringTransformationRegistry.size).toBe(0);
  });

  test('throws Error if name is the name of a built-in transformation', () => {
    ['upper', 'lower', 'slugify', 'date', 'default', 'ternary', 'truncate', 'localize'].forEach(
      (name) => {
        expect(() => registerStringTransformation(name, () => '')).toThrow(
          `The string transformation name "${name}" is reserved for a built-in transformation. ` +
            'Choose a different name for your custom transformation.',
        );
      },
    );

    expect(customStringTransformationRegistry.size).toBe(0);
  });

  test('throws TypeError if transform is not a function', () => {
    [undefined, null, 'reverse', {}].forEach((transform) => {
      // @ts-ignore
      expect(() => registerStringTransformation('reverse', transform)).toThrow(
        new TypeError(
          'The `transform` option for `CMS.registerStringTransformation()` must be a function',
        ),
      );
    });

    expect(customStringTransformationRegistry.size).toBe(0);
  });
});
