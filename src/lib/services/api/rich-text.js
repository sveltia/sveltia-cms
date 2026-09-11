import { isObject } from '@sveltia/utils/object';
import { mount, unmount } from 'svelte';

import RichTextPreview from '$lib/components/contents/details/fields/rich-text/rich-text-preview.svelte';

/**
 * @import { RenderRichTextOptions } from '../../types/public';
 */
// Don’t use `$lib` in `from` above, or type declarations will not be exported

/**
 * Render a Markdown/rich text value into the given element with the same pipeline as the built-in
 * RichText field preview: editor component previews (including nested components), Markdown
 * parsing, syntax highlighting, image URL resolution and HTML sanitization. This is primarily
 * intended for an editor component `toPreview()` that returns an `HTMLElement`, so the verbatim
 * value of a nested RichText or Markdown field can be rendered recursively.
 * @param {HTMLElement} target The element to render the preview into. The content is rendered
 * asynchronously, so the element can still be detached from the document.
 * @param {string} value Markdown string.
 * @param {RenderRichTextOptions} [options] Options.
 * @returns {() => void} Function to remove the rendered preview and destroy any editor component
 * previews within it. Call it when the target element is no longer needed, e.g. when the element
 * preview receives an `Unmount` event.
 * @throws {TypeError} If `target` is not an element, `value` is not a string, or `fieldConfig` is
 * not an object.
 * @see https://sveltiacms.app/en/docs/api/editor-components
 */
export const renderRichText = (target, value, { fieldConfig } = {}) => {
  if (!(target instanceof Element)) {
    throw new TypeError('The `target` option for `CMS.renderRichText()` must be an element');
  }

  if (typeof value !== 'string') {
    throw new TypeError('The `value` option for `CMS.renderRichText()` must be a string');
  }

  if (fieldConfig !== undefined && !isObject(fieldConfig)) {
    throw new TypeError('The `fieldConfig` option for `CMS.renderRichText()` must be an object');
  }

  const component = mount(RichTextPreview, {
    target,
    props: {
      locale: '',
      keyPath: '',
      typedKeyPath: '',
      fieldConfig: {
        name: 'body',
        // Always sanitize the output unless explicitly disabled by the developer, regardless of the
        // `field_defaults` config, because the value typically comes from a nested field edited by
        // other users
        sanitize_preview: true,
        ...fieldConfig,
        widget: 'richtext',
      },
      currentValue: value,
    },
  });

  return () => {
    unmount(component);
  };
};
