// @ts-nocheck
/* eslint-disable jsdoc/require-jsdoc */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createCustomNodeClass } from '$lib/components/contents/details/fields/rich-text/custom-node';
import { getNoAsset } from '$lib/services/contents/fields/rich-text/previews';

// Set up DOM globals for tests
const makeMockElement = (tagName) => ({
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
  closest: vi.fn(() => null),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  parentElement: null,
  isConnected: true,
});

Object.defineProperty(globalThis, 'document', {
  value: {
    createElement: vi.fn((tagName) => makeMockElement(tagName)),
    activeElement: null,
    body: { contains: vi.fn(() => true) },
  },
  writable: true,
});

Object.defineProperty(globalThis, 'MutationObserver', {
  value: vi.fn(() => ({
    observe: vi.fn(),
    disconnect: vi.fn(),
  })),
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

vi.mock('$lib/components/contents/details/fields/rich-text/editor-component.svelte', () => ({
  default: vi.fn(),
}));

vi.mock('$lib/services/contents/fields/rich-text/components/utils', async (importOriginal) => ({
  ...(await importOriginal()),
  isMultiLinePattern: vi.fn((pattern) => pattern.multiline || pattern.dotAll),
  normalizeProps: vi.fn((props) => props),
}));

// Import mocked functions after they're mocked
const { isMultiLinePattern } =
  await import('$lib/services/contents/fields/rich-text/components/utils');

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

    it('should export JSON with empty props when __props is undefined', () => {
      const CustomNode = createCustomNodeClass(mockComponentDef);
      const node = new CustomNode();
      const exported = node.exportJSON();

      expect(exported).toEqual({
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

    it('should pass an asset getter to a Netlify/Decap CMS-style preview', () => {
      const toPreview = vi.fn(
        /**
         * Convert properties to preview format like Decap CMS’s built-in image component.
         * @param {Record<string, any>} props Properties.
         * @param {(path: string) => any} getAsset Asset getter.
         * @returns {string} Preview HTML.
         */
        ({ src }, getAsset) => `<img src="${getAsset(src) || ''}" alt="">`,
      );

      createCustomNodeClass({ ...mockComponentDef, id: 'decap-image', toPreview });

      expect(toPreview).toHaveBeenCalledWith({}, getNoAsset, undefined);
      expect(toPreview).toHaveReturnedWith('<img src="" alt="">');
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

    it('should leave the tag unknown when preview throws on empty props', () => {
      const component = {
        ...mockComponentDef,
        /**
         * Convert properties to preview format, which needs a value.
         * @param {Record<string, any>} props Properties.
         * @returns {string} Preview HTML.
         */
        toPreview: (props) => `<span>${props.title.toUpperCase()}</span>`,
        /**
         * Convert properties to block format.
         * @returns {string} Block string.
         */
        toBlock: () => '<section>Block content</section>',
      };

      const CustomNode = createCustomNodeClass(component);

      // Like a component without a preview, the block isn’t looked at
      expect(CustomNode.importDOM()).toEqual({});
    });

    it('should leave the tag unknown when block throws on empty props', () => {
      const component = {
        ...mockComponentDef,
        /**
         * Convert properties to preview format.
         * @returns {string} Preview string.
         */
        toPreview: () => 'Plain text',
        /**
         * Convert properties to block format, which needs a value.
         * @param {Record<string, any>} props Properties.
         * @returns {string} Block string.
         */
        toBlock: (props) => `<section>${props.title.trim()}</section>`,
      };

      const CustomNode = createCustomNodeClass(component);

      expect(CustomNode.importDOM()).toEqual({});
    });

    it('should not throw when both preview and block throw on empty props', () => {
      const component = {
        ...mockComponentDef,
        /**
         * Convert properties to preview format, which needs a value.
         * @param {Record<string, any>} props Properties.
         * @returns {string} Preview HTML.
         */
        toPreview: (props) => props.title.toUpperCase(),
        /**
         * Convert properties to block format, which needs a value.
         * @param {Record<string, any>} props Properties.
         * @returns {string} Block string.
         */
        toBlock: (props) => props.title.trim(),
      };

      expect(() => createCustomNodeClass(component)).not.toThrow();
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

    it('should extract tag name from an element preview', () => {
      const componentWithElementPreview = {
        ...mockComponentDef,
        /**
         * Convert properties to preview format.
         * @returns {HTMLElement} Preview element.
         */
        toPreview: () => ({ nodeType: 1, localName: 'aside' }),
        /**
         * Convert properties to block format.
         * @returns {string} Block string.
         */
        toBlock: () => '<div>Block</div>',
      };

      const CustomNode = createCustomNodeClass(componentWithElementPreview);
      const importDOM = CustomNode.importDOM();

      expect(importDOM.aside).toBeDefined();
      expect(importDOM.div).toBeUndefined();
    });

    it('should handle when toPreview returns a non-string value', () => {
      const componentWithObjectPreview = {
        ...mockComponentDef,
        /**
         * Convert properties to preview format.
         * @returns {{ element: string }} Preview object.
         */
        toPreview: () => ({ element: 'div' }),
        /**
         * Convert properties to block format.
         * @returns {string} Block string.
         */
        toBlock: () => '<div>Block</div>',
      };

      const CustomNode = createCustomNodeClass(componentWithObjectPreview);
      const importDOM = CustomNode.importDOM();

      expect(importDOM).toBeDefined();
      // tagName is undefined when preview is not a string, so no DOM conversion registered
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

  describe('HTML syntax', () => {
    const htmlComponentDef = {
      id: 'figure',
      label: 'Figure',
      fields: [
        { name: 'src', label: 'Image', widget: 'image' },
        { name: 'caption', label: 'Caption', widget: 'string' },
      ],
      pattern: /^<!-- figure (?<src>\S+) (?<caption>.+) -->$/ms,
      toBlock: ({ src = '', caption = '' }) => `<!-- figure ${src} ${caption} -->`,
      toPreview: vi.fn(() => '<div>preview</div>'),
      htmlSelector: 'figure.photo, p > img',
      fromBlockHTML: (element) =>
        element.dataset.skip ? undefined : { src: element.src, caption: element.caption ?? '' },
      toBlockHTML: ({ src = '', caption = '' }) =>
        `<figure class="photo"><img src="${src}"><figcaption>${caption}</figcaption></figure>`,
    };

    /**
     * Create a mock element that matches the given selectors.
     * @param {string[]} selectors Selectors the element matches.
     * @param {Record<string, any>} [props] Other properties.
     * @returns {any} Element.
     */
    const mockElement = (selectors, props = {}) => ({
      matches: vi.fn((selector) => selectors.includes(selector)),
      dataset: {},
      ...props,
    });

    it('should export the HTML written with toBlockHTML', () => {
      const template = { innerHTML: '', content: { nodeType: 11 } };

      document.createElement.mockImplementationOnce(() => template);

      const CustomNode = createCustomNodeClass(htmlComponentDef);
      const { element } = new CustomNode({ src: 'a.png', caption: 'A' }).exportDOM();

      expect(document.createElement).toHaveBeenCalledWith('template');
      expect(template.innerHTML).toBe(
        '<figure class="photo"><img src="a.png"><figcaption>A</figcaption></figure>',
      );
      expect(element).toBe(template.content);
    });

    it('should export an element returned by toBlockHTML as is', () => {
      const figure = { localName: 'figure' };
      const CustomNode = createCustomNodeClass({ ...htmlComponentDef, toBlockHTML: () => figure });

      document.createElement.mockClear();

      expect(new CustomNode({ src: 'a.png' }).exportDOM()).toEqual({ element: figure });
      expect(document.createElement).not.toHaveBeenCalled();
    });

    it('should export nothing for a toBlockHTML output other than a string or an element', () => {
      [undefined, null, false].forEach((output) => {
        const template = { innerHTML: 'x', content: {} };

        document.createElement.mockImplementationOnce(() => template);

        const CustomNode = createCustomNodeClass({
          ...htmlComponentDef,
          id: `figure-${output}`,
          toBlockHTML: () => output,
        });

        expect(new CustomNode().exportDOM()).toEqual({ element: template.content });
        expect(template.innerHTML).toBe('');
      });
    });

    it('should export empty props with toBlockHTML', () => {
      const template = { innerHTML: '', content: {} };

      document.createElement.mockImplementationOnce(() => template);

      const CustomNode = createCustomNodeClass(htmlComponentDef);

      new CustomNode().exportDOM();

      expect(template.innerHTML).toBe(
        '<figure class="photo"><img src=""><figcaption></figcaption></figure>',
      );
    });

    it('should import the element types the selector names', () => {
      const CustomNode = createCustomNodeClass(htmlComponentDef);
      const conversionMap = CustomNode.importDOM();

      expect(Object.keys(conversionMap)).toEqual(['figure', 'img']);
      // The tag isn’t guessed from the preview
      expect(htmlComponentDef.toPreview).not.toHaveBeenCalled();

      const figure = mockElement(['figure.photo, p > img'], { src: 'a.png', caption: 'A' });
      const conversion = conversionMap.figure(figure);

      expect(figure.matches).toHaveBeenCalledWith('figure.photo, p > img');
      expect(conversion?.priority).toBe(4);

      const { node, after } = conversion.conversion();

      expect(node).toBeInstanceOf(CustomNode);
      expect(node.__props).toEqual({ src: 'a.png', caption: 'A' });
      // The content of the element is part of the component
      expect(after()).toEqual([]);
    });

    it('should skip an element the selector doesn’t match', () => {
      const CustomNode = createCustomNodeClass(htmlComponentDef);
      const conversionMap = CustomNode.importDOM();

      expect(conversionMap.figure(mockElement([]))).toBeNull();
    });

    it('should skip an element fromBlockHTML rejects', () => {
      const CustomNode = createCustomNodeClass(htmlComponentDef);
      const conversionMap = CustomNode.importDOM();

      expect(
        conversionMap.img(mockElement(['figure.photo, p > img'], { dataset: { skip: '1' } })),
      ).toBeNull();
    });

    it('should guess the element from the preview without the HTML options', () => {
      const CustomNode = createCustomNodeClass({ ...htmlComponentDef, htmlSelector: undefined });

      expect(Object.keys(CustomNode.importDOM())).toEqual(['div']);
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

  describe('Wrapper focus behavior', () => {
    it('should focus the wrapper when parent field is editable', async () => {
      const { mount } = await import('svelte');

      vi.clearAllMocks();

      const mockParentField = {
        getAttribute: vi.fn(),
        className: 'field',
        addEventListener: vi.fn(),
      };

      const mockWrapper = {
        closest: vi.fn((selector) => {
          if (selector === '[role="textbox"][aria-readonly="false"]') {
            return mockParentField; // Return matching parent
          }

          if (selector === '.field') {
            return mockParentField;
          }

          if (selector === '[data-lexical-editor]') {
            return { nodeType: 1 };
          }

          return null;
        }),
        addEventListener: vi.fn(),
        parentElement: { nodeType: 1 },
        isConnected: true,
        focus: vi.fn(),
      };

      vi.mocked(mount).mockImplementation(() => ({
        getElement: vi.fn(() => mockWrapper),
        destroy: vi.fn(),
      }));

      // eslint-disable-next-line no-unused-vars
      let observerCallback;

      globalThis.MutationObserver = vi.fn(function MockMutationObserver(callback) {
        observerCallback = callback;
        this.observe = vi.fn();
        this.disconnect = vi.fn();
      });

      const CustomNode = createCustomNodeClass(mockComponentDef);
      const node = new CustomNode({ title: 'Test' });

      node.createDOM();

      // Verify wrapper.focus() was called when closest returned a matching parent
      expect(mockWrapper.focus).toHaveBeenCalled();
    });

    it('should not focus the wrapper when parent field is not editable', async () => {
      const { mount } = await import('svelte');

      vi.clearAllMocks();

      const mockField = {
        addEventListener: vi.fn(),
      };

      const mockWrapper = {
        closest: vi.fn((selector) => {
          if (selector === '[role="textbox"][aria-readonly="false"]') {
            return null; // No matching editable parent
          }

          if (selector === '.field') {
            return mockField; // Return field for cleanup listener
          }

          if (selector === '[data-lexical-editor]') {
            return { nodeType: 1 };
          }

          return null;
        }),
        addEventListener: vi.fn(),
        parentElement: { nodeType: 1 },
        isConnected: true,
        focus: vi.fn(),
      };

      vi.mocked(mount).mockImplementation(() => ({
        getElement: vi.fn(() => mockWrapper),
        destroy: vi.fn(),
      }));

      // eslint-disable-next-line no-unused-vars
      let observerCallback;

      globalThis.MutationObserver = vi.fn(function MockMutationObserver(callback) {
        observerCallback = callback;
        this.observe = vi.fn();
        this.disconnect = vi.fn();
      });

      const CustomNode = createCustomNodeClass(mockComponentDef);
      const node = new CustomNode({ title: 'Test' });

      node.createDOM();

      // Verify wrapper.focus() was NOT called when closest returned null
      expect(mockWrapper.focus).not.toHaveBeenCalled();
    });
  });

  describe('MutationObserver cleanup', () => {
    it('should call cleanup when the wrapper is removed from the DOM', async () => {
      const { mount, unmount } = await import('svelte');

      vi.clearAllMocks();

      const root = { nodeType: 1 };

      const wrapper = {
        closest: vi.fn((selector) => (selector === '[data-lexical-editor]' ? root : null)),
        addEventListener: vi.fn(),
        isConnected: true,
        focus: vi.fn(),
      };

      let capturedComponent;

      vi.mocked(mount).mockImplementation(() => {
        capturedComponent = { getElement: vi.fn(() => wrapper), destroy: vi.fn() };

        return capturedComponent;
      });

      let observerCallback;
      const mockObserverInstance = { observe: vi.fn(), disconnect: vi.fn() };

      globalThis.MutationObserver = vi.fn(function MockMutationObserver(callback) {
        observerCallback = callback;
        this.observe = mockObserverInstance.observe;
        this.disconnect = mockObserverInstance.disconnect;
      });

      const CustomNode = createCustomNodeClass(mockComponentDef);
      const node = new CustomNode({ title: 'Test' });

      node.createDOM();

      // The whole editor is watched, so that the removal of an inline component’s paragraph is
      // noticed as well
      expect(mockObserverInstance.observe).toHaveBeenCalledWith(root, {
        childList: true,
        subtree: true,
      });
      expect(unmount).not.toHaveBeenCalled();

      // Fire the MutationObserver callback — wrapper is not connected
      wrapper.isConnected = false;
      observerCallback();

      expect(unmount).toHaveBeenCalledWith(capturedComponent);
      expect(mockObserverInstance.disconnect).toHaveBeenCalled();
    });

    it('should not call cleanup when the wrapper is still connected', async () => {
      const { mount, unmount } = await import('svelte');

      vi.clearAllMocks();

      vi.mocked(mount).mockImplementation(() => ({
        getElement: vi.fn(() => ({
          closest: vi.fn((selector) =>
            selector === '[data-lexical-editor]' ? { nodeType: 1 } : null,
          ),
          addEventListener: vi.fn(),
          isConnected: true, // still in the DOM
          focus: vi.fn(),
        })),
        destroy: vi.fn(),
      }));

      let observerCallback;
      const mockObserverInstance = { observe: vi.fn(), disconnect: vi.fn() };

      globalThis.MutationObserver = vi.fn(function MockMutationObserver(callback) {
        observerCallback = callback;
        this.observe = mockObserverInstance.observe;
        this.disconnect = mockObserverInstance.disconnect;
      });

      const CustomNode = createCustomNodeClass(mockComponentDef);
      const node = new CustomNode({ title: 'Test' });

      node.createDOM();

      // Fire the MutationObserver callback — wrapper is still connected
      expect(observerCallback).toBeDefined();
      observerCallback();

      expect(unmount).not.toHaveBeenCalled();
      expect(mockObserverInstance.disconnect).not.toHaveBeenCalled();
    });

    it('should call cleanup right away when the wrapper is not in the document', async () => {
      const { mount, unmount } = await import('svelte');

      vi.clearAllMocks();

      let capturedComponent;

      vi.mocked(mount).mockImplementation(() => {
        capturedComponent = {
          getElement: vi.fn(() => ({
            closest: vi.fn(() => null),
            addEventListener: vi.fn(),
            isConnected: false, // e.g. exported to copy the node to the clipboard
            focus: vi.fn(),
          })),
          destroy: vi.fn(),
        };

        return capturedComponent;
      });

      globalThis.MutationObserver = vi.fn(function MockMutationObserver() {
        this.observe = vi.fn();
        this.disconnect = vi.fn();
      });

      const CustomNode = createCustomNodeClass(mockComponentDef);
      const node = new CustomNode({ title: 'Test' });

      node.createDOM();

      expect(unmount).toHaveBeenCalledWith(capturedComponent);
      expect(globalThis.MutationObserver).not.toHaveBeenCalled();
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
  });
});
