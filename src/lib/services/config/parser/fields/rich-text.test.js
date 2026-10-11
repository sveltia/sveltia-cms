import { describe, expect, test, vi } from 'vitest';

import { parseRichTextFieldConfig } from '$lib/services/config/parser/fields/rich-text';
import { checkUnsupportedOptions } from '$lib/services/config/parser/utils/validator';

vi.mock('$lib/services/config/parser/utils/validator');

/** @type {any} */
const context = { collection: { name: 'posts' }, typedKeyPath: 'body' };
/** @type {any} */
const collectors = { errors: new Set(), warnings: new Set() };

describe('parseRichTextFieldConfig', () => {
  test('checks for the deprecated camelCase `editorComponents` option', () => {
    /** @type {any} */
    const config = { name: 'body', widget: 'richtext', editorComponents: [] };

    parseRichTextFieldConfig({ config, context, collectors });

    expect(checkUnsupportedOptions).toHaveBeenCalledExactlyOnceWith({
      config,
      context,
      collectors,
      UNSUPPORTED_OPTIONS: [{ prop: 'editorComponents', newProp: 'editor_components' }],
    });
  });
});
