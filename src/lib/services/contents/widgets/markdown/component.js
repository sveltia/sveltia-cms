/* eslint-disable max-classes-per-file */

import { DecoratorNode, getNearestEditorFromDOMNode } from 'lexical';
import { flushSync, mount, tick, unmount } from 'svelte';
import { get } from 'svelte/store';
import { _ } from 'svelte-i18n';

import Component from '$lib/components/contents/details/widgets/markdown/component.svelte';
import { customComponents } from '$lib/services/contents/widgets/markdown';

/**
 * @import {
 * DOMConversion,
 * DOMConversionMap,
 * DOMConversionOutput,
 * DOMExportOutput,
 * LexicalEditor,
 * LexicalNode,
 * NodeKey,
 * SerializedLexicalNode,
 * } from 'lexical';
 * @import { TextMatchTransformer, Transformer } from '@lexical/markdown';
 * @import { EditorComponentDefinition } from '$lib/types/public';
 */

/**
 * @typedef {object} CustomNodeFeatures
 * @property {any} node Lexical node class implementation.
 * @property {(props?: Record<string, any>) => LexicalNode} createNode Function to create a new node
 * instance.
 * @property {Transformer} transformer Node transformer.
 */

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
 * the src, e.g. `[![alt text](image.jpg "Image title")](link)`. This also matches simple images
 * without links, e.g. `![alt text](image.jpg)`. It also matches linked images with parentheses in
 * the filename, e.g. `[![alt](image (1).jpg)](https://example.com)`.
 * @type {RegExp}
 */
