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
      definitions: { Root: { type: 'object', additionalProperties: false } },
    };

    const { getConfigSchema } = await importLoader();

    expect(getConfigSchema()?.definitions.Root.additionalProperties).toBeUndefined();
  });

  test('adapts the schema only once', async () => {
    mockSchema.current = { definitions: { Root: { type: 'object' } } };

    const { getConfigSchema } = await importLoader();

    expect(getConfigSchema()).toBe(getConfigSchema());
  });

  test('skips validation when the app was built without a schema', async () => {
    const { getConfigSchema } = await importLoader();

    expect(getConfigSchema()).toBeUndefined();
  });
});
