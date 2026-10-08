import { _ } from '@sveltia/i18n';

import { customComponentRegistry } from '$lib/services/api/registries';
import { replaceQuotes } from '$lib/services/contents/fields/rich-text/components/utils';
import {
  IMAGE_OR_LINKED_IMAGE_REGEX,
  IMAGE_REGEX,
} from '$lib/services/contents/fields/rich-text/constants';
import { escapeAttr } from '$lib/services/utils/string';

/**
 * @import { EditorComponentDefinition } from '$lib/types/public';
 */

/**
 * Get the image field values from an `<img>` element.
 * @param {Element} img Image element.
 * @returns {{ src: string, alt: string, title: string }} Values.
 */
const getImageProps = (img) => ({
  src: img.getAttribute('src') ?? '',
  alt: img.getAttribute('alt') ?? '',
  title: img.getAttribute('title') ?? '',
});

/**
 * Create an `<img>` element from the image field values. The values are set as attributes, so they
 * don’t have to be escaped.
 * @param {Record<string, any>} props Field values.
 * @returns {HTMLImageElement | string} Element, or an empty string if the source is not set.
 */
const createImageElement = ({ src = '', alt = '', title = '' }) => {
  if (!src) {
    return '';
  }

  const img = document.createElement('img');

  img.setAttribute('src', src);
  // The alt text is always there for accessibility, even if empty
  img.setAttribute('alt', alt);

  if (title) {
    img.setAttribute('title', title);
  }

  return img;
};

/**
 * Built-in image component definition. The labels are localized in `getBuiltInComponentDefs()`.
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

    return `<img src="${escapeAttr(src)}" alt="${escapeAttr(alt)}" title="${escapeAttr(title)}">`;
  },
  htmlSelector: 'img',
  fromBlockHTML: getImageProps,
  toBlockHTML: createImageElement,
  /* eslint-enable jsdoc/require-jsdoc */
};

/**
 * Built-in linked image component definition. The labels are localized in
 * `getBuiltInComponentDefs()`.
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
    // eslint-disable-next-line @stylistic/max-len
    const img = `<img src="${escapeAttr(src)}" alt="${escapeAttr(alt)}" title="${escapeAttr(title)}">`;

    return link ? `<a href="${escapeAttr(link)}">${img}</a>` : img;
  },
  // An image within a link that has nothing else, or a bare image
  htmlSelector: 'a:has(> img:only-child), img',
  fromBlockHTML: (element) => {
    if (element.localName === 'img') {
      return { ...getImageProps(element), link: '' };
    }

    // A selector cannot tell if a link has any text besides the image
    if (element.textContent?.trim()) {
      return undefined;
    }

    return {
      // The selector makes sure the link has an image
      ...getImageProps(/** @type {Element} */ (element.querySelector('img'))),
      link: element.getAttribute('href') ?? '',
    };
  },
  toBlockHTML: (props) => {
    const { link = '' } = props;
    const img = createImageElement(props);

    if (!img || !link) {
      return img;
    }

    const anchor = document.createElement('a');

    anchor.setAttribute('href', link);
    anchor.append(img);

    return anchor;
  },
  /* eslint-enable jsdoc/require-jsdoc */
};

/**
 * Get all built-in component definitions with localized labels. This has to be a function due to
 * localized labels.
 * @returns {EditorComponentDefinition[]} Array of built-in component definitions.
 */
export const getBuiltInComponentDefs = () => {
  // Common props with localized labels
  const commonImageProps = {
    icon: 'image',
    label: _('editor_components.image'),
    fields: [
      { name: 'src', label: _('editor_components.src'), widget: 'image' },
      { name: 'alt', label: _('editor_components.alt'), required: false },
      { name: 'title', label: _('editor_components.title'), required: false },
    ],
    trigger: /** @type {'button'} */ ('button'),
    /**
     * Create the Markdown inserted in the plain text mode. A new image has no source yet, for which
     * `toBlock()` returns an empty string, so nothing would be inserted.
     * @returns {string} Empty image.
     */
    createMarkdown: () => '![]()',
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
        { name: 'link', label: _('editor_components.link'), required: false },
      ],
    },
  ];
};

/**
 * Resolve a custom component name, which is either the name registered with the
 * `CMS.registerEditorComponent()` API, like `youtube`, or the ID of its definition returned by
 * {@link getComponentDef}, like `x-youtube`. The latter is stored as the `__sc_component_name`
 * value of a component in an entry draft, and passed to the fields within the component.
 * @param {string | undefined} name Component name or ID.
 * @returns {string | undefined} Name registered with the API, or `undefined` if the name doesn’t
 * belong to a custom component, e.g. a built-in component name.
 */
export const getCustomComponentName = (name) => {
  if (!name) {
    return undefined;
  }

  if (customComponentRegistry.has(name)) {
    return name;
  }

  const unprefixedName = name.replace(/^x-/, '');

  return unprefixedName !== name && customComponentRegistry.has(unprefixedName)
    ? unprefixedName
    : undefined;
};

/**
 * Get a component definition.
 * @param {string} name Component name. For a custom component, this can be either the name
 * registered with the API or the prefixed ID of its definition. See {@link getCustomComponentName}.
 * @returns {EditorComponentDefinition | undefined} Definition.
 */
export const getComponentDef = (name) => {
  const customComponentName = getCustomComponentName(name);

  if (customComponentName) {
    // Add a prefix to the component ID to avoid conflicts with built-in components and Lexical’s
    // built-in node types, such as `code`.
    const customComponentDef = /** @type {EditorComponentDefinition} */ (
      customComponentRegistry.get(customComponentName)
    );

    return {
      ...customComponentDef,
      id: `x-${customComponentName}`,
      // The label is optional; fall back to the registered name
      label: customComponentDef.label ?? customComponentName,
    };
  }

  return getBuiltInComponentDefs().find(({ id }) => id === name);
};
