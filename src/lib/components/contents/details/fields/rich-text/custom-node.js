import { IMPORT_UPDATE_TAG } from '@sveltia/ui';
import {
  $hasUpdateTag,
  $createTextNode as createTextNode,
  DecoratorNode,
  getNearestEditorFromDOMNode,
  $getNodeByKey as getNodeByKey,
  HISTORY_MERGE_TAG,
  SKIP_DOM_SELECTION_TAG,
} from 'lexical';
import { flushSync, mount, tick, unmount } from 'svelte';

import EditorComponent from '$lib/components/contents/details/fields/rich-text/editor-component.svelte';
import InlinePatternComponent from '$lib/components/contents/details/fields/rich-text/inline-pattern-component.svelte';
import {
  getSelectorTagNames,
  isInlineComponentDef,
  normalizeProps,
  supportsHTML,
} from '$lib/services/contents/fields/rich-text/components/utils';
import {
  getComponentFieldList,
  getNoAsset,
} from '$lib/services/contents/fields/rich-text/previews/components';

/**
 * @import {
 * DOMConversion,
 * DOMConversionMap,
 * DOMConversionOutput,
 * DOMExportOutput,
 * EditorConfig,
 * LexicalEditor,
 * NodeKey,
 * SerializedLexicalNode,
 * } from 'lexical';
 * @import { ReactElement } from 'react';
 * @import { ResolvedEditorComponentDefinition } from '$lib/types/private';
 */

const TAG_NAME_REGEX = /^<(?<tagName>[a-z]+)/i;
/**
 * Mounted pattern-based inline components, keyed by their element, so a node can hand the latest
 * data to its component in `updateDOM()`, which only receives the element.
 * @type {WeakMap<HTMLElement, { setValues: (values: Record<string, any>) => void }>}
 */
const inlineComponents = new WeakMap();

/**
 * Get the name of the HTML tag that a component renders, so that the equivalent tag in a pasted
 * HTML document can be converted back to the component.
 * @param {string | HTMLElement | ReactElement | undefined} preview Return value of the component’s
 * `toPreview()` method, if any.
 * @param {string | undefined} block Return value of the component’s `toBlock()` method, if it
 * could be called.
 * @returns {string | undefined} Tag name, e.g. `img`, or `undefined` if it cannot be determined,
 * including when the preview is a React element.
 */
const getTagName = (preview, block) => {
  // An element preview, e.g. an element with a Svelte or Vue component mounted on it. Duck typing
  // is used here because the DOM globals are unavailable outside a browser context
  if (preview && typeof preview === 'object' && 'localName' in preview) {
    return /** @type {HTMLElement} */ (preview).localName;
  }

  if (typeof preview === 'string') {
    return (
      preview.trim().match(TAG_NAME_REGEX)?.groups?.tagName ??
      (typeof block === 'string' ? block.trim().match(TAG_NAME_REGEX)?.groups?.tagName : undefined)
    );
  }

  return undefined;
};

/**
 * Call a method of a component with empty field values, to learn the HTML tag it renders. A method
 * that needs the values can throw, e.g. by reading a property of `undefined`. The tag is then left
 * unknown, rather than the error breaking the editor, which creates the node class of every
 * registered component, whether an entry uses it or not.
 * @param {((props: Record<string, any>, ...args: any[]) => any) | undefined} method `toPreview()`
 * or `toBlock()`.
 * @param {any[]} [args] Other arguments, e.g. the asset getter and field list for `toPreview()`.
 * @returns {any} Return value, or `undefined` if the method is missing or has thrown.
 */
const callWithEmptyProps = (method, args = []) => {
  try {
    return method?.({}, ...args);
  } catch {
    return undefined;
  }
};

/**
 * Dynamically create a custom {@link DecoratorNode} class.
 * @param {ResolvedEditorComponentDefinition} componentDef Component definition passed with the
 * `CMS.registerEditorComponent()` API.
 * @returns {any} Custom node class.
 */
