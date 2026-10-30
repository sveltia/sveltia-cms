import { parseInline } from 'marked';
import { isValidElement } from 'react';

import { mountReactNode } from '$lib/services/api/react-dom';
import { getNoAsset } from '$lib/services/contents/fields/rich-text/previews/components';
import { sanitizeRichTextHTML } from '$lib/services/contents/fields/rich-text/sanitize';

/**
 * @import { ReactElement } from 'react';
 * @import { ResolvedEditorComponentDefinition } from '$lib/types/private';
 */

/**
 * @typedef {string | HTMLElement | ReactElement | undefined} InlinePreview
 */

/**
 * Get the preview of a pattern-based inline component shown within the text in the rich text
 * editor: the output of `toPreview`, or that of `toInline` as plain text if the former is missing
 * or returns another type of value. A function that throws, e.g. by reading a missing value, is
 * treated as if it returned nothing, so a broken component doesn’t break the editor.
 * @param {object} functions Functions of the component.
 * @param {ResolvedEditorComponentDefinition['toPreview']} [functions.toPreview] Function to convert
 * the component data to its preview.
 * @param {ResolvedEditorComponentDefinition['toBlock']} functions.toInline Function to convert the
 * component data to Markdown, which the resolved definition holds as `toBlock`.
 * @param {Record<string, any>} data Component data.
 * @returns {{ preview?: string | HTMLElement | ReactElement, text: string }} The preview, if any,
 * and the text to show otherwise, which is an empty string if `toInline` fails as well.
 */
export const getInlinePreview = ({ toPreview, toInline }, data) => {
  /** @type {unknown} */
  let preview;
  let text = '';

  try {
    preview = toPreview?.(data, getNoAsset, undefined);
  } catch {
    preview = undefined;
  }

  if (typeof preview === 'string' || preview instanceof HTMLElement || isValidElement(preview)) {
    return { preview: /** @type {string | HTMLElement | ReactElement} */ (preview), text };
  }

  try {
    text = String(toInline(data) ?? '');
  } catch {
    //
  }

  return { text };
};

/**
 * Render the preview of a pattern-based inline component into the given element. A string is
 * parsed as inline Markdown, so `**bold**` or a link work as well as HTML, and always sanitized, as
 * the editor doesn’t know the field options. An `HTMLElement` is inserted as is, and receives an
 * `Unmount` event once it’s removed, like in the preview pane. A React element is mounted on the
 * element once `react-dom` has been loaded. Without a preview, the text is shown.
 * @param {HTMLElement} element Element to render the preview in.
 * @param {{ preview?: InlinePreview, text: string }} args Return value of
 * {@link getInlinePreview}.
 * @returns {() => void} Function to remove the preview, unmounting a React element or notifying an
 * `HTMLElement`.
 */
export const renderInlinePreview = (element, { preview, text }) => {
  if (typeof preview === 'string') {
    element.innerHTML = sanitizeRichTextHTML(/** @type {string} */ (parseInline(preview)));

    return () => element.replaceChildren();
  }

  if (preview instanceof HTMLElement) {
    element.replaceChildren(preview);

    return () => {
      element.replaceChildren();
      preview.dispatchEvent(new CustomEvent('Unmount'));
    };
  }

  if (preview) {
    // `react-dom` is only loaded once a preview actually needs it
    return mountReactNode(element, preview);
  }

  element.textContent = text;

  return () => element.replaceChildren();
};
