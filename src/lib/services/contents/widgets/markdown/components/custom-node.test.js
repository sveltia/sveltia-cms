// @ts-nocheck
/* eslint-disable jsdoc/require-jsdoc, max-classes-per-file */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createCustomNodeClass } from './custom-node.js';

// Set up DOM globals for tests
Object.defineProperty(globalThis, 'document', {
  value: {
    createElement: vi.fn((tagName) => ({
      tagName: tagName.toUpperCase(),
      setAttribute: vi.fn(),
      getAttribute: vi.fn(),
      classList: {
        add: vi.fn(),
        remove: vi.fn(),
        contains: vi.fn(),
      },
      appendChild: vi.fn(),
      removeChild: vi.fn(),
      focus: vi.fn(),
    })),
  },
  writable: true,
});

Object.defineProperty(globalThis, 'window', {
  value: {
    requestAnimationFrame: vi.fn((callback) => {
      callback();
      return 1;
    }),
  },
  writable: true,
});

// Mock dependencies with comprehensive DecoratorNode implementation
vi.mock('lexical', () => {
  const MockDecoratorNode = class {
    constructor(key) {
      this.__key = key;
      this.__props = {};
    }

    static getType() {
      return 'decorator';
    }

    static clone(node) {
      const cloned = new this(node.__key);

      cloned.__props = { ...node.__props };

      return cloned;
    }

    static importJSON(serializedNode) {
      const node = new this();

      return node.updateFromJSON(serializedNode);
    }

    static importDOM() {
      return {};
    }

    isInline() {
      return true;
    }

    isIsolated() {
      return true;
    }

    isKeyboardSelectable() {
      return true;
    }

    isTopLevel() {
      return false;
    }

    canBeEmpty() {
      return false;
    }

    canInsertTextBefore() {
      return false;
    }

    canInsertTextAfter() {
      return false;
    }

    exportJSON() {
      return {
        __props: this.__props || {},
        type: this.constructor.getType(),
        version: 1,
      };
    }

    updateFromJSON(serializedNode) {
      this.__props = serializedNode.__props || {};

      return this;
    }

    exportDOM() {
      return {
        element: document.createElement('div'),
      };
    }

    createDOM() {
      return document.createElement('div');
    }

    updateDOM() {
      return false;
    }
  };

  return {
    DecoratorNode: MockDecoratorNode,
    getNearestEditorFromDOMNode: vi.fn(() => ({
      getKey: () => 'test-key',
    })),
  };
});

vi.mock('svelte', () => ({
  flushSync: vi.fn(),
  mount: vi.fn(() => ({
    getElement: vi.fn(() => document.createElement('div')),
    destroy: vi.fn(),
  })),
  tick: vi.fn(() => Promise.resolve()),
  unmount: vi.fn(),
}));

vi.mock('$lib/components/contents/details/widgets/markdown/component.svelte', () => ({
  default: vi.fn(),
}));

vi.mock('./utils.js', () => ({
  isMultiLinePattern: vi.fn((pattern) => pattern.multiline || pattern.dotAll),
  normalizeProps: vi.fn((props) => props),
}));

// Import mocked functions after they're mocked
const { isMultiLinePattern } = await import('./utils.js');

