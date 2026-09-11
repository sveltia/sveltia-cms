import { describe, expect, it } from 'vitest';

import { parseCustomFieldConfig } from './custom';

/**
 * @import { ConfigParserCollectors, ConfigParserContext } from '$lib/types/private';
 */

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

/** @type {ConfigParserContext} */
const context = {
  cmsConfig: { backend: { name: 'github', repo: 'test/repo' }, collections: [] },
  collection: /** @type {any} */ ({ name: 'posts' }),
  typedKeyPath: 'photo',
};

describe('config/parser/fields/custom', () => {
  it('collects a field-level media folder', () => {
    const collectors = createCollectors();

    /** @type {any} */
    const config = {
      name: 'photo',
      widget: 'derived-image',
      media_folder: '/static/photos',
      public_folder: '/photos',
    };

    parseCustomFieldConfig({ config, context, collectors });

    expect([...collectors.mediaFields]).toEqual([{ fieldConfig: config, context }]);
  });

  it('collects nothing when the field has no media folder', () => {
    const collectors = createCollectors();
    /** @type {any} */
    const config = { name: 'photo', widget: 'derived-image', public_folder: '/photos' };

    parseCustomFieldConfig({ config, context, collectors });

    expect(collectors.mediaFields.size).toBe(0);
    expect(collectors.errors.size).toBe(0);
    expect(collectors.warnings.size).toBe(0);
  });
});
