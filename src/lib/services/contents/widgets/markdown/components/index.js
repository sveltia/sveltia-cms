import { createCustomNodeClass } from '$lib/services/contents/widgets/markdown/components/custom-node';
import { createTransformer } from '$lib/services/contents/widgets/markdown/components/transformers';

/**
 * @import { LexicalNode } from 'lexical';
 * @import { Transformer } from '@lexical/markdown';
 * @import { EditorComponentDefinition } from '$lib/types/public';
 */

/**
 * Custom Lexical node features.
 * @typedef {object} CustomNodeFeatures
 * @property {any} node Lexical node class implementation.
 * @property {(props?: Record<string, any>) => LexicalNode} createNode Function to create a new node
 * instance.
 * @property {Transformer} transformer Node transformer.
 */

/**
 * Cache the class and related features to avoid a Lexical error saying “Type ... In node CustomNode
 * does not match registered node CustomNode with the same type”.
 * @type {Map<string, CustomNodeFeatures>}
 */
const featureCacheMap = new Map();

/**
 * Dynamically create a custom {@link DecoratorNode} class and related features for the Lexical
 * editor to enable support for editor components in Markdown.
 * @param {EditorComponentDefinition} componentDef Component definition passed with the
 * `CMS.registerEditorComponent()` API.
 * @returns {CustomNodeFeatures} The {@link CustomNode} class, a method to create a new node, and
 * the transformer definition.
 * @see https://decapcms.org/docs/custom-widgets/#registereditorcomponent
 */
const createLexicalFeatures = (componentDef) => {
  const CustomNode = createCustomNodeClass(componentDef);

  return {
    node: CustomNode,
    // eslint-disable-next-line jsdoc/require-jsdoc
    createNode: (props) => new CustomNode(props),
    transformer: createTransformer({ componentDef, CustomNode }),
  };
};

/**
 * Text editor component implementation.
 */
export class EditorComponent {
  /**
   * Create an `EditorComponent` instance.
   * @param {EditorComponentDefinition} componentDef Component definition passed with the
   * `CMS.registerEditorComponent()` API.
   */
  constructor(componentDef) {
    const { id } = componentDef;
    const cache = featureCacheMap.get(id);
    const features = cache ?? createLexicalFeatures(componentDef);

    if (!cache) {
      featureCacheMap.set(id, features);
    }

    Object.assign(this, { ...componentDef, ...features });
  }
}
