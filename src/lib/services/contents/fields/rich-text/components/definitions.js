import { _ } from '@sveltia/i18n';

import { customComponentRegistry } from '$lib/services/api/registries';
import {
  isInlinePatternComponent,
  resolveInlinePatternComponent,
} from '$lib/services/contents/fields/rich-text/components/inline-pattern';
import {
  escapeAlt,
  escapeTitle,
  unescapeTitle,
} from '$lib/services/contents/fields/rich-text/components/utils';
import {
  getFigurePattern,
  IMAGE_OR_LINKED_IMAGE_REGEX,
  IMAGE_REGEX,
} from '$lib/services/contents/fields/rich-text/constants';
import { sanitizeRichTextHTML } from '$lib/services/contents/fields/rich-text/sanitize';
import { escapeAttr } from '$lib/services/utils/string';

/**
 * @import { ResolvedEditorComponentDefinition } from '$lib/types/private';
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
 * Create the Markdown image syntax from the image field values.
 * @param {Record<string, any>} props Field values.
 * @returns {string} Markdown, or an empty string if the source is not set.
 */
const toImageMarkdown = ({ src = '', alt = '', title = '' }) =>
  src ? `![${escapeAlt(alt)}](${src}${title ? ` "${escapeTitle(title)}"` : ''})` : '';

/**
 * Create the HTML of an image preview from the image field values.
 * @param {Record<string, any>} props Field values.
 * @returns {string} HTML.
 */
const toImagePreview = ({ src = '', alt = '', title = '' }) =>
  `<img src="${escapeAttr(src)}" alt="${escapeAttr(alt)}" title="${escapeAttr(title)}">`;

/**
 * Get the image field values from a `<figure>` element holding an image, which can be wrapped in a
 * link, and its caption, e.g. `<figure><img src="a.jpg" alt=""><figcaption>…</figcaption>
 * </figure>`.
 * @param {Element} figure Figure element.
 * @param {object} [options] Options.
 * @param {boolean} [options.linked] Whether the image can be wrapped in a link.
 * @returns {Record<string, string> | undefined} Values, or `undefined` if the element doesn’t hold
 * just an image and a caption.
 */
const getFigureProps = (figure, { linked = false } = {}) => {
  const [content, figcaption, ...rest] = figure.children;

  // Text outside the image and the caption would be lost, so such a figure is left as it is
  const hasOtherText = [...figure.childNodes].some(
    (node) => node.nodeType === Node.TEXT_NODE && !!node.textContent?.trim(),
  );

  if (!content || figcaption?.localName !== 'figcaption' || rest.length || hasOtherText) {
    return undefined;
  }

  const anchor =
    linked &&
    content.localName === 'a' &&
    content.children.length === 1 &&
    !content.textContent?.trim()
      ? content
      : undefined;

  const img = anchor ? anchor.children[0] : content;

  if (img.localName !== 'img') {
    return undefined;
  }

  const props = { ...getImageProps(img), caption: figcaption.innerHTML.trim() };

  return linked ? { ...props, link: anchor?.getAttribute('href') ?? '' } : props;
};

/**
 * Get the image field values from a Markdown image, or a `<figure>` element matched with
 * {@link getFigurePattern}.
 * @param {RegExpMatchArray} match Match.
 * @param {(match: RegExpMatchArray) => Record<string, any>} fromImage Function to get the values
 * from a Markdown image.
 * @param {object} [options] Options.
 * @param {boolean} [options.linked] Whether the image can be wrapped in a link.
 * @returns {Record<string, any>} Values.
 */
const getMatchProps = (match, fromImage, { linked = false } = {}) => {
  if (match.groups?.figureContent === undefined) {
    return fromImage(match);
  }

  // The pattern makes sure the element holds an image and a caption
  const { body } = new DOMParser().parseFromString(match[0], 'text/html');

  const props = /** @type {Record<string, string>} */ (
    getFigureProps(/** @type {Element} */ (body.firstElementChild), { linked })
  );

  // Keep the caption as written rather than as the parser serializes it, e.g. `&` as `&amp;`, so
  // the figure is written back unchanged
  return { ...props, caption: /** @type {string} */ (match.groups.caption) };
};

