import { get } from 'svelte/store';
import { _ } from 'svelte-i18n';

/**
 * @import { EditorComponentDefinition } from '$lib/types/public';
 */

/**
 * Custom components registered using `CMS.registerEditorComponent`.
 * @type {Map<string, EditorComponentDefinition>}
 */
export const customComponentRegistry = new Map();

/**
 * Regular expression to match Markdown images, including those with spaces and brackets in the src,
 * e.g. `![alt text](image.jpg "Image title")`. It also matches images with empty alt text, e.g.
 * `![](image.jpg)`, images with parentheses in the filename, e.g. `![alt](image (1).jpg)`, and
 * supports escaped characters like `![alt](image\(1\).jpg)` and titles with escaped quotes.
 * @type {RegExp}
 */
export const IMAGE_REGEX =
  /!\[(?<alt>(?:[^\]\\]|\\.)*)\]\((?<src>(?:[^"()\\]|\\.|\([^)]*\)|"[^"]*")*?)(?:\s+"(?<title>(?:[^"\\]|\\.)*)")?\)/;

/**
 * Regular expression to match Markdown linked images, including those with spaces and brackets in
 * the src, e.g. `[![alt text](image.jpg "Image title")](link)`. It also matches linked images with
 * parentheses in the filename, e.g. `[![alt](image (1).jpg)](https://example.com)`.
 * @type {RegExp}
 */
export const LINKED_IMAGE_REGEX =
  /\[!\[(?<alt2>(?:[^\]\\]|\\.)*)\]\((?<src2>(?:[^"()\\]|\\.|\([^)]*\)|"[^"]*")*?)(?:\s+"(?<title2>(?:[^"\\]|\\.)*)")?\)\](?:\((?<link>[^)]*\([^)]*\)[^)]*|[^)]*)\))/;

/**
 * Regular expression to match either a Markdown image or a linked image.
 * @type {RegExp}
 */
export const IMAGE_OR_LINKED_IMAGE_REGEX = new RegExp(
  `${IMAGE_REGEX.source}|${LINKED_IMAGE_REGEX.source}`,
);

/**
 * Replace double quotes with single quotes to avoid breaking Markdown syntax.
 * @param {string} str String to escape.
 * @returns {string} Escaped string.
 */
export const replaceQuotes = (str) => str.replace(/"/g, "'");

/**
 * Encode double quotes as HTML entities to prevent issues in HTML rendering.
 * @param {string} str String to escape.
 * @returns {string} Escaped string.
 */
export const encodeQuotes = (str) => str.replace(/"/g, '&quot;');

/** @type {EditorComponentDefinition} */
const IMAGE_COMPONENT = {
  /* eslint-disable jsdoc/require-jsdoc */
  id: 'image',
  label: 'Image',
  fields: [], // Defined dynamically in `getComponentDef()` with localized labels
  pattern: IMAGE_REGEX,
  toBlock: (props) => {
    const { src = '', alt = '', title = '' } = props;

    return src ? `![${alt}](${src}${title ? ` "${replaceQuotes(title)}"` : ''})` : '';
  },
  toPreview: (props) => {
    const { src = '', alt = '', title = '' } = props;

    // Return `<img>` even if `src` is empty to make sure the `tagName` below works
    return (
      `<img src="${encodeQuotes(src)}" alt="${encodeQuotes(alt)}" ` +
      `title="${encodeQuotes(title)}">`
    );
  },
  /* eslint-enable jsdoc/require-jsdoc */
};

/** @type {EditorComponentDefinition} */
const LINKED_IMAGE_COMPONENT = {
  /* eslint-disable jsdoc/require-jsdoc */
  id: 'linked-image',
  label: 'Image',
  fields: [], // Defined dynamically in `getComponentDef()` with localized labels
  pattern: IMAGE_OR_LINKED_IMAGE_REGEX,
  fromBlock: (match) => {
    const { src, alt, title, src2, alt2, title2, link } = match.groups ?? {};

    return {
      src: (src || src2 || '').trim(),
      alt: (alt || alt2 || '').trim(),
      title: (title || title2 || '').trim(),
      link: (link || '').trim(),
    };
  },
  toBlock: (props) => {
    const { src = '', alt = '', title = '', link = '' } = props;
    const img = src ? `![${alt}](${src}${title ? ` "${replaceQuotes(title)}"` : ''})` : '';

    return img && link ? `[${img}](${link})` : img;
  },
  toPreview: (props) => {
    const { src = '', alt = '', title = '', link = '' } = props;

    const img =
      `<img src="${encodeQuotes(src)}" alt="${encodeQuotes(alt)}" ` +
      `title="${encodeQuotes(title)}">`;

    // Return `<img>` even if `src` is empty to make sure the `tagName` below works
    return link ? `<a href="${encodeQuotes(link)}">${img}</a>` : img;
  },
  /* eslint-enable jsdoc/require-jsdoc */
};

/**
 * Get a component definition. This has to be a function due to localized labels.
 * @param {string} name Component name.
 * @returns {EditorComponentDefinition | undefined} Definition.
 */
export const getComponentDef = (name) => {
  if (customComponentRegistry.has(name)) {
    return customComponentRegistry.get(name);
  }

  // Common props with localized labels
  const commonImageProps = {
    icon: 'image',
    label: get(_)('editor_components.image'),
    fields: [
      { name: 'src', label: get(_)('editor_components.src'), widget: 'image' },
      { name: 'alt', label: get(_)('editor_components.alt'), required: false },
      { name: 'title', label: get(_)('editor_components.title'), required: false },
    ],
  };

  /** @type {Record<string, EditorComponentDefinition>} */
  const definitions = {
    image: {
      ...IMAGE_COMPONENT,
      ...commonImageProps,
    },
    'linked-image': {
      ...LINKED_IMAGE_COMPONENT,
      ...commonImageProps,
      fields: [
        ...commonImageProps.fields,
        { name: 'link', label: get(_)('editor_components.link'), required: false },
      ],
    },
  };

  return definitions[name];
};
