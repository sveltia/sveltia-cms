/* eslint-disable jsdoc/require-jsdoc */

import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * @import { ConfigParserCollectors, ConfigParserContext } from '$lib/types/private';
 */

vi.mock('@sveltia/i18n', () => ({
  _: (/** @type {string} */ key) => key,
  locale: { current: 'en-US', set: vi.fn() },
}));

const mockAddMessage = vi.fn();

vi.mock('$lib/services/config/parser/utils/validator', () => ({
  addMessage: mockAddMessage,
}));

/**
 * Create a fresh collectors object for testing.
 * @returns {ConfigParserCollectors} Collectors instance.
 */
const createCollectors = () => ({
  errors: new Set(),
  warnings: new Set(),
  mediaFields: new Set(),
  relationFields: new Set(),
});

/**
 * Parse the given configuration and return the reported message keys.
 * @param {Record<string, any>} config Site or field configuration.
 * @returns {Promise<{ strKeys: string[], calls: Record<string, any>[] }>} Reported messages.
 */
const parse = async (config) => {
  const { parseMediaLibraries } = await import('./media-libraries.js');
  /** @type {ConfigParserContext} */
  const context = { cmsConfig: /** @type {any} */ ({}) };
  const collectors = createCollectors();

  parseMediaLibraries({ config, context, collectors });

  const calls = mockAddMessage.mock.calls.map(([args]) => args);

  return { strKeys: calls.map(({ strKey }) => strKey), calls };
};

/**
 * Parse a `transformations` option defined under the `media_libraries.default` library.
 * @param {any} transformations File transformation option map.
 * @returns {Promise<{ strKeys: string[], calls: Record<string, any>[] }>} Reported messages.
 */
const parseTransformations = async (transformations) =>
  parse({ media_libraries: { default: { config: { transformations } } } });

