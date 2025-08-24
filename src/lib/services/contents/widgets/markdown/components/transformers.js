import {
  isMultiLinePattern,
  normalizeProps,
} from '$lib/services/contents/widgets/markdown/components/utils';

/**
 * @import { LexicalNode } from 'lexical';
 * @import {
 * MultilineElementTransformer,
 * TextMatchTransformer,
 * Transformer,
 * } from '@lexical/markdown';
 * @import { EditorComponentDefinition } from '$lib/types/public';
 */

/**
 * Create a singleline/inline or multiline transformer for the given component definition.
 * @param {object} args Arguments.
 * @param {EditorComponentDefinition} args.componentDef Component definition passed with the
 * `CMS.registerEditorComponent()` API.
 * @param {any} args.CustomNode Lexical node class implementation.
 * @param {(props?: Record<string, any>) => LexicalNode} args.createNode Function to create a new
 * node instance.
 * @returns {Transformer} Transformer.
 * @see https://decapcms.org/docs/custom-widgets/#registereditorcomponent
 * @see https://lexical.dev/docs/packages/lexical-markdown#transformers
 * @see https://lexical.dev/docs/api/modules/lexical_markdown
 * @see https://github.com/sveltia/sveltia-cms/issues/410
 * @see https://github.com/decaporg/decap-cms/issues/1044
 * @see https://github.com/facebook/lexical/blob/main/packages/lexical-playground/src/plugins/MarkdownTransformers/index.ts#L75-L97
 * @see https://github.com/facebook/lexical/blob/main/packages/lexical-markdown/src/MarkdownTransformers.ts#L81-L148
 * @see https://github.com/facebook/lexical/blob/main/packages/lexical-markdown/src/MarkdownTransformers.ts#L376-L457
 * @see https://github.com/facebook/lexical/blob/main/packages/lexical-markdown/src/__tests__/unit/LexicalMarkdown.test.ts#L86-L115
 * @see https://github.com/facebook/lexical/blob/main/packages/lexical-markdown/src/__tests__/unit/LexicalMarkdown.test.ts#L117-L224
 */
export const createTransformer = ({ componentDef, CustomNode, createNode }) => {
  const { id: componentName, pattern, fromBlock, toBlock } = componentDef;
  const nonGlobalPattern = new RegExp(pattern.source, pattern.flags.replace('g', ''));
  /**
   * Get node properties from the given regex match array.
   * @param {RegExpMatchArray} matchArray Match array.
   * @returns {Record<string, any>} Properties.
   */
  const getProps = (matchArray) => fromBlock?.(matchArray) ?? matchArray.groups ?? {};
  /**
   * Whether the given node is an instance of {@link CustomNode}.
   * @param {LexicalNode} node Node.
   * @returns {boolean} Result.
   */
  const isCustomNode = (node) => node instanceof CustomNode && node.getType() === componentName;

  /**
   * Convert the given node to Markdown.
   * @param {LexicalNode} node Node.
   * @returns {string | null} Markdown string.
   */
  const exportNode = (node) => {
    if (isCustomNode(node)) {
      return toBlock(normalizeProps(/** @type {any} */ (node).__props ?? {}));
    }

    return null;
  };

  if (isMultiLinePattern(pattern)) {
    return /** @type {MultilineElementTransformer} */ ({
      /* eslint-disable jsdoc/require-jsdoc */
      type: 'multiline-element',
      dependencies: [CustomNode],
      // Match every line to check for a multiline pattern. It’s not great for performance, but
      // (part of) the developer-defined `pattern` cannot be used because it can be complex
      regExpStart: /^./,
      regExpEnd: { optional: true, regExp: /.$/ },
      handleImportAfterStartMatch: ({ lines, rootNode, startLineIndex }) => {
        const fullString = lines.slice(startLineIndex).join('\n');
        const [matchString] = fullString.match(nonGlobalPattern) ?? [];

        if (!matchString || !fullString.startsWith(matchString)) {
          return null;
        }

        const matchArray = matchString.match(nonGlobalPattern);
        const endLineIndex = startLineIndex + matchString.split('\n').length - 1;

        if (!matchArray) {
          // this should not happen
          return [false, endLineIndex];
        }

        rootNode.append(createNode(getProps(matchArray)));

        return [true, endLineIndex];
      },
      replace: () => undefined,
      export: exportNode,
      /* eslint-enable jsdoc/require-jsdoc */
    });
  }

  return /** @type {TextMatchTransformer} */ ({
    /* eslint-disable jsdoc/require-jsdoc */
    type: 'text-match',
    dependencies: [CustomNode],
    importRegExp: nonGlobalPattern,
    regExp: nonGlobalPattern,
    replace: (textNode, matchArray) => {
      textNode.replace(createNode(getProps(matchArray)));
    },
    export: exportNode,
    /* eslint-enable jsdoc/require-jsdoc */
  });
};
