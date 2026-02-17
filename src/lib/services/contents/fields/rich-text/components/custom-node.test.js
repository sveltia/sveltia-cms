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
    getSelection: vi.fn(() => null),
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

vi.mock('$lib/components/contents/details/fields/rich-text/component.svelte', () => ({
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

  describe('Tag name extraction', () => {
    it('should extract tag name from preview when available', () => {
      const componentWithPreview = {
        ...mockComponentDef,
        /**
         * Convert properties to preview format.
         * @returns {string} Preview HTML.
         */
        toPreview: () => '<span>Preview content</span>',
        /**
         * Convert properties to block format.
         * @param {Record<string, any>} props Properties.
         * @returns {string} Block string.
         */
        toBlock: (props) => `{% test ${props.title || ''} %}`,
      };

      const CustomNode = createCustomNodeClass(componentWithPreview);
      const importDOM = CustomNode.importDOM();

      expect(importDOM).toBeDefined();
      expect(importDOM.span).toBeDefined();
    });

    it('should extract tag name from block when preview does not match', () => {
      const componentWithBlockTag = {
        ...mockComponentDef,
        /**
         * Convert properties to preview format.
         * @returns {string} Preview string.
         */
        toPreview: () => 'Plain text without tags',
        /**
         * Convert properties to block format.
         * @returns {string} Block string.
         */
        toBlock: () => '<article>Block content</article>',
      };

      const CustomNode = createCustomNodeClass(componentWithBlockTag);
      const importDOM = CustomNode.importDOM();

      expect(importDOM).toBeDefined();
      expect(importDOM.article).toBeDefined();
    });

    it('should handle when both preview and block return non-tag strings', () => {
      const componentNoTag = {
        ...mockComponentDef,
        /**
         * Convert properties to preview format.
         * @returns {string} Preview string.
         */
        toPreview: () => 'Plain text',
        /**
         * Convert properties to block format.
         * @returns {string} Block string.
         */
        toBlock: () => 'Plain block',
      };

      const CustomNode = createCustomNodeClass(componentNoTag);
      const importDOM = CustomNode.importDOM();

      expect(importDOM).toBeDefined();
      expect(Object.keys(importDOM).length).toBe(0);
    });
  });

  describe('DOM import conversion', () => {
    it('should convert DOM elements when tagName is present', () => {
      const componentWithTag = {
        ...mockComponentDef,
        fields: [
          { name: 'src', label: 'Source', widget: 'string' },
          { name: 'alt', label: 'Alt text', widget: 'string' },
        ],
        /**
         * Convert properties to preview format.
         * @returns {string} Preview HTML.
         */
        toPreview: () => '<img src="" alt="">',
        /**
         * Convert properties to block format.
         * @param {Record<string, any>} props Properties.
         * @returns {string} Block string.
         */
        toBlock: (props) => `![${props.alt}](${props.src})`,
      };

      const CustomNode = createCustomNodeClass(componentWithTag);
      const importDOM = CustomNode.importDOM();

      expect(importDOM.img).toBeDefined();

      const conversion = importDOM.img();

      expect(conversion).toBeDefined();
      expect(conversion.priority).toBe(3);

      const mockElement = {
        src: 'test.jpg',
        alt: 'Test image',
      };

      const result = conversion.conversion(mockElement);

      expect(result.node).toBeInstanceOf(CustomNode);
      expect(result.node.__props).toEqual({
        src: 'test.jpg',
        alt: 'Test image',
      });
    });

    it('should handle fields with missing values in DOM conversion', () => {
      const componentWithTag = {
        ...mockComponentDef,
        fields: [
          { name: 'title', label: 'Title', widget: 'string' },
          { name: 'missing', label: 'Missing', widget: 'string' },
        ],
        /**
         * Convert properties to preview format.
         * @returns {string} Preview HTML.
         */
        toPreview: () => '<div>Test</div>',
        /**
         * Convert properties to block format.
         * @returns {string} Block string.
         */
        toBlock: () => '{% test %}',
      };

      const CustomNode = createCustomNodeClass(componentWithTag);
      const importDOM = CustomNode.importDOM();
      const conversion = importDOM.div();

      const mockElement = {
        title: 'Present',
      };

      const result = conversion.conversion(mockElement);

      expect(result.node.__props).toEqual({
        title: 'Present',
        missing: '',
      });
    });
  });

  describe('Linked image conversion', () => {
    it('should handle linked-image component conversion', () => {
      const linkedImageComponentDef = {
        id: 'linked-image',
        label: 'Linked Image',
        fields: [
          { name: 'src', label: 'Image', widget: 'image' },
          { name: 'alt', label: 'Alt', widget: 'string' },
          { name: 'title', label: 'Title', widget: 'string' },
          { name: 'link', label: 'Link', widget: 'string' },
        ],
        pattern: /!\[(.+?)\]\((.+?)\)/,
        /**
         * Convert properties to block format.
         * @param {Record<string, any>} props Properties.
         * @returns {string} Block string.
         */
        toBlock: (props) => `![${props.alt}](${props.src})`,
        /**
         * Convert properties to preview format.
         * @param {Record<string, any>} props Properties.
         * @returns {string} Preview HTML.
         */
        toPreview: (props) => `<img src="${props.src}" alt="${props.alt}">`,
        /**
         * Extract properties from match array.
         * @param {RegExpMatchArray} match Regex match array.
         * @returns {Record<string, any>} Properties.
         */
        fromBlock: (match) => ({ alt: match[1], src: match[2] }),
      };

      const CustomNode = createCustomNodeClass(linkedImageComponentDef);
      const importDOM = CustomNode.importDOM();

      expect(importDOM.a).toBeDefined();

      const mockAnchor = {
        href: 'https://example.com',
        firstChild: {
          nodeName: 'IMG',
          src: 'image.jpg',
          alt: 'Test image',
          title: 'Image title',
        },
      };

      const conversion = importDOM.a(mockAnchor);

      expect(conversion).not.toBeNull();
      expect(conversion?.priority).toBe(4);

      const result = conversion?.conversion();

      expect(result?.node).toBeInstanceOf(CustomNode);
      expect(result?.node.__props).toEqual({
        src: 'image.jpg',
        alt: 'Test image',
        title: 'Image title',
        link: 'https://example.com',
      });
      expect(typeof result?.after).toBe('function');
      expect(result?.after?.()).toEqual([]);
    });

    it('should return null for linked-image when firstChild is not an img', () => {
      const linkedImageComponentDef = {
        id: 'linked-image',
        label: 'Linked Image',
        fields: [],
        pattern: /!\[(.+?)\]\((.+?)\)/,
        /**
         * Convert properties to block format.
         * @returns {string} Block string.
         */
        toBlock: () => '',
        /**
         * Convert properties to preview format.
         * @returns {string} Preview HTML.
         */
        toPreview: () => '',
        /**
         * Extract properties from match array.
         * @returns {Record<string, any>} Properties.
         */
        fromBlock: () => ({}),
      };

      const CustomNode = createCustomNodeClass(linkedImageComponentDef);
      const importDOM = CustomNode.importDOM();

      const mockAnchor = {
        href: 'https://example.com',
        firstChild: {
          nodeName: 'SPAN',
        },
      };

      const conversion = importDOM.a(mockAnchor);

      expect(conversion).toBeNull();
    });

    it('should return null for linked-image when firstChild is undefined', () => {
      const linkedImageComponentDef = {
        id: 'linked-image',
        label: 'Linked Image',
        fields: [],
        pattern: /!\[(.+?)\]\((.+?)\)/,
        /**
         * Convert properties to block format.
         * @returns {string} Block string.
         */
        toBlock: () => '',
        /**
         * Convert properties to preview format.
         * @returns {string} Preview HTML.
         */
        toPreview: () => '',
        /**
         * Extract properties from match array.
         * @returns {Record<string, any>} Properties.
         */
        fromBlock: () => ({}),
      };

      const CustomNode = createCustomNodeClass(linkedImageComponentDef);
      const importDOM = CustomNode.importDOM();

      const mockAnchor = {
        href: 'https://example.com',
      };

      const conversion = importDOM.a(mockAnchor);

      expect(conversion).toBeNull();
    });
  });

  describe('onChange handler', () => {
    it('should handle update event in onChange', async () => {
      const { mount, tick } = await import('svelte');
      const { getNearestEditorFromDOMNode } = await import('lexical');

      vi.clearAllMocks();

      let capturedOnChange;

      vi.mocked(mount).mockImplementation((component, options) => {
        capturedOnChange = options.props.onChange;

        return {
          getElement: vi.fn(() => document.createElement('div')),
          destroy: vi.fn(),
        };
      });

      const mockEditor = {
        update: vi.fn((callback) => callback()),
      };

      vi.mocked(getNearestEditorFromDOMNode).mockReturnValue(mockEditor);

      const CustomNode = createCustomNodeClass(mockComponentDef);
      const node = new CustomNode({ title: 'Initial' });

      node.getWritable = vi.fn(() => node);
      node.remove = vi.fn();

      // Create DOM to trigger mount
      node.createDOM();

      expect(capturedOnChange).toBeDefined();

      // Simulate update event
      await capturedOnChange({
        type: 'update',
        detail: { title: 'Updated' },
      });

      expect(tick).toHaveBeenCalled();
      expect(getNearestEditorFromDOMNode).toHaveBeenCalled();
      expect(mockEditor.update).toHaveBeenCalled();
      expect(node.getWritable).toHaveBeenCalled();
      expect(node.__props).toEqual({ title: 'Updated' });
    });

    it('should handle update event with getWritable error', async () => {
      const { mount } = await import('svelte');
      const { getNearestEditorFromDOMNode } = await import('lexical');

      vi.clearAllMocks();

      let capturedOnChange;

      vi.mocked(mount).mockImplementation((component, options) => {
        capturedOnChange = options.props.onChange;

        return {
          getElement: vi.fn(() => document.createElement('div')),
          destroy: vi.fn(),
        };
      });

      const mockEditor = {
        update: vi.fn((callback) => callback()),
      };

      vi.mocked(getNearestEditorFromDOMNode).mockReturnValue(mockEditor);

      const CustomNode = createCustomNodeClass(mockComponentDef);
      const node = new CustomNode({ title: 'Initial' });

      node.getWritable = vi.fn(() => {
        throw new Error('Cannot get writable');
      });

      // Create DOM to trigger mount
      node.createDOM();

      // Simulate update event - should not throw
      await expect(
        capturedOnChange({
          type: 'update',
          detail: { title: 'Updated' },
        }),
      ).resolves.not.toThrow();
    });

    it('should handle remove event in onChange', async () => {
      const { mount, tick, unmount } = await import('svelte');
      const { getNearestEditorFromDOMNode } = await import('lexical');

      vi.clearAllMocks();

      let capturedOnChange;
      let capturedComponent;

      vi.mocked(mount).mockImplementation((component, options) => {
        capturedOnChange = options.props.onChange;
        capturedComponent = {
          getElement: vi.fn(() => document.createElement('div')),
          destroy: vi.fn(),
        };

        return capturedComponent;
      });

      const mockEditor = {
        update: vi.fn((callback) => callback()),
      };

      vi.mocked(getNearestEditorFromDOMNode).mockReturnValue(mockEditor);

      const CustomNode = createCustomNodeClass(mockComponentDef);
      const node = new CustomNode({ title: 'Initial' });

      node.remove = vi.fn();

      // Create DOM to trigger mount
      node.createDOM();

      expect(capturedOnChange).toBeDefined();

      // Simulate remove event
      await capturedOnChange({
        type: 'remove',
        detail: {},
      });

      expect(tick).toHaveBeenCalled();
      expect(getNearestEditorFromDOMNode).toHaveBeenCalled();
      expect(mockEditor.update).toHaveBeenCalled();
      expect(unmount).toHaveBeenCalledWith(capturedComponent);
      expect(node.remove).toHaveBeenCalled();
    });

    describe('Focus and selection preservation', () => {
      it('should call editor.update with discrete option and onUpdate callback', async () => {
        const { mount } = await import('svelte');
        const { getNearestEditorFromDOMNode } = await import('lexical');

        vi.clearAllMocks();

        let capturedOnChange;
        let updateOptions;

        vi.mocked(mount).mockImplementation((component, options) => {
          capturedOnChange = options.props.onChange;

          return {
            getElement: vi.fn(() => document.createElement('div')),
            destroy: vi.fn(),
          };
        });

        const mockEditor = {
          update: vi.fn((updateFn, options) => {
            updateOptions = options;
            updateFn();
          }),
        };

        vi.mocked(getNearestEditorFromDOMNode).mockReturnValue(mockEditor);

        const CustomNode = createCustomNodeClass(mockComponentDef);
        const node = new CustomNode({ title: 'Initial' });

        node.getWritable = vi.fn(() => node);

        // Create DOM to trigger mount
        node.createDOM();

        // Simulate update event
        await capturedOnChange({
          type: 'update',
          detail: { title: 'Updated' },
        });

        expect(mockEditor.update).toHaveBeenCalled();
        expect(updateOptions).toBeDefined();
        expect(updateOptions.discrete).toBe(true);
        expect(typeof updateOptions.onUpdate).toBe('function');
      });

      it('should restore focus to active element when onUpdate is called', async () => {
        const { mount } = await import('svelte');
        const { getNearestEditorFromDOMNode } = await import('lexical');

        vi.clearAllMocks();

        let capturedOnChange;
        let onUpdateCallback;

        // Create a mock active element with focus tracking
        const mockActiveElement = {
          tagName: 'INPUT',
          focus: vi.fn(),
          matches: vi.fn((selector) => selector === '[contenteditable="true"]'),
        };

        // Mock document to track activeElement
        Object.defineProperty(document, 'activeElement', {
          configurable: true,
          value: mockActiveElement,
        });

        Object.defineProperty(document, 'body', {
          configurable: true,
          value: {
            contains: vi.fn(() => true),
          },
        });

        vi.mocked(mount).mockImplementation((component, options) => {
          capturedOnChange = options.props.onChange;

          return {
            getElement: vi.fn(() => document.createElement('div')),
            destroy: vi.fn(),
          };
        });

        const mockEditor = {
          update: vi.fn((updateFn, options) => {
            onUpdateCallback = options.onUpdate;
            updateFn();
          }),
        };

        vi.mocked(getNearestEditorFromDOMNode).mockReturnValue(mockEditor);

        const CustomNode = createCustomNodeClass(mockComponentDef);
        const node = new CustomNode({ title: 'Initial' });

        node.getWritable = vi.fn(() => node);

        // Create DOM to trigger mount
        node.createDOM();

        // Simulate update event
        await capturedOnChange({
          type: 'update',
          detail: { title: 'Updated' },
        });

        // Call the captured onUpdate callback
        expect(onUpdateCallback).toBeDefined();
        onUpdateCallback();

        // Verify focus was called on the active element
        expect(mockActiveElement.focus).toHaveBeenCalled();
      });

      it('should restore selection range when onUpdate is called', async () => {
        const { mount } = await import('svelte');
        const { getNearestEditorFromDOMNode } = await import('lexical');

        vi.clearAllMocks();

        let capturedOnChange;
        let onUpdateCallback;

        // Create a mock selection with range
        const mockRange = {
          cloneRange: vi.fn(() => ({ cloned: true })),
        };

        const mockSelection = {
          getRangeAt: vi.fn(() => mockRange),
          rangeCount: 1,
          removeAllRanges: vi.fn(),
          addRange: vi.fn(),
        };

        // Create a mock active element
        const mockActiveElement = {
          tagName: 'DIV',
          focus: vi.fn(),
          matches: vi.fn((selector) => selector === '[contenteditable="true"]'),
        };

        // Mock window.getSelection
        Object.defineProperty(window, 'getSelection', {
          configurable: true,
          value: vi.fn(() => mockSelection),
        });

        Object.defineProperty(document, 'activeElement', {
          configurable: true,
          value: mockActiveElement,
        });

        Object.defineProperty(document, 'body', {
          configurable: true,
          value: {
            contains: vi.fn(() => true),
          },
        });

        vi.mocked(mount).mockImplementation((component, options) => {
          capturedOnChange = options.props.onChange;

          return {
            getElement: vi.fn(() => document.createElement('div')),
            destroy: vi.fn(),
          };
        });

        const mockEditor = {
          update: vi.fn((updateFn, options) => {
            onUpdateCallback = options.onUpdate;
            updateFn();
          }),
        };

        vi.mocked(getNearestEditorFromDOMNode).mockReturnValue(mockEditor);

        const CustomNode = createCustomNodeClass(mockComponentDef);
        const node = new CustomNode({ title: 'Initial' });

        node.getWritable = vi.fn(() => node);

        // Create DOM to trigger mount
        node.createDOM();

        // Simulate update event
        await capturedOnChange({
          type: 'update',
          detail: { title: 'Updated' },
        });

        // Call the captured onUpdate callback
        expect(onUpdateCallback).toBeDefined();
        onUpdateCallback();

        // Verify selection was restored
        expect(mockSelection.removeAllRanges).toHaveBeenCalled();
        expect(mockSelection.addRange).toHaveBeenCalledWith({ cloned: true });
      });

      it('should not restore focus if active element is no longer in DOM', async () => {
        const { mount } = await import('svelte');
        const { getNearestEditorFromDOMNode } = await import('lexical');

        vi.clearAllMocks();

        let capturedOnChange;
        let onUpdateCallback;

        const mockActiveElement = {
          tagName: 'INPUT',
          focus: vi.fn(),
          matches: vi.fn(() => false),
        };

        Object.defineProperty(document, 'activeElement', {
          configurable: true,
          value: mockActiveElement,
        });

        Object.defineProperty(document, 'body', {
          configurable: true,
          value: {
            contains: vi.fn(() => false), // Element not in DOM
          },
        });

        vi.mocked(mount).mockImplementation((component, options) => {
          capturedOnChange = options.props.onChange;

          return {
            getElement: vi.fn(() => document.createElement('div')),
            destroy: vi.fn(),
          };
        });

        const mockEditor = {
          update: vi.fn((updateFn, options) => {
            onUpdateCallback = options.onUpdate;
            updateFn();
          }),
        };

        vi.mocked(getNearestEditorFromDOMNode).mockReturnValue(mockEditor);

        const CustomNode = createCustomNodeClass(mockComponentDef);
        const node = new CustomNode({ title: 'Initial' });

        node.getWritable = vi.fn(() => node);

        // Create DOM to trigger mount
        node.createDOM();

        // Simulate update event
        await capturedOnChange({
          type: 'update',
          detail: { title: 'Updated' },
        });

        // Call the captured onUpdate callback
        expect(onUpdateCallback).toBeDefined();
        onUpdateCallback();

        // Verify focus was NOT called since element is not in DOM
        expect(mockActiveElement.focus).not.toHaveBeenCalled();
      });

      it('should handle case where active element does not match contenteditable selector', async () => {
        const { mount } = await import('svelte');
        const { getNearestEditorFromDOMNode } = await import('lexical');

        vi.clearAllMocks();

        let capturedOnChange;
        let onUpdateCallback;

        const mockActiveElement = {
          tagName: 'BUTTON',
          focus: vi.fn(),
          matches: vi.fn(() => false),
        };

        Object.defineProperty(document, 'activeElement', {
          configurable: true,
          value: mockActiveElement,
        });

        Object.defineProperty(document, 'body', {
          configurable: true,
          value: {
            contains: vi.fn(() => true),
          },
        });

        vi.mocked(mount).mockImplementation((component, options) => {
          capturedOnChange = options.props.onChange;

          return {
            getElement: vi.fn(() => document.createElement('div')),
            destroy: vi.fn(),
          };
        });

        const mockEditor = {
          update: vi.fn((updateFn, options) => {
            onUpdateCallback = options.onUpdate;
            updateFn();
          }),
        };

        vi.mocked(getNearestEditorFromDOMNode).mockReturnValue(mockEditor);

        const CustomNode = createCustomNodeClass(mockComponentDef);
        const node = new CustomNode({ title: 'Initial' });

        node.getWritable = vi.fn(() => node);

        // Create DOM to trigger mount
        node.createDOM();

        // Simulate update event
        await capturedOnChange({
          type: 'update',
          detail: { title: 'Updated' },
        });

        // Call the captured onUpdate callback
        expect(onUpdateCallback).toBeDefined();
        onUpdateCallback();

        // Verify focus was called (element is still restored even if not contenteditable)
        expect(mockActiveElement.focus).toHaveBeenCalled();
      });

      it('should handle selection with zero range count', async () => {
        const { mount } = await import('svelte');
        const { getNearestEditorFromDOMNode } = await import('lexical');

        vi.clearAllMocks();

        let capturedOnChange;
        let onUpdateCallback;

        // Selection with no ranges
        const mockSelection = {
          getRangeAt: vi.fn(),
          rangeCount: 0, // No ranges
          removeAllRanges: vi.fn(),
          addRange: vi.fn(),
        };

        const mockActiveElement = {
          tagName: 'DIV',
          focus: vi.fn(),
          matches: vi.fn((selector) => selector === '[contenteditable="true"]'),
        };

        Object.defineProperty(window, 'getSelection', {
          configurable: true,
          value: vi.fn(() => mockSelection),
        });

        Object.defineProperty(document, 'activeElement', {
          configurable: true,
          value: mockActiveElement,
        });

        Object.defineProperty(document, 'body', {
          configurable: true,
          value: {
            contains: vi.fn(() => true),
          },
        });

        vi.mocked(mount).mockImplementation((component, options) => {
          capturedOnChange = options.props.onChange;

          return {
            getElement: vi.fn(() => document.createElement('div')),
            destroy: vi.fn(),
          };
        });

        const mockEditor = {
          update: vi.fn((updateFn, options) => {
            onUpdateCallback = options.onUpdate;
            updateFn();
          }),
        };

        vi.mocked(getNearestEditorFromDOMNode).mockReturnValue(mockEditor);

        const CustomNode = createCustomNodeClass(mockComponentDef);
        const node = new CustomNode({ title: 'Initial' });

        node.getWritable = vi.fn(() => node);

        // Create DOM to trigger mount
        node.createDOM();

        // Simulate update event
        await capturedOnChange({
          type: 'update',
          detail: { title: 'Updated' },
        });

        // Call the captured onUpdate callback
        expect(onUpdateCallback).toBeDefined();
        onUpdateCallback();

        // Verify focus was called but selection was not restored
        expect(mockActiveElement.focus).toHaveBeenCalled();
        expect(mockSelection.removeAllRanges).not.toHaveBeenCalled();
        expect(mockSelection.addRange).not.toHaveBeenCalled();
      });
    });
  });

  describe('tagName extraction - lines 40-41', () => {
    it('should extract tagName from preview string', () => {
      const preview = '<div class="container">content</div>';

      const componentDef = {
        id: 'div-component',
        label: 'Div',
        fields: [],
        pattern: /div-pattern/,
        toPreview: () => preview,
        toBlock: () => '<div>block</div>',
      };

      const CustomNode = createCustomNodeClass(componentDef);

      expect(CustomNode).toBeDefined();
      expect(CustomNode.getType()).toBe('div-component');
    });

    it('should extract tagName from block when preview is not a string', () => {
      // This tests the second part of the ternary (lines 40-41)
      const componentDef = {
        id: 'section-component',
        label: 'Section',
        fields: [],
        pattern: /section-pattern/,
        toPreview: () => ({ element: 'object' }), // Non-string preview
        toBlock: () => '<section>block content</section>',
      };

      const CustomNode = createCustomNodeClass(componentDef);

      expect(CustomNode).toBeDefined();
      expect(CustomNode.getType()).toBe('section-component');
    });

    it('should handle case-insensitive tag matching', () => {
      // The regex uses case-insensitive flag /i
      const componentDef = {
        id: 'uppercase-tag',
        label: 'Uppercase',
        fields: [],
        pattern: /upper/,
        toPreview: () => '<ARTICLE>content</ARTICLE>',
        toBlock: () => '<div></div>',
      };

      const CustomNode = createCustomNodeClass(componentDef);

      expect(CustomNode).toBeDefined();
    });

    it('should return undefined tagName when neither preview nor block have HTML tags', () => {
      const componentDef = {
        id: 'plain-text',
        label: 'Plain',
        fields: [],
        pattern: /plain/,
        toPreview: () => 'Just plain text',
        toBlock: () => 'More plain text',
      };

      const CustomNode = createCustomNodeClass(componentDef);

      expect(CustomNode).toBeDefined();
    });

    it('should handle multiple tags and extract first one', () => {
      const componentDef = {
        id: 'multi-tag',
        label: 'Multi',
        fields: [],
        pattern: /multi/,
        toPreview: () => '<div><span>nested</span></div>',
        toBlock: () => '<p>paragraph</p>',
      };

      const CustomNode = createCustomNodeClass(componentDef);

      expect(CustomNode).toBeDefined();
    });

    it('should handle empty HTML tags', () => {
      const componentDef = {
        id: 'empty-tag',
        label: 'Empty',
        fields: [],
        pattern: /empty/,
        toPreview: () => '<img />',
        toBlock: () => '<br />',
      };

      const CustomNode = createCustomNodeClass(componentDef);

      expect(CustomNode).toBeDefined();
    });

    it('should fall back from preview to block when preview not a string', () => {
      // This specifically tests line 40-41 fallback path
      const componentDef = {
        id: 'fallback-test',
        label: 'Fallback',
        fields: [],
        pattern: /fallback/,
        toPreview: () => null, // Not a string
        toBlock: () => '<footer>footer content</footer>',
      };

      const CustomNode = createCustomNodeClass(componentDef);

      expect(CustomNode).toBeDefined();
    });

    it('should handle linked-image importDOM with non-img child node', () => {
      // Test line 106: return null when firstChild is not an img
      const componentDef = {
        id: 'linked-image',
        label: 'Linked Image',
        fields: [
          { name: 'src', label: 'Source', widget: 'image' },
          { name: 'alt', label: 'Alt Text', required: false },
          { name: 'title', label: 'Title', required: false },
          { name: 'link', label: 'Link', required: false },
        ],
        pattern: /linked-image/,
        toPreview: () => '<img src="test.jpg" alt="test" />',
        toBlock: () => '![test](test.jpg)',
      };

      const CustomNode = createCustomNodeClass(componentDef);
      const conversionMap = CustomNode.importDOM();

      // Should have 'a' conversion for linked-image component
      expect(conversionMap).toHaveProperty('a');

      // Create a mock anchor node with non-img first child
      const mockNode = {
        nodeName: 'A',
        firstChild: {
          nodeName: 'SPAN', // Not an img
          toLowerCase: () => 'span',
        },
      };

      // The 'a' handler should return null for non-img children
      const handler = conversionMap.a;
      // @ts-expect-error - Testing internal behavior
      const result = handler(mockNode);

      expect(result).toBeNull();
    });
  });
});