describe('createCustomNodeClass', () => {
  const mockComponentDef = {
    id: 'test-component',
    label: 'Test Component',
    fields: [
      { name: 'title', label: 'Title', widget: 'string' },
      { name: 'content', label: 'Content', widget: 'text' },
    ],
    pattern: /{% test (.+?) %}/,
    /**
     * Convert properties to block format.
     * @param {Record<string, any>} props Properties.
     * @returns {string} Block string.
     */
    toBlock: (props) => `{% test ${props.title || ''} %}`,
    /**
     * Convert properties to preview format.
     * @param {Record<string, any>} props Properties.
     * @returns {string} Preview HTML.
     */
    toPreview: (props) => `<div>Test: ${props.title || ''}</div>`,
    /**
     * Extract properties from match array.
     * @param {RegExpMatchArray} match Regex match array.
     * @returns {Record<string, any>} Properties.
     */
    fromBlock: (match) => ({ title: match[1] }),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createCustomNodeClass', () => {
    it('should create a CustomNode class that extends DecoratorNode', () => {
      const CustomNode = createCustomNodeClass(mockComponentDef);

      expect(CustomNode).toBeDefined();
      expect(typeof CustomNode).toBe('function');
      // Due to mocking, we can't test instanceof directly, so we test the presence of methods
      expect(typeof CustomNode.getType).toBe('function');
      expect(typeof CustomNode.clone).toBe('function');
    });

    it('should create a node class with correct static methods', () => {
      const CustomNode = createCustomNodeClass(mockComponentDef);

      expect(typeof CustomNode.getType).toBe('function');
      expect(typeof CustomNode.clone).toBe('function');
      expect(typeof CustomNode.importJSON).toBe('function');
      expect(typeof CustomNode.importDOM).toBe('function');
    });

    it('should return correct component type from getType', () => {
      const CustomNode = createCustomNodeClass(mockComponentDef);

      expect(CustomNode.getType()).toBe('test-component');
    });

    it('should create instances with props', () => {
      const CustomNode = createCustomNodeClass(mockComponentDef);
      const props = { title: 'Test Title' };
      const node = new CustomNode(props);

      expect(node.__props).toEqual(props);
    });

    it('should create instances without props', () => {
      const CustomNode = createCustomNodeClass(mockComponentDef);
      const node = new CustomNode();

      expect(node.__props).toBeUndefined();
    });

    it('should handle inline nodes correctly', () => {
      vi.mocked(isMultiLinePattern).mockReturnValue(false);

      const CustomNode = createCustomNodeClass(mockComponentDef);
      const node = new CustomNode();

      expect(node.isInline()).toBe(true);
    });

    it('should handle block nodes correctly', () => {
      vi.mocked(isMultiLinePattern).mockReturnValue(true);

      const CustomNode = createCustomNodeClass(mockComponentDef);
      const node = new CustomNode();

      expect(node.isInline()).toBe(false);
    });

    it('should clone nodes correctly', () => {
      const CustomNode = createCustomNodeClass(mockComponentDef);
      const originalProps = { title: 'Original Title' };
      const originalNode = new CustomNode(originalProps, 'original-key');

      originalNode.__key = 'original-key';

      const clonedNode = CustomNode.clone(originalNode);

      expect(clonedNode).toBeInstanceOf(CustomNode);
      expect(clonedNode.__props).toEqual(originalProps);
      expect(clonedNode.__key).toBe('original-key');
    });

    it('should import JSON correctly', () => {
      const CustomNode = createCustomNodeClass(mockComponentDef);

      const serializedNode = {
        __props: { title: 'Imported Title' },
        type: 'test-component',
        version: 1,
      };

      const node = CustomNode.importJSON(serializedNode);

      expect(node).toBeInstanceOf(CustomNode);
      // The updateFromJSON method should be called on the new instance
    });

    it('should have exportJSON method', () => {
      const CustomNode = createCustomNodeClass(mockComponentDef);
      const props = { title: 'Export Title' };
      const node = new CustomNode(props);
      const exported = node.exportJSON();

      expect(exported).toEqual({
        title: 'Export Title',
        type: 'test-component',
        version: 1,
      });
    });

    it('should have updateFromJSON method', () => {
      const CustomNode = createCustomNodeClass(mockComponentDef);
      const node = new CustomNode();

      const serializedNode = {
        __props: { title: 'Updated Title' },
        type: 'test-component',
        version: 1,
      };

      const result = node.updateFromJSON(serializedNode);

      expect(result).toBe(node);
      expect(node.__props).toEqual(serializedNode.__props);
    });

    it('should handle DOM conversion', () => {
      const CustomNode = createCustomNodeClass(mockComponentDef);
      const domConversionMap = CustomNode.importDOM();

      expect(domConversionMap).toBeDefined();
      // The exact structure depends on the implementation
    });

    it('should handle exportDOM', () => {
      const CustomNode = createCustomNodeClass(mockComponentDef);
      const props = { title: 'DOM Export Title' };
      const node = new CustomNode(props);
      const domExport = node.exportDOM();

      expect(domExport).toBeDefined();
      expect(domExport.element).toBeDefined();
    });

    it('should handle createDOM', () => {
      const CustomNode = createCustomNodeClass(mockComponentDef);
      const props = { title: 'DOM Create Title' };
      const node = new CustomNode(props);
      const config = { theme: {} };
      const domElement = node.createDOM(config);

      expect(domElement).toBeDefined();
      expect(domElement.tagName).toBeDefined();
    });

    it('should handle updateDOM', () => {
      const CustomNode = createCustomNodeClass(mockComponentDef);
      const props = { title: 'DOM Update Title' };
      const node = new CustomNode(props);
      const prevNode = new CustomNode({ title: 'Previous Title' });
      const domElement = document.createElement('div');
      const config = { theme: {} };
      const shouldUpdate = node.updateDOM(prevNode, domElement, config);

      expect(typeof shouldUpdate).toBe('boolean');
    });

    it('should handle different component patterns', () => {
      const multilineComponentDef = {
        ...mockComponentDef,
        id: 'multiline-component',
        pattern: /^```test[\s\S]*?```$/m,
      };

      vi.mocked(isMultiLinePattern).mockReturnValue(true);

      const CustomNode = createCustomNodeClass(multilineComponentDef);
      const node = new CustomNode();

      expect(CustomNode.getType()).toBe('multiline-component');
      expect(node.isInline()).toBe(false);
    });

    it('should handle components with different tag names', () => {
      const componentDefWithImage = {
        ...mockComponentDef,
        id: 'image-component',
        /**
         * Convert properties to preview format.
         * @param {Record<string, any>} props Properties.
         * @returns {string} Preview HTML.
         */
        toPreview: (props) => `<img src="${props.src || ''}" alt="${props.alt || ''}">`,
      };

      const CustomNode = createCustomNodeClass(componentDefWithImage);

      expect(CustomNode).toBeDefined();
      expect(CustomNode.getType()).toBe('image-component');
    });
  });

  describe('CustomNode instance methods', () => {
    let CustomNode;
    let node;

    beforeEach(() => {
      CustomNode = createCustomNodeClass(mockComponentDef);
      node = /** @type {any} */ (new CustomNode({ title: 'Test Title' }));
    });

    it('should have isTopLevel method', () => {
      expect(typeof node.isTopLevel).toBe('function');
      expect(node.isTopLevel()).toBe(false);
    });

    it('should have canInsertTextBefore method', () => {
      expect(typeof node.canInsertTextBefore).toBe('function');
      expect(node.canInsertTextBefore()).toBe(false);
    });

    it('should have canInsertTextAfter method', () => {
      expect(typeof node.canInsertTextAfter).toBe('function');
      expect(node.canInsertTextAfter()).toBe(false);
    });

    it('should have canBeEmpty method', () => {
      expect(typeof node.canBeEmpty).toBe('function');
      expect(node.canBeEmpty()).toBe(false);
    });

    it('should have isIsolated method', () => {
      expect(typeof node.isIsolated).toBe('function');
      expect(node.isIsolated()).toBe(true);
    });

    it('should have isKeyboardSelectable method', () => {
      expect(typeof node.isKeyboardSelectable).toBe('function');
      expect(node.isKeyboardSelectable()).toBe(true);
    });
  });
});
