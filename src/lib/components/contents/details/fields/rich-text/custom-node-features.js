import { $getSelection as getSelection } from 'lexical';

import { createCustomNodeClass } from '$lib/components/contents/details/fields/rich-text/custom-node';
import { createTransformer } from '$lib/services/contents/fields/rich-text/components/transformers';
import { getOrCreate } from '$lib/services/utils/cache';

/**
 * @import { LexicalNode } from 'lexical';
 * @import { Transformer } from '@lexical/markdown';
 * @import { ResolvedEditorComponentDefinition } from '$lib/types/private';
 */

/**
 * Custom Lexical node features.
 * @typedef {object} LexicalNodeFeatures
 * @property {any} node Lexical node class implementation.
 * @property {(props?: Record<string, any>) => LexicalNode} createNode Function to create a new node
 * instance.
 * @property {Transformer} transformer Node transformer.
 */

/**
 * Cache the class and related features to avoid a Lexical error saying “Type ... In node CustomNode
 * does not match registered node CustomNode with the same type”.
 * @type {Map<string, LexicalNodeFeatures>}
 */
export const featureCacheMap = new Map();

/**
 * Dynamically create a custom {@link DecoratorNode} class and related features for the Lexical
 * editor to enable support for rich text editor components.
 * @param {ResolvedEditorComponentDefinition} componentDef Component definition passed with the
 * `CMS.registerEditorComponent()` API.
 * @returns {LexicalNodeFeatures} The {@link CustomNode} class, a method to create a new node, and
 * the transformer definition.
 * @see https://decapcms.org/docs/custom-widgets/#registereditorcomponent
 * @see https://sveltiacms.app/en/docs/api/editor-components
 */
export const createLexicalNodeFeatures = (componentDef) => {
  const CustomNode = createCustomNodeClass(componentDef);

  return {
    node: CustomNode,
    /**
     * Create a new node. A pattern-based inline component with the `onInsert` option, created
     * without data when it’s inserted from the toolbar, remembers the selected text it replaces,
     * which `onInsert` receives. The function runs within the editor update that inserts the node,
     * where the selection can still be read.
     * @param {Record<string, any>} [props] Field properties.
     * @returns {LexicalNode} Node.
     */
    createNode: (props) => {
      const node = new CustomNode(props);

      if (!props && componentDef.inlinePattern?.onInsert) {
        node.__selectedText = getSelection()?.getTextContent() ?? '';
      }

      return node;
    },
    transformer: createTransformer({ componentDef, CustomNode }),
  };
};

/**
 * Text editor component implementation.
 */
export class EditorComponent {
  /**
   * Create an `EditorComponent` instance.
   * @param {ResolvedEditorComponentDefinition} componentDef Component definition passed with the
   * `CMS.registerEditorComponent()` API.
   */
  constructor(componentDef) {
    const features = getOrCreate(featureCacheMap, componentDef.id, () =>
      createLexicalNodeFeatures(componentDef),
    );

    Object.assign(this, { ...componentDef, ...features });
  }
}