describe('parseMediaLibraries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('option lookup', () => {
    it('should ignore a config without any media library options', async () => {
      const { strKeys } = await parse({ media_folder: 'static/media' });

      expect(strKeys).toEqual([]);
    });

    it('should ignore non-object media library options', async () => {
      const { strKeys } = await parse({ media_libraries: false, media_library: 'default' });

      expect(strKeys).toEqual([]);
    });

    it('should ignore a disabled or shorthand library option', async () => {
      const { strKeys } = await parse({ media_libraries: { default: false } });

      expect(strKeys).toEqual([]);
    });

    it('should ignore a library option without a `config` property', async () => {
      const { strKeys } = await parse({ media_libraries: { default: {} }, media_library: {} });

      expect(strKeys).toEqual([]);
    });

    it('should validate the shared `all` options', async () => {
      const { strKeys } = await parse({
        media_libraries: { all: { transformations: 'invalid' } },
      });

      expect(strKeys).toEqual(['invalid_transformations']);
    });

    it('should validate the legacy `media_library` options', async () => {
      const { strKeys } = await parse({
        media_library: { name: 'default', config: { transformations: 'invalid' } },
      });

      expect(strKeys).toEqual(['invalid_transformations']);
    });

    it('should validate the legacy `media_library` options without a name', async () => {
      const { strKeys } = await parse({
        media_library: { config: { transformations: 'invalid' } },
      });

      expect(strKeys).toEqual(['invalid_transformations']);
    });

    it('should skip the legacy `media_library` options for a cloud library', async () => {
      const { strKeys } = await parse({
        media_library: { name: 'cloudinary', config: { transformations: 'invalid' } },
      });

      expect(strKeys).toEqual([]);
    });

    it('should skip the options for a cloud library', async () => {
      const { strKeys } = await parse({
        media_libraries: { cloudinary: { config: { transformations: 'invalid' } } },
      });

      expect(strKeys).toEqual([]);
    });

    it('should validate the options defined in a field config', async () => {
      const { strKeys } = await parse({
        name: 'image',
        widget: 'image',
        media_libraries: { default: { config: { transformations: 'invalid' } } },
      });

      expect(strKeys).toEqual(['invalid_transformations']);
    });
  });

  describe('transformations validation', () => {
    it('should accept a valid option map', async () => {
      const { strKeys } = await parseTransformations({
        raster_image: { format: 'webp', quality: 85, width: 1920, height: 1080 },
        jpeg: { quality: 0 },
        png: { quality: 100 },
        avif: {},
        gif: {},
        webp: {},
        svg: { optimize: true },
      });

      expect(strKeys).toEqual([]);
    });

    it('should accept an undefined option map', async () => {
      const { strKeys } = await parseTransformations(undefined);

      expect(strKeys).toEqual([]);
    });

    it('should reject a non-object option map', async () => {
      expect((await parseTransformations('invalid')).strKeys).toEqual(['invalid_transformations']);

      vi.clearAllMocks();

      expect((await parseTransformations([])).strKeys).toEqual(['invalid_transformations']);
    });

    it('should mark the problems the schema reports too', async () => {
      // These are only reported when the schema couldn’t be applied, so that one mistake in a
      // validated configuration never yields two messages
      const { calls } = await parseTransformations({
        jpeg: { format: 'jpeg' },
        png: 'invalid',
        svg: { optimize: 'yes' },
      });

      expect(calls.map(({ strKey, schemaCovered }) => [strKey, schemaCovered])).toEqual([
        ['invalid_transformation_format', true],
        ['invalid_transformation_options', true],
        ['invalid_transformation_optimize', true],
      ]);
    });

    it('should not mark the rules the schema can’t express', async () => {
      const { calls } = await parseTransformations({
        tiff: {},
        jpeg: { quality: 300, width: -1 },
      });

      expect(calls.map(({ strKey, schemaCovered }) => [strKey, schemaCovered])).toEqual([
        ['invalid_transformation_key', undefined],
        ['invalid_transformation_quality', undefined],
        ['invalid_transformation_size', undefined],
      ]);
    });

    it('should reject an unsupported key', async () => {
      const { strKeys, calls } = await parseTransformations({ tiff: { format: 'webp' } });

      expect(strKeys).toEqual(['invalid_transformation_key']);
      expect(calls[0].values).toEqual({ key: 'tiff' });
    });

    it('should reject non-object transformation options', async () => {
      const { strKeys, calls } = await parseTransformations({ jpeg: true, svg: 'optimize' });

      expect(strKeys).toEqual(['invalid_transformation_options', 'invalid_transformation_options']);
      expect(calls[0].values).toEqual({ key: 'jpeg' });
      expect(calls[1].values).toEqual({ key: 'svg' });
    });

    it('should reject an unsupported conversion format', async () => {
      const { strKeys, calls } = await parseTransformations({ jpeg: { format: 'jpeg' } });

      expect(strKeys).toEqual(['invalid_transformation_format']);
      expect(calls[0].values).toEqual({ key: 'jpeg' });
    });

    it('should reject an invalid quality', async () => {
      const { strKeys, calls } = await parseTransformations({
        jpeg: { quality: 'high' },
        png: { quality: 85.5 },
        webp: { quality: 101 },
        gif: { quality: -1 },
      });

      expect(strKeys).toEqual([
        'invalid_transformation_quality',
        'invalid_transformation_quality',
        'invalid_transformation_quality',
        'invalid_transformation_quality',
      ]);

      expect(calls[0].values).toEqual({ key: 'jpeg' });
    });

    it('should reject an invalid width or height', async () => {
      const { strKeys, calls } = await parseTransformations({
        jpeg: { width: 'large', height: 0 },
        png: { width: -1 },
        webp: { height: 1.5 },
      });

      expect(strKeys).toEqual([
        'invalid_transformation_size',
        'invalid_transformation_size',
        'invalid_transformation_size',
        'invalid_transformation_size',
      ]);

      expect(calls.map(({ values }) => values)).toEqual([
        { key: 'jpeg', prop: 'width' },
        { key: 'jpeg', prop: 'height' },
        { key: 'png', prop: 'width' },
        { key: 'webp', prop: 'height' },
      ]);
    });

    it('should reject a non-boolean `optimize` option', async () => {
      const { strKeys, calls } = await parseTransformations({ svg: { optimize: 'yes' } });

      expect(strKeys).toEqual(['invalid_transformation_optimize']);
      expect(calls[0].values).toEqual({ key: 'svg' });
    });
  });
});