export const createCustomNodeClass = (componentDef) => {
  const {
    id: componentName,
    label,
    collapsed,
    mode,
    summary,
    thumbnail,
    fields,
    toBlock,
    toPreview,
    htmlSelector,
    fromBlockHTML,
    toBlockHTML,
    inlinePattern,
  } = componentDef;

  const inline = isInlineComponentDef(componentDef);
  const htmlSupported = supportsHTML(componentDef);
  // A pattern-based inline component has no fields to fill in from a pasted element, so it’s never
  // imported from one
  const guessTagName = !htmlSupported && !inlinePattern;

  // The selector has been validated when the component was registered
  const htmlTagNames = htmlSupported
    ? /** @type {string[]} */ (getSelectorTagNames(/** @type {string} */ (htmlSelector)))
    : [];

  // Without the HTML syntax, guess the element from the preview to convert a pasted element
  const preview = guessTagName
    ? callWithEmptyProps(toPreview, [getNoAsset, getComponentFieldList(componentDef)])
    : undefined;

  const block = guessTagName ? callWithEmptyProps(toBlock) : undefined;
  const tagName = guessTagName ? getTagName(preview, block) : undefined;

  /**
   * Get the field values of the component from the given element, using the `htmlSelector` and
   * `fromBlockHTML` options.
   * @param {HTMLElement} element Element.
   * @returns {Record<string, any> | undefined} Values, or `undefined` if the element is not an
   * instance of the component.
   */
  const getPropsFromElement = (element) =>
    element.matches(/** @type {string} */ (htmlSelector))
      ? /** @type {(element: HTMLElement) => Record<string, any> | undefined} */ (fromBlockHTML)(
          element,
        )
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
     * Text that was selected when a pattern-based inline component with the `onInsert` option
     * was inserted from the toolbar, which the component replaces once `onInsert` has returned its
     * data. It’s only set on the node created for the insertion, and not copied to a clone, so
     * `onInsert` is called once.
     * @type {string | undefined}
     */
    __selectedText;

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
      return inline;
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
     * @param {EditorConfig} [_config] Editor configuration.
     * @param {LexicalEditor} [lexicalEditor] Editor rendering the node. The reconciler passes it,
     * but {@link exportDOM} doesn’t.
     * @returns {HTMLElement} New element.
     */
    createDOM(_config, lexicalEditor) {
      // Only a node the user has just added, e.g. with the toolbar or a paste, takes the focus. A
      // node rendered when the editor loads a value, or when the editor is attached to its root
      // element and renders the existing content again, doesn’t, as the focus would move away from
      // where the user is and the editor would scroll to the component. The former update is
      // tagged as an import, the latter as a history merge. The update tags can only be read now,
      // while the reconciler is running
      const isAddedByUser =
        !!lexicalEditor && !$hasUpdateTag(IMPORT_UPDATE_TAG) && !$hasUpdateTag(HISTORY_MERGE_TAG);

      const { __selectedText: selectedText } = this;
      /** @type {HTMLElement} */
      let wrapper;
      /** @type {LexicalEditor | null} */
      let editor = null;
      /** @type {{ getElement: () => HTMLElement | undefined }} */
      let component;
      let destroyed = false;

      /**
       * Unmount the component exactly once, regardless of how many times cleanup is triggered.
       */
      const cleanup = () => {
        /* v8 ignore next */
        if (destroyed) {
          return;
        }

        destroyed = true;
        unmount(component);
      };

      /**
       * Custom `Change` event handler.
       * @param {CustomEvent} event `Change` event.
       */
      const onChange = async ({ type, detail }) => {
        await tick();

        editor ??= getNearestEditorFromDOMNode(wrapper);

        // Save the currently focused element and selection to restore after the update, in case
        // the parent Lexical editor takes the focus while updating the node.
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
              cleanup();
              this.remove();
            }
          },
          {
            discrete: true,
            // Leave the DOM selection alone while the component is edited. The parent editor
            // would otherwise move it back to its own selection, if the user selected something in
            // the parent before, and scroll to it
            tag: type === 'update' ? SKIP_DOM_SELECTION_TAG : undefined,
            /**
             * Restore focus and selection after the Lexical update completes.
             */
            onUpdate: () => {
              if (activeEl && document.body.contains(activeEl)) {
                // Don’t scroll to the element, e.g. a nested rich text editor taller than the
                // pane, whose top would be brought into view whenever the user pauses typing
                activeEl.focus({ preventScroll: true });

                if (selectionRange && selection) {
                  selection.removeAllRanges();
                  selection.addRange(selectionRange);
                }
              }
            },
          },
        );
      };

      /**
       * Get the data of a new pattern-based inline component with its `onInsert` function, then
       * fill in the component, or restore the text it has replaced if the insertion is cancelled.
       * The update is merged into the insertion in the history, so the whole insertion is undone at
       * once.
       * @param {string} replacedText Text the component has replaced.
       */
      const insertInlineComponent = async (replacedText) => {
        /** @type {unknown} */
        let data;

        try {
          // The text is only remembered for a component with the function
          const { onInsert } = /** @type {Required<NonNullable<typeof inlinePattern>>} */ (
            inlinePattern
          );

          data = await onInsert({ selectedText: replacedText });
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error(error);
        }

        editor ??= getNearestEditorFromDOMNode(wrapper);

        editor?.update(
          () => {
            const node = /** @type {CustomNode | null} */ (getNodeByKey(this.getKey()));

            // A component removed while waiting takes its element out of the editor, which then
            // isn’t found above, so this is only a safeguard
            /* v8 ignore next 3 */
            if (!node) {
              return;
            }

            if (data && typeof data === 'object') {
              node.getWritable().__props = /** @type {Record<string, any>} */ (data);
              node.selectNext(0, 0);
            } else if (replacedText) {
              const textNode = createTextNode(replacedText);

              node.replace(textNode);
              textNode.select(0, replacedText.length);
            } else {
              node.selectPrevious();
              node.remove();
            }
          },
          { discrete: true, tag: HISTORY_MERGE_TAG },
        );

        // `onInsert` may have opened a dialog, which has taken the focus
        editor?.focus();
      };

      component = inlinePattern
        ? mount(InlinePatternComponent, {
            target: document.createElement('div'),
            props: {
              componentName,
              // `getComponentDef()` falls back to the registered name if the label is omitted
              label: /** @type {string} */ (label),
              toPreview,
              toBlock,
              onEdit: inlinePattern.onEdit,
              values: this.__props,
              onChange,
            },
          })
        : mount(EditorComponent, {
            target: document.createElement('div'),
            props: {
              componentName,
              // `getComponentDef()` falls back to the registered name if the label is omitted
              label: /** @type {string} */ (label),
              collapsed,
              mode,
              inline,
              summary,
              thumbnail,
              fields,
              values: this.__props,
              onChange,
            },
          });

      // Wait for the component to be mounted
      // @see https://svelte.dev/docs/svelte/v5-migration-guide#Components-are-no-longer-classes
      flushSync();

      wrapper = /** @type {HTMLElement} */ (component.getElement());

      if (inlinePattern) {
        inlineComponents.set(wrapper, /** @type {any} */ (component));
      }

      window.requestAnimationFrame(() => {
        // Lexical inserts the element as soon as it’s created, so one that’s still detached won’t
        // ever be rendered, e.g. an element exported to copy the node to the clipboard, or a node
        // removed right after it was created
        const root = wrapper.isConnected ? wrapper.closest('[data-lexical-editor]') : null;

        if (!root) {
          cleanup();

          return;
        }

        if (inlinePattern) {
          // A pattern-based inline component leaves the caret in the text after it, where Lexical
          // has put it. One inserted from the toolbar with the `onInsert` option gets its data now
          if (isAddedByUser && selectedText !== undefined) {
            insertInlineComponent(selectedText);
          }
        } else if (isAddedByUser && wrapper.closest('[role="textbox"][aria-readonly="false"]')) {
          // Focus the wrapper of a new component if the parent field is editable. This is necessary
          // because `i18n: duplicate` field is rendered as a read-only textbox in non-default
          // locales, which may steal focus from the wrapper of the default locale
          wrapper.focus();
        }

        // Clean up when the parent field is unmounted (e.g. navigating away).
        wrapper.closest('.field')?.addEventListener('Unmount', cleanup, { once: true });

        // Clean up when the Lexical node is removed directly (e.g. keyboard Delete, undo) without
        // going through onChange. Lexical has no destroyDOM() hook, so watch the DOM. The whole
        // editor is watched rather than the parent element: an inline component sits in a
        // paragraph, which can be removed along with it while its own children stay untouched.
        // A component left mounted would keep writing its field values to the draft, where they
        // would fail validation with no field to show the errors in
        const observer = new MutationObserver(() => {
          if (!wrapper.isConnected) {
            cleanup();
            observer.disconnect();
          }
        });

        observer.observe(root, { childList: true, subtree: true });
      });

      return wrapper;
    }

    /**
     * Export the node as a DOM node: the HTML written with the `toBlockHTML` option, which is saved
     * in a RichText field with the `html` format, and copied to the clipboard in any field. Without
     * the option, the component’s editor UI is exported instead.
     * @returns {DOMExportOutput} Output.
     */
    exportDOM() {
      if (!toBlockHTML) {
        return { element: this.createDOM() };
      }

      const output = /** @type {unknown} */ (toBlockHTML(normalizeProps(this.__props ?? {})));

      if (output && typeof output === 'object') {
        return { element: /** @type {HTMLElement} */ (output) };
      }

      const template = document.createElement('template');

      // Anything other than a string, e.g. `undefined` for an empty component, exports nothing
      template.innerHTML = typeof output === 'string' ? output : '';

      return { element: template.content };
    }

    /**
     * Import a DOM node. With the `htmlSelector` option, an element the selector matches is
     * converted to the component, e.g. when HTML is loaded in a RichText field with the `html`
     * format or pasted to the editor. Otherwise, a pasted element of the type the preview renders
     * is.
     * @returns {DOMConversionMap} Conversion map.
     */
    static importDOM() {
      /** @type {DOMConversionMap} */
      const conversionMap = {};

      if (htmlSupported) {
        htmlTagNames.forEach((name) => {
          /**
           * Conversion map item.
           * @param {HTMLElement} element Element.
           * @returns {DOMConversion | null} Conversion, or `null` if the element is not an
           * instance of the component.
           */
          conversionMap[name] = (element) => {
            const props = getPropsFromElement(element);

            if (!props) {
              return null;
            }

            return {
              /**
               * Conversion.
               * @returns {DOMConversionOutput} Output.
               */
              conversion: () => ({
                node: new CustomNode(props),
                // The content of the element is part of the component
                // eslint-disable-next-line jsdoc/require-jsdoc
                after: () => [],
              }),
              // Take priority over Lexical’s own conversions, e.g. a link
              priority: 4,
            };
          };
        });

        return conversionMap;
      }

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

      return conversionMap;
    }

    /**
     * Update the DOM. A pattern-based inline component shows the data of the latest node, which
     * changes when `onInsert` or `onEdit` returns data, or the change is undone or redone; the
     * element is kept, and the component is told about the data instead.
     * @param {CustomNode} prevNode Previous version of the node.
     * @param {HTMLElement} dom Element created with {@link createDOM}.
     * @returns {boolean} Whether to create the element again, which is never needed.
     */
    updateDOM(prevNode, dom) {
      if (inlinePattern && prevNode.__props !== this.__props) {
        inlineComponents.get(dom)?.setValues(this.__props ?? {});
      }

      return false;
    }
  }

  return CustomNode;
};
