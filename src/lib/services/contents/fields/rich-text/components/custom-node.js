import { DecoratorNode, getNearestEditorFromDOMNode } from 'lexical';
import { flushSync, mount, tick, unmount } from 'svelte';

import Component from '$lib/components/contents/details/fields/rich-text/component.svelte';
import DialogComponent from '$lib/components/contents/details/fields/rich-text/dialog-component.svelte';
import {
  isMultiLinePattern,
  normalizeProps,
} from '$lib/services/contents/fields/rich-text/components/utils';

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
 */

/**
 * Dynamically create a custom {@link DecoratorNode} class.
 * @param {EditorComponentDefinition} componentDef Component definition passed with the
 * `CMS.registerEditorComponent()` API.
 * @returns {any} Custom node class.
 */
export const createCustomNodeClass = (componentDef) => {
  const {
    id: componentName,
    label,
    collapsed,
    dialog,
    summary,
    fields,
    pattern,
    toBlock,
    toPreview,
  } = componentDef;
  const isMultiLine = isMultiLinePattern(pattern);
  const preview = toPreview?.({});
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
   * @augments {DecoratorNode<null>}
   * @see https://lexical.dev/docs/concepts/nodes#extending-decoratornode
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
      return new CustomNode().updateFromJSON(serializedNode);
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
      /** @type {Component | DialogComponent} */
      let component;

      /**
       * Custom `Change` event handler.
       * @param {CustomEvent} event `Change` event.
       */
      const onChange = async ({ type, detail }) => {
        await tick();

        editor ??= getNearestEditorFromDOMNode(wrapper);

        // Save the currently focused element and selection to restore after the update.
        // This prevents the parent Lexical editor from stealing focus when updating node props.
        const { activeElement } = document;
        const activeEl = /** @type {HTMLElement | null} */ (activeElement);

        const selection = activeEl?.matches('[contenteditable="true"]')
          ? window.getSelection()
          : null;

        const selectionRange =
          selection && selection.rangeCount > 0 ? selection.getRangeAt(0).cloneRange() : null;

        editor?.update(
          () => {
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
          },
          {
            discrete: true,
            /**
             * Restore focus and selection after the Lexical update completes.
             */
            onUpdate: () => {
              if (activeEl && document.body.contains(activeEl)) {
                activeEl.focus();

                if (selectionRange && selection) {
                  selection.removeAllRanges();
                  selection.addRange(selectionRange);
                }
              }
            },
          },
        );
      };

      // Use DialogComponent if `dialog: true`, otherwise use inline Component
      const ComponentClass = dialog ? DialogComponent : Component;

      component = mount(ComponentClass, {
        target: document.createElement('div'),
        props: {
          componentName,
          label,
          ...(dialog ? { summary } : { collapsed }),
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
            node: new CustomNode(
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
                  node: new CustomNode({ src, alt, title, link }),
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
  }

  return CustomNode;
};
