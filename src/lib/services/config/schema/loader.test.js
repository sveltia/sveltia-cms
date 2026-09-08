import { beforeEach, describe, expect, test, vi } from 'vitest';

const { mockSchema } = vi.hoisted(() => ({
  mockSchema: /** @type {{ current: Record<string, any> | null }} */ ({ current: null }),
}));

vi.mock('virtual:config-schema', () => ({
  /**
   * Stand in for the schema the build bundles, read afresh on each import.
   * @returns {Record<string, any> | null} Schema.
   */
  get default() {
    return mockSchema.current;
  },
}));

/**
 * Import a fresh copy of the loader, so that the schema it keeps doesn’t leak between tests.
 * @returns {Promise<typeof import('./loader')>} Module.
 */
const importLoader = async () => {
  vi.resetModules();

  return import('./loader');
};

describe('config/schema/loader', () => {
  beforeEach(() => {
    mockSchema.current = null;
  });

  test('adapts the bundled schema for validation', async () => {
    mockSchema.current = {
      definitions: {
        Root: { anyOf: [{ $ref: '#/definitions/A' }, { $ref: '#/definitions/B' }] },
        A: { properties: { widget: { const: 'a' } }, required: ['widget'] },
        B: { properties: { widget: { const: 'b' } }, required: ['widget'] },
      },
    };

    const { getConfigSchemas } = await importLoader();

    // The union is rewritten into a branch selection
    expect(getConfigSchemas()?.strict.definitions.Root).toHaveProperty('if');
    expect(getConfigSchemas()?.lenient.definitions.Root).toHaveProperty('if');
  });

  test('prepares a variant that accepts unknown properties', async () => {
    mockSchema.current = {
      definitions: {
        Root: {
          type: 'object',
          additionalProperties: false,
          properties: { name: { type: 'string' } },
        },
      },
    };

    const { getConfigSchemas } = await importLoader();

    expect(getConfigSchemas()?.strict.definitions.Root).toHaveProperty(
      'additionalProperties',
      false,
    );

    expect(getConfigSchemas()?.lenient.definitions.Root).not.toHaveProperty('additionalProperties');
  });

  test('adapts the schema only once', async () => {
    mockSchema.current = { definitions: { Root: { type: 'object' } } };

    const { getConfigSchemas } = await importLoader();

    expect(getConfigSchemas()).toBe(getConfigSchemas());
  });

  test('skips validation when the app was built without a schema', async () => {
    const { getConfigSchemas } = await importLoader();

    expect(getConfigSchemas()).toBeUndefined();
  });
});
