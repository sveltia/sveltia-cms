import { get } from 'svelte/store';
import { _ } from 'svelte-i18n';

import {
  encodeQuotes,
  replaceQuotes,
} from '$lib/services/contents/fields/rich-text/components/utils';
import {
  IMAGE_OR_LINKED_IMAGE_REGEX,
  IMAGE_REGEX,
} from '$lib/services/contents/fields/rich-text/constants';

/**
 * @import { EditorComponentDefinition } from '$lib/types/public';
 */

/**
 * Custom components registered using `CMS.registerEditorComponent`.
 * @type {Map<string, EditorComponentDefinition>}
 */
export const customComponentRegistry = new Map();

/**
 * Built-in image component definition. The labels are localized in `getComponentDef()`.
 * @type {EditorComponentDefinition}
 * @see https://decapcms.org/docs/widgets/#Markdown
 * @see https://sveltiacms.app/en/docs/fields/richtext
 */
export const IMAGE_COMPONENT = {
  /* eslint-disable jsdoc/require-jsdoc */
  id: 'image',
  label: 'Image',
  fields: [
    { name: 'src', label: 'Source', widget: 'image' },
    { name: 'alt', label: 'Alt Text', required: false },
    { name: 'title', label: 'Title', required: false },
  ],
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

/**
 * Built-in linked image component definition. The labels are localized in `getComponentDef()`.
 * @type {EditorComponentDefinition}
 */
export const LINKED_IMAGE_COMPONENT = {
  /* eslint-disable jsdoc/require-jsdoc */
  id: 'linked-image',
  label: 'Image',
  fields: [...IMAGE_COMPONENT.fields, { name: 'link', label: 'Link', required: false }],
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
 * Get all built-in component definitions with localized labels.
 * @returns {EditorComponentDefinition[]} Array of built-in component definitions.
 */
export const getBuiltInComponentDefs = () => {
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

  return [
    {
      ...IMAGE_COMPONENT,
      // Override with localized labels
      ...commonImageProps,
    },
    {
      ...LINKED_IMAGE_COMPONENT,
      // Override with localized labels
      ...commonImageProps,
      fields: [
        ...commonImageProps.fields,
        { name: 'link', label: get(_)('editor_components.link'), required: false },
      ],
    },
  ];
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
      // Override with localized labels
      ...commonImageProps,
    },
    'linked-image': {
      ...LINKED_IMAGE_COMPONENT,
      // Override with localized labels
      ...commonImageProps,
      fields: [
        ...commonImageProps.fields,
        { name: 'link', label: get(_)('editor_components.link'), required: false },
      ],
    },
  };

  return definitions[name];
};
