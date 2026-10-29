import { describe, expect, test, vi } from 'vitest';

import { customComponentRegistry } from '$lib/services/api/registries';
import { parseRichTextFieldConfig } from '$lib/services/config/parser/fields/rich-text';
import { addMessage, checkUnsupportedOptions } from '$lib/services/config/parser/utils/validator';

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

describe('parseRichTextFieldConfig with `multiline: false`', () => {
  /**
   * Get the items reported as ignored, as `option:name`.
   * @returns {string[]} Items.
   */
  const getReported = () =>
    vi.mocked(addMessage).mock.calls.map(([{ values }]) => `${values?.option}:${values?.name}`);

  test('warns about the block-level buttons and built-in components', () => {
    /** @type {any} */
    const config = {
      name: 'title',
      widget: 'markdown',
      multiline: false,
      buttons: ['bold', 'heading-one', 'quote', 'link', 'align', 'unknown'],
      editor_components: ['image', 'code-block', 'table', 'hr', 'unknown'],
    };

    parseRichTextFieldConfig({ config, context, collectors });

    expect(getReported()).toEqual([
      'buttons:heading-one',
      'buttons:quote',
      'buttons:align',
      'editor_components:code-block',
      'editor_components:table',
      'editor_components:hr',
    ]);
    expect(addMessage).toHaveBeenCalledWith({
      type: 'warning',
      strKey: 'single_line_block_item',
      values: { option: 'buttons', name: 'heading-one' },
      context,
      collectors,
    });
  });

  test('warns about a custom block component, not an inline one', () => {
    customComponentRegistry.set('aside', /** @type {any} */ ({ pattern: /^<aside>.*<\/aside>$/s }));
    customComponentRegistry.set('badge', /** @type {any} */ ({ pattern: /\[badge\]/ }));
    customComponentRegistry.set(
      'mention',
      /** @type {any} */ ({ type: 'inline', pattern: /@\w+/ }),
    );

    try {
      /** @type {any} */
      const config = {
        name: 'title',
        widget: 'richtext',
        multiline: false,
        editor_components: ['aside', 'badge', 'mention'],
      };

      parseRichTextFieldConfig({ config, context, collectors });
      expect(getReported()).toEqual(['editor_components:aside']);
    } finally {
      ['aside', 'badge', 'mention'].forEach((name) => customComponentRegistry.delete(name));
    }
  });

  test('takes the option from the field defaults', () => {
    /** @type {any} */
    const config = { name: 'title', widget: 'richtext', buttons: ['heading-two'] };
    /** @type {any} */
    const cmsConfig = { field_defaults: { richtext: { multiline: false } } };

    parseRichTextFieldConfig({ config, context: { ...context, cmsConfig }, collectors });
    expect(getReported()).toEqual(['buttons:heading-two']);
  });

  test('doesn’t warn about a multiline field or the default buttons', () => {
    /** @type {any} */
    const multiline = { name: 'body', widget: 'richtext', buttons: ['heading-one'] };
    /** @type {any} */
    const defaults = { name: 'title', widget: 'richtext', multiline: false, buttons: 'bold' };
    /** @type {any} */
    const fieldOverride = { name: 'body', widget: 'richtext', multiline: true, buttons: ['quote'] };
    /** @type {any} */
    const cmsConfig = { field_defaults: { richtext: { multiline: false } } };

    parseRichTextFieldConfig({ config: multiline, context, collectors });
    parseRichTextFieldConfig({ config: defaults, context, collectors });
    parseRichTextFieldConfig({
      config: fieldOverride,
      context: { ...context, cmsConfig },
      collectors,
    });
    expect(addMessage).not.toHaveBeenCalled();
  });
});