export const LINKED_IMAGE_REGEX =
  /\[!\[(?<alt1>(?:[^\]\\]|\\.)*)\]\((?<src1>(?:[^"()\\]|\\.|\([^)]*\)|"[^"]*")*?)(?:\s+"(?<title1>(?:[^"\\]|\\.)*)")?\)\](?:\((?<link>[^)]*\([^)]*\)[^)]*|[^)]*)\))|!\[(?<alt2>(?:[^\]\\]|\\.)*)\]\((?<src2>(?:[^"()\\]|\\.|\([^)]*\)|"[^"]*")*?)(?:\s+"(?<title2>(?:[^"\\]|\\.)*)")?\)/;

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

/**
 * Get a component definition. This has to be a function due to localized labels.
 * @param {string} name Component name.
 * @returns {EditorComponentDefinition | undefined} Definition.
 */
export const getComponentDef = (name) => {
  if (name in customComponents) {
    return customComponents[name];
  }

  const imageProps = {
    icon: 'image',
    label: get(_)('editor_components.image'),
    fields: [
      { name: 'src', label: get(_)('editor_components.src'), widget: 'image' },
      { name: 'alt', label: get(_)('editor_components.alt'), required: false },
      { name: 'title', label: get(_)('editor_components.title'), required: false },
    ],
  };

  /* eslint-disable jsdoc/require-jsdoc */
  /** @type {Record<string, EditorComponentDefinition>} */
  const definitions = {
    image: {
      ...imageProps,
      id: 'image',
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
    },
    'linked-image': {
      ...imageProps,
      id: 'linked-image',
      fields: [
        ...imageProps.fields,
        { name: 'link', label: get(_)('editor_components.link'), required: false },
      ],
      pattern: LINKED_IMAGE_REGEX,
      fromBlock: (match) => {
        const { src1, alt1, title1, src2, alt2, title2, link } = match.groups ?? {};

        return {
          src: (src1 || src2 || '').trim(),
          alt: (alt1 || alt2 || '').trim(),
          title: (title1 || title2 || '').trim(),
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
    },
    /* eslint-enable jsdoc/require-jsdoc */
  };

  return definitions[name];
};

/**
 * Get the {@link CustomNode} class and related features for Lexical.
 * @param {EditorComponentDefinition} componentDef Component definition.
 * @returns {CustomNodeFeatures} The {@link CustomNode} class, a method to create a new node, and
 * the transformer definition.
 */
const getCustomNodeFeatures = ({
  id: componentName,
  label,
  fields,
  pattern,
  fromBlock,
  toBlock,
  toPreview,
}) => {
  const preview = toPreview({});

  const tagName =
    typeof preview === 'string'
      ? preview.trim().match(/^<(?<tagName>[a-z]+)/i)?.groups?.tagName
      : undefined;

  /**
   * Genetic custom node.
   * @augments {DecoratorNode<any>}
   * @see https://github.com/facebook/lexical/blob/main/packages/lexical-playground/src/nodes/ImageNode.tsx
   */
  class CustomNode extends DecoratorNode {
    /**
     * Field properties.
     * @type {Record<string, any> | undefined}
     */
    __props;

    /**
     * Create a new {@link CustomNode} instance.
     * @param {Record<string, any>} [props] Field properties.
     * @param {NodeKey} [key] Node key.
     */
    constructor(props, key) {
      super(key);
      this.__props = props;
    }

    /**
     * Get the node type.
     * @returns {string} Type.
     */
    static getType() {
      return componentName;
    }

    /**
     * Whether the node is an inline node.
     * @returns {boolean} Result.
     */
    isInline() {
      return true;
    }

    /**
     * Clone the given node.
     * @param {CustomNode} node Node.
     * @returns {CustomNode} New node.
     */
    static clone(node) {
      return new CustomNode(node.__props, node.__key);
    }

    /**
     * Import JSON.
     * @param {SerializedLexicalNode} serializedNode Input.
     * @returns {CustomNode} New node.
     */
    static importJSON(serializedNode) {
      // eslint-disable-next-line no-use-before-define
      return createNode().updateFromJSON(serializedNode);
    }

    /**
     * Export the node as JSON.
     * @returns {SerializedLexicalNode} Output.
     */
    exportJSON() {
      return {
        ...this.__props,
        type: componentName,
        version: 1,
      };
    }

    /**
     * Create a DOM node.
     * @returns {HTMLElement} New element.
     */
    createDOM() {
      /** @type {HTMLElement} */
      let wrapper;
      /** @type {LexicalEditor | null} */
      let editor = null;
      /** @type {Component} */
      let component;

      /**
       * Custom `Change` event handler.
       * @param {CustomEvent} event `Change` event.
       */
      const onChange = async ({ type, detail }) => {
        await tick();

        editor ??= getNearestEditorFromDOMNode(wrapper);

        editor?.update(() => {
          if (type === 'update') {
            try {
              this.getWritable().__props = detail;
            } catch {
              //
            }
          }

          if (type === 'remove') {
            unmount(component);
            this.remove();
          }
        });
      };

      component = mount(Component, {
        target: document.createElement('div'),
        props: {
          componentName,
          label,
          fields,
          values: this.__props,
          onChange,
        },
      });

      // Wait for the component to be mounted
      // @see https://svelte.dev/docs/svelte/v5-migration-guide#Components-are-no-longer-classes
      flushSync();

      wrapper = /** @type {HTMLElement} */ (component.getElement());

      window.requestAnimationFrame(() => {
        wrapper.focus();
      });

      return wrapper;
    }

    /**
     * Export the node as a DOM node.
     * @returns {DOMExportOutput} Output.
     */
    exportDOM() {
      return { element: this.createDOM() };
    }

    /**
     * Import a DOM node.
     * @returns {DOMConversionMap} Conversion map.
     */
    static importDOM() {
      /** @type {DOMConversionMap} */
      const conversionMap = {};

      if (tagName) {
        /**
         * Conversion map item.
         * @returns {DOMConversion} Conversion.
         */
        conversionMap[tagName] = () => ({
          /**
           * Conversion.
           * @param {HTMLElement} element Element.
           * @returns {DOMConversionOutput} Output.
           */
          conversion: (element) => ({
            // eslint-disable-next-line no-use-before-define
            node: createNode(
              Object.fromEntries(
                fields.map(({ name }) => [
                  name,
                  /** @type {Record<string, any>} */ (element)[name] ?? '',
                ]),
              ),
            ),
          }),
          priority: 3,
        });
      }

      if (componentName === 'linked-image') {
        // Add extra conversion for the built-in image component to support linked images
        Object.assign(conversionMap, {
          /**
           * Conversion map item.
           * @param {Node} node Target node.
           * @returns {DOMConversion | null} Conversion.
           */
          a: (node) => {
            if (node.firstChild?.nodeName.toLowerCase() === 'img') {
              const { href: link } = /** @type {HTMLAnchorElement} */ (node);
              const { src, alt, title } = /** @type {HTMLImageElement} */ (node.firstChild);

              return {
                /**
                 * Conversion.
                 * @returns {DOMConversionOutput} Output.
                 */
                conversion: () => ({
                  // eslint-disable-next-line no-use-before-define
                  node: createNode({ src, alt, title, link }),
                  // eslint-disable-next-line jsdoc/require-jsdoc
                  after: () => [],
                }),
                priority: 4,
              };
            }

            return null;
          },
        });
      }

      return conversionMap;
    }

    /**
     * Update the DOM.
     * @returns {boolean} Result.
     */
    updateDOM() {
      return false;
    }

    /**
     * Decorator.
     * @returns {null} Unused.
     */
    decorate() {
      return null;
    }
  }

  /**
   * Create a new {@link CustomNode} instance.
   * @param {Record<string, any>} [props] Component properties.
   * @returns {CustomNode} New node.
   */
  const createNode = (props) => new CustomNode(props);
  /**
   * Whether the given node is an instance of {@link CustomNode}.
   * @param {import("lexical").LexicalNode | null | undefined} node Node.
   * @returns {boolean} Result.
   */
  const isCustomNode = (node) => node instanceof CustomNode && node.getType() === componentName;

  /**
   * Implement a Markdown transformer for {@link CustomNode}.
   * @type {TextMatchTransformer}
   * @see https://github.com/facebook/lexical/blob/main/packages/lexical-playground/src/plugins/MarkdownTransformers/index.ts#L75-L97
   */
  const transformer = {
    dependencies: [CustomNode],
    /**
     * Convert the given node to Markdown.
     * @param {import("lexical").LexicalNode} node Node.
     * @returns {string | null} Markdown string.
     */
    export: (node) => {
      if (isCustomNode(node)) {
        return toBlock(/** @type {CustomNode} */ (node).__props ?? {});
      }

      return null;
    },
    importRegExp: pattern,
    regExp: pattern,
    /**
     * Replace the current text node with a new {@link CustomNode}.
     * @param {import("lexical").TextNode} textNode Parent node.
     * @param {string[]} match Matching result.
     */
    replace: (textNode, match) => {
      const matchArray = /** @type {RegExpMatchArray} */ (match);
      const props = fromBlock?.(matchArray) ?? matchArray.groups ?? {};

      textNode.replace(createNode(props));
    },
    type: 'text-match',
  };

  return { node: CustomNode, createNode, transformer };
};

/**
 * Cache the class and related features to avoid a Lexical error saying “Type ... In node CustomNode
 * does not match registered node CustomNode with the same type”.
 * @type {Map<string, CustomNodeFeatures>}
 */
const featureCacheMap = new Map();

/**
 * Text editor component implementation.
 */
export class EditorComponent {
  /**
   * Create an `EditorComponent` instance.
   * @param {EditorComponentDefinition} componentDef Component definition.
   */
  constructor(componentDef) {
    const { id } = componentDef;
    const cache = featureCacheMap.get(id);
    const features = cache ?? getCustomNodeFeatures(componentDef);

    if (!cache) {
      featureCacheMap.set(id, features);
    }

    Object.assign(this, { ...componentDef, ...features });
  }
}
