/* eslint-disable max-classes-per-file */

import { DecoratorNode, getNearestEditorFromDOMNode } from 'lexical';
import { flushSync, mount } from 'svelte';
import { _ } from 'svelte-i18n';
import { get } from 'svelte/store';
import Component from '$lib/components/contents/details/widgets/markdown/component.svelte';

/**
 * @typedef {object} CustomNodeFeatures
 * @property {any} node - Lexical node class implementation.
 * @property {(props?: Record<string, any>) => import('lexical').LexicalNode} createNode - Function
 * to create a new node instance.
 * @property {import('@lexical/markdown').Transformer} transformer - Node transformer.
 */

/**
 * Escape some Markdown characters in the given object’s property values.
 * @param {Record<string, any>} props - Object containing original strings.
 * @returns {Record<string, string>} Object containing escaped strings.
 */
const escapeAllChars = (props) =>
  Object.fromEntries(
    Object.entries(props).map(([key, val]) => [
      key,
      typeof val === 'string' ? val.trim().replace(/["()[[\]]/g, '\\$&') : '',
    ]),
  );

/**
 * Get a component definition. This has to be a function due to localized labels.
 * @param {string} name - Component name.
 * @returns {EditorComponentConfiguration | undefined} Definition.
 * @todo Add support for `code-block`.
 */
export const getComponentDef = (name) => {
  const definitions = /** @type {Record<string, EditorComponentConfiguration>} */ ({
    image: {
      id: 'image',
      icon: 'image',
      label: get(_)('editor_components.image'),
      fields: [
        {
          name: 'src',
          label: get(_)('editor_components.src'),
          widget: 'image',
        },
        {
          name: 'alt',
          label: get(_)('editor_components.alt'),
          widget: 'string',
        },
        {
          name: 'title',
          label: get(_)('editor_components.title'),
          widget: 'string',
        },
      ],
      pattern: /!\[(.*?)\]\((.*?)(?: "(.*?)")?\)/,
      // eslint-disable-next-line jsdoc/require-jsdoc
      fromBlock: ([, alt, src, title]) => ({ src, alt, title }),
      // eslint-disable-next-line jsdoc/require-jsdoc
      toBlock: (props) => {
        const { src, alt, title } = escapeAllChars(props);

        return src ? `![${alt}](${src}${title ? ` "${title}"` : ''})` : '';
      },
      // eslint-disable-next-line jsdoc/require-jsdoc
      toPreview: (props) => {
        const { src, alt, title } = escapeAllChars(props);

        return src ? `<img src="${src}" alt="${alt}" title="${title}">` : '';
      },
    },
  });

  return definitions[name];
};

/**
 * Get the {@link CustomNode} class and related features for Lexical.
 * @param {EditorComponentConfiguration} componentDef - Component definition.
 * @returns {CustomNodeFeatures} The {@link CustomNode} class, a method to create a new node, and
 * the transformer definition.
 */
const getCustomNodeFeatures = ({ id, label, fields, pattern, fromBlock, toBlock, toPreview }) => {
  const tagName = toPreview({}).match(/\w+/)?.[0] ?? id;

  /**
   * Genetic custom node.
   * @augments {DecoratorNode<any>}
   * @see https://github.com/facebook/lexical/blob/main/packages/lexical-playground/src/nodes/ImageNode.tsx
   */
  class CustomNode extends DecoratorNode {
    /**
     * Field properties.
     * @type {Record<string, any>}
     */
    __props;

    /**
     * Create a new {@link CustomNode} instance.
     * @param {Record<string, any>} props - Field properties.
     * @param {import('lexical').NodeKey} [key] - Node key.
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
      return id;
    }

    /**
     * Whether the node is an inline node.
     * @returns {boolean} Result.
     */
    isInline() {
      return false;
    }

    /**
     * Clone the given node.
     * @param {CustomNode} node - Node.
     * @returns {CustomNode} New node.
     */
    static clone(node) {
      return new CustomNode(node.__props, node.__key);
    }

    /**
     * Import JSON.
     * @param {import('lexical').SerializedLexicalNode} serializedNode - Input.
     * @returns {CustomNode} New node.
     */
    static importJSON(serializedNode) {
      // eslint-disable-next-line no-use-before-define
      return createNode(serializedNode);
    }

    /**
     * Export the node as JSON.
     * @returns {import('lexical').SerializedLexicalNode} Output.
     */
    exportJSON() {
      return {
        ...this.__props,
        type: id,
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
      /** @type {import('lexical').LexicalEditor | null} */
      let editor = null;

      /**
       * Custom `Change` event handler.
       * @param {CustomEvent} event - `Change` event.
       */
      const onChange = ({ type, detail }) => {
        editor ??= getNearestEditorFromDOMNode(wrapper);

        editor?.update(() => {
          if (type === 'update') {
            this.getWritable().__props = detail;
          }

          if (type === 'remove') {
            this.remove();
          }
        });
      };

      const component = mount(Component, {
        target: document.createElement('div'),
        props: {
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
     * @returns {import('lexical').DOMExportOutput} Output.
     */
    exportDOM() {
      return { element: this.createDOM() };
    }

    /**
     * Import a DOM node.
     * @returns {import('lexical').DOMConversionMap} Conversion map.
     */
    static importDOM() {
      return {
        /**
         * Conversion map.
         * @returns {import('lexical').DOMConversion} Conversion.
         */
        [tagName]: () => ({
          /**
           * Conversion.
           * @param {HTMLElement} element - Element.
           * @returns {import('lexical').DOMConversionOutput} Output.
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
          priority: 0,
        }),
      };
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
   * @param {Record<string, any>} [props] - Component properties.
   * @returns {CustomNode} New node.
   */
  const createNode = (props) =>
    new CustomNode(props ?? Object.fromEntries(fields.map(({ name }) => [name, ''])));

  /**
   * Whether the given node is an instance of {@link CustomNode}.
   * @param {import("lexical").LexicalNode | null | undefined} node - Node.
   * @returns {boolean} Result.
   */
  const isCustomNode = (node) => node instanceof CustomNode && node.getType() === id;

  /**
   * Implement a Markdown transformer for {@link CustomNode}.
   * @type {import('@lexical/markdown').ElementTransformer}
   * @see https://github.com/facebook/lexical/blob/main/packages/lexical-playground/src/plugins/MarkdownTransformers/index.ts#L75-L97
   */
  const transformer = {
    dependencies: [CustomNode],
    /**
     * Convert the given node to Markdown.
     * @param {import("lexical").LexicalNode} node - Node.
     * @returns {string | null} Markdown string.
     */
    export: (node) => {
      if (isCustomNode(node)) {
        return toBlock(/** @type {CustomNode} */ (node).__props);
      }

      return null;
    },
    regExp: pattern,
    /**
     * Replace the current text node with a new {@link CustomNode}.
     * @param {import("lexical").ElementNode} parentNode - Parent node.
     * @param {import('lexical').LexicalNode[]} _children - Child nodes.
     * @param {string[]} match - Matching result.
     */
    replace: (parentNode, _children, match) => {
      parentNode.replace(createNode(fromBlock(match)));
    },
    type: 'element',
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
   * @param {EditorComponentConfiguration} componentDef - Component definition.
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
