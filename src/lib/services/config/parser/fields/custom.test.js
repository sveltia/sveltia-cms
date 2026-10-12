import { describe, expect, it } from 'vitest';

import { createCollectors } from '$lib/test/config-parser';

import { parseCustomFieldConfig } from './custom';

/**
 * @import { ConfigParserContext } from '$lib/types/private';
 */

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

  it('checks the template tags in the field’s folder options', () => {
    const collectors = createCollectors();
    /** @type {any} */
    const config = { name: 'photo', widget: 'derived-image', media_folder: '/static/{{title}}' };

    parseCustomFieldConfig({ config, context, collectors });

    expect(collectors.errors.size).toBe(1);
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
