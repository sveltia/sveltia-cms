// @vitest-environment jsdom

import { beforeEach, describe, expect, test, vi } from 'vitest';

const { mount, unmount } = vi.hoisted(() => ({
  mount: vi.fn(() => ({ mocked: true })),
  unmount: vi.fn(),
}));

vi.mock('svelte', () => ({ mount, unmount }));
vi.mock('$lib/components/contents/details/fields/rich-text/rich-text-preview.svelte', () => ({
  default: { name: 'RichTextPreview' },
}));

const { renderRichText } = await import('$lib/services/api/rich-text');

describe('renderRichText()', () => {
  /** @type {HTMLElement} */
  let target;

  beforeEach(() => {
    target = document.createElement('div');
  });

  test('throws if target is not an element', () => {
    // @ts-expect-error
    expect(() => renderRichText(null, '')).toThrow(TypeError);
    // @ts-expect-error
    expect(() => renderRichText({}, '')).toThrow(
      'The `target` option for `CMS.renderRichText()` must be an element',
    );
  });

  test('throws if value is not a string', () => {
    // @ts-expect-error
    expect(() => renderRichText(target)).toThrow(TypeError);
    // @ts-expect-error
    expect(() => renderRichText(target, 123)).toThrow(
      'The `value` option for `CMS.renderRichText()` must be a string',
    );
  });

  test('throws if fieldConfig is not an object', () => {
    // @ts-expect-error
    expect(() => renderRichText(target, '', { fieldConfig: 'richtext' })).toThrow(
      'The `fieldConfig` option for `CMS.renderRichText()` must be an object',
    );
  });

  test('mounts the RichText field preview with a sanitized default config', () => {
    const destroy = renderRichText(target, '**Hello**');

    expect(mount).toHaveBeenCalledWith(
      { name: 'RichTextPreview' },
      {
        target,
        props: {
          locale: '',
          keyPath: '',
          typedKeyPath: '',
          fieldConfig: { name: 'body', widget: 'richtext', sanitize_preview: true },
          currentValue: '**Hello**',
        },
      },
    );

    expect(unmount).not.toHaveBeenCalled();
    destroy();
    expect(unmount).toHaveBeenCalledWith({ mocked: true });
  });

  test('merges the given field config but keeps the widget', () => {
    renderRichText(target, '', {
      fieldConfig: {
        name: 'content',
        // @ts-expect-error — must be overridden
        widget: 'markdown',
        sanitize_preview: false,
        editor_components: ['warning'],
      },
    });

    expect(mount).toHaveBeenCalledWith(
      { name: 'RichTextPreview' },
      expect.objectContaining({
        props: expect.objectContaining({
          fieldConfig: {
            name: 'content',
            widget: 'richtext',
            sanitize_preview: false,
            editor_components: ['warning'],
          },
        }),
      }),
    );
  });
});