/**
 * Create the HTML of an image with a caption, which Markdown has no syntax for.
 * @param {Record<string, any>} props Field values.
 * @returns {string} HTML.
 */
const toFigureHTML = ({ src = '', alt = '', title = '', link = '', caption = '' }) => {
  const img = `<img src="${escapeAttr(src)}" alt="${escapeAttr(alt)}"${
    title ? ` title="${escapeAttr(title)}"` : ''
  }>`;

  // The figure is written on a single line, so a line break in the caption becomes a space
  return [
    '<figure>',
    link ? `<a href="${escapeAttr(link)}">${img}</a>` : img,
    `<figcaption>${String(caption).replace(/\s*\n\s*/g, ' ')}</figcaption>`,
    '</figure>',
  ].join('');
};

/**
 * Wrap the given image or linked image element in a `<figure>` element with a caption.
 * @param {HTMLElement} content Image or link element.
 * @param {string} caption Caption HTML.
 * @returns {HTMLElement} Figure element.
 */
const createFigureElement = (content, caption) => {
  const figure = document.createElement('figure');
  const figcaption = document.createElement('figcaption');
  const template = document.createElement('template');

  // The caption is sanitized before being added to the document, where an image in it would load
  template.innerHTML = sanitizeRichTextHTML(caption);
  figcaption.append(template.content);
  figure.append(content, figcaption);

  return figure;
};

/**
 * English labels of the built-in image components, localized in `getBuiltInComponentDefs()`.
 * @type {Record<string, string>}
 */
const IMAGE_COMPONENT_LABELS = {
  image: 'Image',
  src: 'Source',
  alt: 'Alt Text',
  title: 'Title',
  link: 'Link',
  caption: 'Caption',
};

/**
 * Get the image field values from a Markdown image matched with `IMAGE_REGEX`.
 * @param {RegExpMatchArray} match Match.
 * @returns {Record<string, any>} Values.
 */
const getImageMatchProps = ({ groups }) => {
  const { src, alt, title = groups?.singleQuotedTitle } = groups ?? {};

  return { src, alt: alt && unescapeTitle(alt), title: title && unescapeTitle(title) };
};

/**
 * Get the image field values from a Markdown image or linked image matched with
 * `IMAGE_OR_LINKED_IMAGE_REGEX`.
 * @param {RegExpMatchArray} match Match.
 * @returns {Record<string, any>} Values.
 */
const getLinkedImageMatchProps = ({ groups }) => {
  const { src, alt, title, singleQuotedTitle, src2, alt2, title2, singleQuotedTitle2, link } =
    groups ?? {};

  return {
    src: (src || src2 || '').trim(),
    alt: unescapeTitle(alt || alt2 || '').trim(),
    title: unescapeTitle(title || singleQuotedTitle || title2 || singleQuotedTitle2 || '').trim(),
    link: (link || '').trim(),
  };
};

/**
 * Create the definition of a built-in image component. The linked image component, enabled with
 * the `linked_images` option, is the image component with a link around the image.
 * @param {object} args Arguments.
 * @param {boolean} args.linked Whether the image can be wrapped in a link.
 * @param {(key: string) => string} args.getLabel Function to get the label of the component or a
 * field, given its key in {@link IMAGE_COMPONENT_LABELS}.
 * @returns {EditorComponentDefinition} Definition.
 */
