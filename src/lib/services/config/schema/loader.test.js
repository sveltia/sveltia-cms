import { beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('$lib/services/config/constants', () => ({
  SCHEMA_FETCH_TIMEOUT: 5000,
  SCHEMA_VALIDATION_URL: 'https://example.com/sveltia-cms.json',
}));

const schema = { definitions: { Root: { type: 'object', additionalProperties: false } } };

/**
 * Build a response that serves the test schema.
 * @returns {any} Response.
 */
const schemaResponse = () => ({
  ok: true,
  /**
   * Return the schema.
   * @returns {Promise<object>} Schema.
   */
  json: async () => schema,
});

/**
 * Import a fresh copy of the loader, so that the schema it caches doesn’t leak between tests.
 * @returns {Promise<typeof import('./loader')>} Module.
 */
const importLoader = async () => {
  vi.resetModules();

  return import('./loader');
};

describe('config/schema/loader', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  test('downloads the schema and adapts it for validation', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(schemaResponse());
    const { getConfigSchema } = await importLoader();
    const result = await getConfigSchema();

    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.com/sveltia-cms.json',
      expect.objectContaining({ signal: expect.anything() }),
    );
    expect(result?.definitions.Root.additionalProperties).toBeUndefined();
  });

  test('downloads the schema only once', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(schemaResponse());
    const { getConfigSchema } = await importLoader();

    expect(await getConfigSchema()).toBe(await getConfigSchema());
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test('skips validation when the schema is unavailable', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      /** @type {any} */ ({ ok: false, status: 404 }),
    );

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { getConfigSchema } = await importLoader();

    expect(await getConfigSchema()).toBeUndefined();
    expect(warn).toHaveBeenCalled();
  });

  test('retries after a failed download', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValue(schemaResponse());

    vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const { getConfigSchema } = await importLoader();

    expect(await getConfigSchema()).toBeUndefined();
    expect(await getConfigSchema()).toBeDefined();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
