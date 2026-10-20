// @ts-nocheck
/* eslint-disable max-classes-per-file, new-cap, no-extend-native */

import { $convertFromMarkdownString, $convertToMarkdownString } from '@lexical/markdown';
import { $getRoot, createEditor, DecoratorNode } from 'lexical';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createTransformer } from './transformers.js';
import { isMultiLinePattern, normalizeProps } from './utils.js';

// Mock dependencies
vi.mock('./utils.js', () => ({
  isMultiLinePattern: vi.fn(),
  normalizeProps: vi.fn((props) => props),
}));

describe('createTransformer', () => {
  let mockCustomNode;
  let mockComponentDef;

  beforeEach(() => {
    vi.clearAllMocks();

    /**
     * Mock custom node class.
     */
    mockCustomNode = class MockCustomNode {
      /**
       * Constructor for mock node.
       * @param {Record<string, any>} props Properties.
       */
      constructor(props) {
        this.__props = props;
      }

      /**
       * Get type method.
       * @returns {string} Type.
       */
      getType() {
        return 'test-component';
      }
    };

    mockComponentDef = {
      id: 'test-component',
      label: 'Test Component',
      pattern: /{% test (.+?) %}/,
      fields: [{ name: 'title', label: 'Title', widget: 'string' }],
      /**
       * Convert match to properties.
       * @param {RegExpMatchArray} match Match array.
       * @returns {Record<string, any>} Properties.
       */
      fromBlock: (match) => ({ title: match[1] }),
      /**
       * Convert properties to block.
       * @param {Record<string, any>} props Properties.
       * @returns {string} Block string.
       */
      toBlock: (props) => `{% test ${props.title || ''} %}`,
    };
  });

  describe('inline/singleline transformers', () => {
    beforeEach(() => {
      vi.mocked(isMultiLinePattern).mockReturnValue(false);
    });

    it('should create a text-match transformer for inline patterns', () => {
      const transformer = createTransformer({
        componentDef: mockComponentDef,
        CustomNode: mockCustomNode,
      });

      expect(transformer.type).toBe('text-match');
      expect(transformer.dependencies).toEqual([mockCustomNode]);
      expect(transformer.importRegExp).toEqual(expect.any(RegExp));
      expect(transformer.regExp).toEqual(expect.any(RegExp));
      expect(typeof transformer.replace).toBe('function');
      expect(typeof transformer.export).toBe('function');
    });

    it('should strip global flag from pattern regex', () => {
      const globalPattern = /{% test (.+?) %}/g;

      const componentDefWithGlobal = {
        ...mockComponentDef,
        pattern: globalPattern,
      };

      const transformer = createTransformer({
        componentDef: componentDefWithGlobal,
        CustomNode: mockCustomNode,
      });

      expect(transformer.regExp.global).toBe(false);
      expect(transformer.importRegExp.global).toBe(false);
    });

    it('should replace text node with custom node', () => {
      const transformer = createTransformer({
        componentDef: mockComponentDef,
        CustomNode: mockCustomNode,
      });

      const mockTextNode = {
        /**
         * Mock replace method.
         * @param {any} node Node to replace with.
         */
        replace: vi.fn((node) => node),
      };

      const matchArray = ['{% test Hello %}', 'Hello'];

      matchArray.groups = {};

      transformer.replace(mockTextNode, matchArray);

      expect(mockTextNode.replace).toHaveBeenCalledWith(expect.any(mockCustomNode));
    });

    it('should use fromBlock when available', () => {
      const transformer = createTransformer({
        componentDef: mockComponentDef,
        CustomNode: mockCustomNode,
      });

      const mockTextNode = {
        /**
         * Mock replace method.
         * @param {any} node Node to replace with.
         */
        replace: vi.fn(),
      };

      const matchArray = ['{% test Hello %}', 'Hello'];

      matchArray.groups = {};

      transformer.replace(mockTextNode, matchArray);

      const [[replacementNode]] = mockTextNode.replace.mock.calls;

      expect(replacementNode.__props).toEqual({ title: 'Hello' });
    });

    it('should use match groups when fromBlock is not available', () => {
      const componentDefWithoutFromBlock = {
        ...mockComponentDef,
        fromBlock: undefined,
      };

      const transformer = createTransformer({
        componentDef: componentDefWithoutFromBlock,
        CustomNode: mockCustomNode,
      });

      const mockTextNode = {
        /**
         * Mock replace method.
         * @param {any} node Node to replace with.
         */
        replace: vi.fn(),
      };

      const matchArray = ['{% test Hello %}', 'Hello'];

      matchArray.groups = { title: 'World' };

      transformer.replace(mockTextNode, matchArray);

      const [[replacementNode]] = mockTextNode.replace.mock.calls;

      expect(replacementNode.__props).toEqual({ title: 'World' });
    });

    it('should export custom nodes to markdown', () => {
      const transformer = createTransformer({
        componentDef: mockComponentDef,
        CustomNode: mockCustomNode,
      });

      const customNode = new mockCustomNode({ title: 'Test Title' });
      const result = transformer.export(customNode);

      expect(result).toBe('{% test Test Title %}');
      expect(normalizeProps).toHaveBeenCalledWith({ title: 'Test Title' });
    });

    it('should return null for non-custom nodes', () => {
      const transformer = createTransformer({
        componentDef: mockComponentDef,
        CustomNode: mockCustomNode,
      });

      /**
       * Mock other node type.
       */
      class OtherNode {
        /**
         * Get type method.
         * @returns {string} Type.
         */
        getType() {
          return 'other-type';
        }
      }

      const otherNode = new OtherNode();
      const result = transformer.export(otherNode);

      expect(result).toBeNull();
    });
  });

  describe('multiline/block transformers', () => {
    beforeEach(() => {
      vi.mocked(isMultiLinePattern).mockReturnValue(true);
    });

    it('should create a multiline-element transformer for multiline patterns', () => {
      const transformer = createTransformer({
        componentDef: mockComponentDef,
        CustomNode: mockCustomNode,
      });

      expect(transformer.type).toBe('multiline-element');
      expect(transformer.dependencies).toEqual([mockCustomNode]);
      expect(transformer.regExpStart).toEqual(/^./);
      expect(transformer.regExpEnd).toEqual({ optional: true, regExp: /.$/ });
      expect(typeof transformer.handleImportAfterStartMatch).toBe('function');
      expect(typeof transformer.replace).toBe('function');
      expect(typeof transformer.export).toBe('function');
    });

    it('should handle multiline import when pattern matches', () => {
      const multilinePattern = /^```test\n([\s\S]*?)\n```$/;

      const multilineComponentDef = {
        ...mockComponentDef,
        pattern: multilinePattern,
        /**
         * Convert match to properties.
         * @param {RegExpMatchArray} match Match array.
         * @returns {Record<string, any>} Properties.
         */
        fromBlock: (match) => ({ content: match[1] }),
      };

      const transformer = createTransformer({
        componentDef: multilineComponentDef,
        CustomNode: mockCustomNode,
      });

      // The lines need to match the pattern when joined with \n
      // Pattern: /^```test\n([\s\S]*?)\n```$/
      // So we need: "```test\nHello World\nSecond Line\n```"
      const lines = ['```test', 'Hello World', 'Second Line', '```'];

      const mockRootNode = {
        /**
         * Mock append method.
         * @param {any} node Node to append.
         */
        append: vi.fn(),
      };

      const result = transformer.handleImportAfterStartMatch({
        lines,
        rootNode: mockRootNode,
        startLineIndex: 0,
      });

      expect(result).toEqual([true, 3]); // [success, endLineIndex]
      expect(mockRootNode.append).toHaveBeenCalledWith(expect.any(mockCustomNode));
    });

    it('should return null when pattern does not match', () => {
      const transformer = createTransformer({
        componentDef: mockComponentDef,
        CustomNode: mockCustomNode,
      });

      const lines = ['Normal text', 'More text'];

      const mockRootNode = {
        /**
         * Mock append method.
         * @param {any} node Node to append.
         */
        append: vi.fn(),
      };

      const result = transformer.handleImportAfterStartMatch({
        lines,
        rootNode: mockRootNode,
        startLineIndex: 0,
      });

      expect(result).toBeNull();
      expect(mockRootNode.append).not.toHaveBeenCalled();
    });

    it('should return false when match does not start at beginning', () => {
      const multilinePattern = /^```test\n([\s\S]*?)\n```$/;

      const multilineComponentDef = {
        ...mockComponentDef,
        pattern: multilinePattern,
      };

      const transformer = createTransformer({
        componentDef: multilineComponentDef,
        CustomNode: mockCustomNode,
      });

      const lines = ['prefix ```test', 'content', '```'];

      const mockRootNode = {
        /**
         * Mock append method.
         * @param {any} node Node to append.
         */
        append: vi.fn(),
      };

      const result = transformer.handleImportAfterStartMatch({
        lines,
        rootNode: mockRootNode,
        startLineIndex: 0,
      });

      expect(result).toBeNull();
    });

    it('should handle edge case when match array is null', () => {
      // This creates a scenario where fullString.match() returns something
      // but matchString.match() returns null
      const problematicPattern = /(?=.*test)^.*$/m;

      const problematicComponentDef = {
        ...mockComponentDef,
        pattern: problematicPattern,
      };

      const transformer = createTransformer({
        componentDef: problematicComponentDef,
        CustomNode: mockCustomNode,
      });

      const lines = ['test content'];

      const mockRootNode = {
        /**
         * Mock append method.
         * @param {any} node Node to append.
         */
        append: vi.fn(),
      };

      // Mock the specific scenario where the pattern matches but produces null
      const originalMatch = String.prototype.match;
      let callCount = 0;

      vi.spyOn(String.prototype, 'match').mockImplementation(() => {
        callCount += 1;

        // First call returns a match, second call returns null
        if (callCount === 1) {
          return ['test content'];
        }

        return null;
      });

      const result = transformer.handleImportAfterStartMatch({
        lines,
        rootNode: mockRootNode,
        startLineIndex: 0,
      });

      expect(result).toEqual([false, 0]);

      // Restore original method
      String.prototype.match = originalMatch;
    });

    it('should export multiline custom nodes to markdown', () => {
      const transformer = createTransformer({
        componentDef: mockComponentDef,
        CustomNode: mockCustomNode,
      });

      const customNode = new mockCustomNode({ title: 'Test Title' });
      const result = transformer.export(customNode);

      expect(result).toBe('{% test Test Title %}');
    });

    it('should return undefined for replace method', () => {
      const transformer = createTransformer({
        componentDef: mockComponentDef,
        CustomNode: mockCustomNode,
      });

      const result = transformer.replace();

      expect(result).toBeUndefined();
    });

    describe('with the Lexical Markdown conversion', () => {
      /**
       * Minimal block decorator node standing in for the custom node class.
       */
      class AsideNode extends DecoratorNode {
        /**
         * Get the node type.
         * @returns {string} Type.
         */
        static getType() {
          return 'aside';
        }

        /**
         * Clone the node.
         * @param {AsideNode} node Node.
         * @returns {AsideNode} Clone.
         */
        static clone(node) {
          return new AsideNode(node.__props, node.__key);
        }

        /**
         * Constructor.
         * @param {Record<string, any>} [props] Properties.
         * @param {string} [key] Node key.
         */
        constructor(props = {}, key = undefined) {
          super(key);
          this.__props = props;
        }

        /**
         * Create the DOM, unused without a root element.
         * @returns {HTMLElement} Element.
         */
        createDOM() {
          return document.createElement('div');
        }

        /**
         * Update the DOM.
         * @returns {boolean} Whether to create the DOM again.
         */
        updateDOM() {
          return false;
        }

        /**
         * Whether the node is inline.
         * @returns {boolean} Result.
         */
        isInline() {
          return false;
        }

        /**
         * Decorate the node.
         * @returns {null} Nothing.
         */
        decorate() {
          return null;
        }
      }

      /**
       * Import the given Markdown into an editor with a transformer for the given pattern, then
       * export it again.
       * @param {RegExp} pattern Component pattern.
       * @param {string} markdown Markdown.
       * @returns {{ markdown: string, nodes: string[] }} Exported Markdown and the types of the
       * top-level nodes.
       */
      const roundTrip = (pattern, markdown) => {
        const transformer = createTransformer({
          componentDef: {
            id: 'aside',
            label: 'Aside',
            fields: [{ name: 'text', widget: 'string' }],
            pattern,
            /**
             * Convert properties to block.
             * @param {Record<string, any>} props Properties.
             * @returns {string} Block string.
             */
            toBlock: ({ text }) => `<aside>${text}</aside>`,
          },
          CustomNode: AsideNode,
        });

        const editor = createEditor({
          nodes: [AsideNode],
          /**
           * Rethrow an error.
           * @param {Error} error Error.
           * @throws {Error} The error.
           */
          onError: (error) => {
            throw error;
          },
        });

        let result = { markdown: '', nodes: [] };

        editor.update(() => $convertFromMarkdownString(markdown, [transformer]), {
          discrete: true,
        });
        editor.read(() => {
          result = {
            markdown: $convertToMarkdownString([transformer]),
            nodes: $getRoot()
              .getChildren()
              .map((node) => node.getType()),
          };
        });

        return result;
      };

      it('should convert a match that spans whole lines', () => {
        expect(
          roundTrip(/^<aside>(?<text>[\s\S]*?)<\/aside>/, '<aside>Note</aside>\n\nNext'),
        ).toEqual({ markdown: '<aside>Note</aside>\n\nNext', nodes: ['aside', 'paragraph'] });
      });

      it('should leave a match followed by text on its last line as text', () => {
        const pattern = /^<aside>(?<text>[\s\S]*?)<\/aside>/;

        expect(roundTrip(pattern, '<aside>Note</aside> trailing text\n\nNext')).toEqual({
          markdown: '<aside>Note</aside> trailing text\n\nNext',
          nodes: ['paragraph', 'paragraph'],
        });
        expect(roundTrip(pattern, '<aside>\nNote\n</aside> trailing\n\nNext').markdown).toBe(
          '<aside>\nNote\n</aside> trailing\n\nNext',
        );
        // Whitespace alone doesn’t count
        expect(roundTrip(pattern, '<aside>Note</aside>  \n\nNext').nodes).toEqual([
          'aside',
          'paragraph',
        ]);
      });

      it('should keep the line after a match that ends with a newline', () => {
        // Blocks are exported with a blank line between them
        expect(
          roundTrip(/^<aside>(?<text>[\s\S]*?)<\/aside>\n/, '<aside>Note</aside>\nNext'),
        ).toEqual({ markdown: '<aside>Note</aside>\n\nNext', nodes: ['aside', 'paragraph'] });
      });
    });
  });

  describe('edge cases', () => {
    it('should handle custom nodes without props', () => {
      vi.mocked(isMultiLinePattern).mockReturnValue(false);

      const transformer = createTransformer({
        componentDef: mockComponentDef,
        CustomNode: mockCustomNode,
      });

      const customNode = new mockCustomNode();

      customNode.__props = undefined;

      const result = transformer.export(customNode);

      expect(normalizeProps).toHaveBeenCalledWith({});
      expect(result).toBe('{% test  %}');
    });

    it('should handle components without toBlock method', () => {
      vi.mocked(isMultiLinePattern).mockReturnValue(false);

      const componentDefWithoutToBlock = {
        ...mockComponentDef,
        toBlock: undefined,
      };

      expect(() => {
        createTransformer({
          componentDef: componentDefWithoutToBlock,
          CustomNode: mockCustomNode,
        });
      }).not.toThrow();
    });

    it('should handle empty match groups', () => {
      vi.mocked(isMultiLinePattern).mockReturnValue(false);

      const componentDefWithoutFromBlock = {
        ...mockComponentDef,
        fromBlock: undefined,
      };

      const transformer = createTransformer({
        componentDef: componentDefWithoutFromBlock,
        CustomNode: mockCustomNode,
      });

      const mockTextNode = {
        /**
         * Mock replace method.
         * @param {any} node Node to replace with.
         */
        replace: vi.fn(),
      };

      const matchArray = ['{% test %}'];

      matchArray.groups = undefined;

      transformer.replace(mockTextNode, matchArray);

      const [[replacementNode]] = mockTextNode.replace.mock.calls;

      expect(replacementNode.__props).toEqual({});
    });
  });
});