const createImageComponentDef = ({ linked, getLabel }) => ({
  /* eslint-disable jsdoc/require-jsdoc */
  id: linked ? 'linked-image' : 'image',
  label: getLabel('image'),
  fields: [
    { name: 'src', label: getLabel('src'), widget: 'image' },
    { name: 'alt', label: getLabel('alt'), required: false },
    { name: 'title', label: getLabel('title'), required: false },
    ...(linked ? [{ name: 'link', label: getLabel('link'), required: false }] : []),
    { name: 'caption', label: getLabel('caption'), required: false },
  ],
  pattern: new RegExp(
    [
      getFigurePattern({ linked }),
      (linked ? IMAGE_OR_LINKED_IMAGE_REGEX : IMAGE_REGEX).source,
    ].join('|'),
  ),
  fromBlock: (match) =>
    getMatchProps(match, linked ? getLinkedImageMatchProps : getImageMatchProps, { linked }),
  toBlock: (props) => {
    const link = linked ? (props.link ?? '') : '';
    const img = toImageMarkdown(props);

    if (img && props.caption) {
      return toFigureHTML({ ...props, link });
    }

    return img && link ? `[${img}](${link})` : img;
  },
  toPreview: (props) => {
    const link = linked ? (props.link ?? '') : '';

    if (props.src && props.caption) {
      return toFigureHTML({ ...props, link });
    }

    const img = toImagePreview(props);

    return link ? `<a href="${escapeAttr(link)}">${img}</a>` : img;
  },
  // An image with a caption, an image within a link that has nothing else, or a bare image
  htmlSelector: linked ? 'figure, a:has(> img:only-child), img' : 'figure, img',
  fromBlockHTML: (element) => {
    if (element.localName === 'figure') {
      return getFigureProps(element, { linked });
    }

    if (element.localName === 'img') {
      return linked ? { ...getImageProps(element), link: '' } : getImageProps(element);
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
    const link = linked ? (props.link ?? '') : '';
    const img = createImageElement(props);

    if (!img) {
      return img;
    }

    /** @type {HTMLElement} */
    let content = /** @type {HTMLImageElement} */ (img);

    if (link) {
      content = document.createElement('a');
      content.setAttribute('href', link);
      content.append(img);
    }

    return props.caption ? createFigureElement(content, props.caption) : content;
  },
  /* eslint-enable jsdoc/require-jsdoc */
});

/**
 * Get the English label of the built-in image components or one of their fields.
 * @param {string} key Key in {@link IMAGE_COMPONENT_LABELS}.
 * @returns {string} Label.
 */
const getEnglishImageLabel = (key) => IMAGE_COMPONENT_LABELS[key];

/**
 * Built-in image component definition. The labels are localized in `getBuiltInComponentDefs()`.
 * @type {EditorComponentDefinition}
 * @see https://decapcms.org/docs/widgets/#Markdown
 * @see https://sveltiacms.app/en/docs/fields/richtext
 */
export const IMAGE_COMPONENT = createImageComponentDef({
  linked: false,
  getLabel: getEnglishImageLabel,
});

/**
 * Built-in linked image component definition. The labels are localized in
 * `getBuiltInComponentDefs()`.
 * @type {EditorComponentDefinition}
 */
export const LINKED_IMAGE_COMPONENT = createImageComponentDef({
  linked: true,
  getLabel: getEnglishImageLabel,
});

/**
 * Get the localized label of the built-in image components or one of their fields.
 * @param {string} key Key in {@link IMAGE_COMPONENT_LABELS}.
 * @returns {string} Label.
 */
const getLocalizedImageLabel = (key) => _(`editor_components.${key}`);

/**
 * Get all built-in component definitions with localized labels. This has to be a function due to
 * localized labels.
 * @returns {EditorComponentDefinition[]} Array of built-in component definitions.
 */
export const getBuiltInComponentDefs = () =>
  [false, true].map((linked) => ({
    ...createImageComponentDef({ linked, getLabel: getLocalizedImageLabel }),
    icon: 'image',
    trigger: /** @type {'button'} */ ('button'),
    /**
     * Create the Markdown inserted in the plain text mode. A new image has no source yet, for which
     * `toBlock()` returns an empty string, so nothing would be inserted.
     * @returns {string} Empty image.
     */
    createMarkdown: () => '![]()',
  }));

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
 * @returns {ResolvedEditorComponentDefinition | undefined} Definition. A pattern-based inline
 * component is converted to the shape of a field-based one with `resolveInlinePatternComponent()`.
 */
export const getComponentDef = (name) => {
  const customComponentName = getCustomComponentName(name);

  if (customComponentName) {
    const registeredDef = customComponentRegistry.get(customComponentName);

    const customComponentDef = isInlinePatternComponent(registeredDef)
      ? resolveInlinePatternComponent(registeredDef)
      : /** @type {EditorComponentDefinition} */ (registeredDef);

    // Add a prefix to the component ID to avoid conflicts with built-in components and Lexical’s
    // built-in node types, such as `code`.
    return {
      ...customComponentDef,
      id: `x-${customComponentName}`,
      // The label is optional; fall back to the registered name
      label: customComponentDef.label ?? customComponentName,
    };
  }

  return getBuiltInComponentDefs().find(({ id }) => id === name);
};
