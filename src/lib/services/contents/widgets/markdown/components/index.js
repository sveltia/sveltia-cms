import { createCustomNodeFeatures } from '$lib/services/contents/widgets/markdown/components/features';

/**
 * @import { EditorComponentDefinition } from '$lib/types/public';
 * @import { CustomNodeFeatures } from '$lib/types/private';
 */

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
   * @param {EditorComponentDefinition} componentDef Component definition passed with the
   * `CMS.registerEditorComponent()` API.
   */
  constructor(componentDef) {
    const { id } = componentDef;
    const cache = featureCacheMap.get(id);
    const features = cache ?? createCustomNodeFeatures(componentDef);

    if (!cache) {
      featureCacheMap.set(id, features);
    }

    Object.assign(this, { ...componentDef, ...features });
  }
}
