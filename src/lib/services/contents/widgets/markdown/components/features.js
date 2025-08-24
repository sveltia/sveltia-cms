import { DecoratorNode, getNearestEditorFromDOMNode } from 'lexical';
import { flushSync, mount, tick, unmount } from 'svelte';

import Component from '$lib/components/contents/details/widgets/markdown/component.svelte';
import { getTransformer } from '$lib/services/contents/widgets/markdown/components/transformers';
import {
  isMultiLinePattern,
  normalizeProps,
} from '$lib/services/contents/widgets/markdown/components/utils';

/**
 * @import {
 * DOMConversion,
 * DOMConversionMap,
 * DOMConversionOutput,
 * DOMExportOutput,
 * LexicalEditor,
 * NodeKey,
 * SerializedLexicalNode,
 * } from 'lexical';
 * @import { EditorComponentDefinition } from '$lib/types/public';
 * @import { CustomNodeFeatures } from '$lib/types/private';
 */

/**
 * Get the {@link CustomNode} class and related features for Lexical.
 * @param {EditorComponentDefinition} componentDef Component definition.
 * @returns {CustomNodeFeatures} The {@link CustomNode} class, a method to create a new node, and
 * the transformer definition.
 */
export const getCustomNodeFeatures = (componentDef) => {
  const { id: componentName, label, fields, pattern, toBlock, toPreview } = componentDef;
  const isMultiLine = isMultiLinePattern(pattern);
  const preview = toPreview({});
  const block = toBlock({});

  const tagName =
    typeof preview === 'string'
      ? (preview.trim().match(/^<(?<tagName>[a-z]+)/i)?.groups?.tagName ??
        (typeof block === 'string'
          ? block.trim().match(/^<(?<tagName>[a-z]+)/i)?.groups?.tagName
          : undefined))
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
      return !isMultiLine;
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
        ...normalizeProps(this.__props ?? {}),
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

  return {
    node: CustomNode,
    createNode,
    transformer: getTransformer({ componentDef, CustomNode, createNode }),
  };
};
