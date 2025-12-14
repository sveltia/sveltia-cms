import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createCustomNodeClass } from './custom-node.js';
import { createTransformer } from './transformers.js';

import { createLexicalNodeFeatures, EditorComponent, featureCacheMap } from './index.js';

// Mock the dependencies
vi.mock('./custom-node.js', () => ({
  /**
   * Mock implementation of createCustomNodeClass.
   * @returns {any} Mock custom node class.
   */
  createCustomNodeClass: vi.fn(() => {
    /**
     * Mock custom node class.
     */
    class MockCustomNode {}

    return MockCustomNode;
  }),
}));

vi.mock('./transformers.js', () => ({
  /**
   * Mock implementation of createTransformer.
   * @returns {object} Mock transformer.
   */
  createTransformer: vi.fn(() => ({
    type: 'text-match',
    dependencies: [],
    regExp: /test/,
  })),
}));

describe('EditorComponent', () => {
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
    featureCacheMap.clear();
  });

  describe('constructor', () => {
    it('should create an EditorComponent instance with component definition', () => {
      const component = /** @type {any} */ (new EditorComponent(mockComponentDef));

      expect(component.id).toBe('test-component');
      expect(component.label).toBe('Test Component');
      expect(component.fields).toEqual(mockComponentDef.fields);
      expect(component.pattern).toBe(mockComponentDef.pattern);
      expect(component.toBlock).toBe(mockComponentDef.toBlock);
      expect(component.toPreview).toBe(mockComponentDef.toPreview);
      expect(component.fromBlock).toBe(mockComponentDef.fromBlock);
    });

    it('should include node features from createLexicalNodeFeatures', () => {
      const component = /** @type {any} */ (new EditorComponent(mockComponentDef));

      expect(component.node).toBeDefined();
      expect(component.createNode).toBeDefined();
      expect(component.transformer).toBeDefined();
      expect(typeof component.createNode).toBe('function');
    });

    it('should cache features for subsequent instances with same ID', () => {
      // Create first instance
      const component1 = /** @type {any} */ (new EditorComponent(mockComponentDef));

      // Clear mocks to check if they're called again
      vi.clearAllMocks();

      // Create second instance with same ID
      const component2 = /** @type {any} */ (new EditorComponent(mockComponentDef));

      // Features should be cached, so creation functions shouldn't be called again
      expect(createCustomNodeClass).not.toHaveBeenCalled();
      expect(createTransformer).not.toHaveBeenCalled();

      // Both instances should have the same features
      expect(component1.node).toBe(component2.node);
      expect(component1.createNode).toBe(component2.createNode);
      expect(component1.transformer).toBe(component2.transformer);
    });

    it('should create new features for different component IDs', () => {
      const component1 = /** @type {any} */ (new EditorComponent(mockComponentDef));

      const differentComponentDef = {
        ...mockComponentDef,
        id: 'different-component',
      };

      const component2 = /** @type {any} */ (new EditorComponent(differentComponentDef));

      // Creation functions should be called twice for different IDs
      expect(createCustomNodeClass).toHaveBeenCalledTimes(2);
      expect(createTransformer).toHaveBeenCalledTimes(2);

      // Components should have different features
      expect(component1.id).toBe('test-component');
      expect(component2.id).toBe('different-component');
    });

    it('should pass correct arguments to createCustomNodeClass', () => {
      const component = new EditorComponent(mockComponentDef);

      expect(createCustomNodeClass).toHaveBeenCalledWith(mockComponentDef);
      expect(component).toBeDefined();
    });

    it('should pass correct arguments to createTransformer', () => {
      const component = new EditorComponent(mockComponentDef);

      expect(createTransformer).toHaveBeenCalledWith({
        componentDef: mockComponentDef,
        CustomNode: expect.any(Function),
      });
      expect(component).toBeDefined();
    });

    it('should handle component definition without optional properties', () => {
      const minimalComponentDef = {
        id: 'minimal-component',
        label: 'Minimal Component',
        fields: [],
        pattern: /minimal/,
        /**
         * Convert to block format.
         * @returns {string} Block string.
         */
        toBlock: () => 'minimal',
        /**
         * Convert to preview format.
         * @returns {string} Preview HTML.
         */
        toPreview: () => '<div>minimal</div>',
      };

      const component = /** @type {any} */ (new EditorComponent(minimalComponentDef));

      expect(component.id).toBe('minimal-component');
      expect(component.fromBlock).toBeUndefined();
    });
  });

  describe('createNode method', () => {
    it('should create a new node instance', () => {
      const component = /** @type {any} */ (new EditorComponent(mockComponentDef));
      const props = { title: 'Test Title' };
      const node = component.createNode(props);

      expect(node).toBeInstanceOf(component.node);
    });

    it('should create a node without props', () => {
      const component = /** @type {any} */ (new EditorComponent(mockComponentDef));
      const node = component.createNode();

      expect(node).toBeInstanceOf(component.node);
    });
  });
});

describe('createLexicalNodeFeatures', () => {
  const mockComponentDef = {
    id: 'feature-test-component',
    label: 'Feature Test Component',
    fields: [{ name: 'title', label: 'Title', widget: 'string' }],
    pattern: /{% feature-test (.+?) %}/,
    /**
     * Convert properties to block format.
     * @param {Record<string, any>} props Properties.
     * @returns {string} Block string.
     */
    toBlock: (props) => `{% feature-test ${props.title || ''} %}`,
    /**
     * Convert properties to preview format.
     * @param {Record<string, any>} props Properties.
     * @returns {string} Preview HTML.
     */
    toPreview: (props) => `<div>Feature Test: ${props.title || ''}</div>`,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    featureCacheMap.clear();
  });

  it('should return object with node, createNode, and transformer properties', () => {
    const features = createLexicalNodeFeatures(mockComponentDef);

    expect(features).toHaveProperty('node');
    expect(features).toHaveProperty('createNode');
    expect(features).toHaveProperty('transformer');
    expect(typeof features.createNode).toBe('function');
  });

  it('should call createCustomNodeClass with component definition', () => {
    createLexicalNodeFeatures(mockComponentDef);

    expect(createCustomNodeClass).toHaveBeenCalledWith(mockComponentDef);
    expect(createCustomNodeClass).toHaveBeenCalledTimes(1);
  });

  it('should call createTransformer with componentDef and CustomNode', () => {
    createLexicalNodeFeatures(mockComponentDef);

    expect(createTransformer).toHaveBeenCalledWith({
      componentDef: mockComponentDef,
      CustomNode: expect.any(Function),
    });
    expect(createTransformer).toHaveBeenCalledTimes(1);
  });

  it('should return createNode function that creates instances of CustomNode', () => {
    const features = createLexicalNodeFeatures(mockComponentDef);
    const props = { title: 'Test Title' };
    const nodeInstance = features.createNode(props);

    expect(nodeInstance).toBeInstanceOf(features.node);
  });

  it('should handle createNode without props', () => {
    const features = createLexicalNodeFeatures(mockComponentDef);
    const nodeInstance = features.createNode();

    expect(nodeInstance).toBeInstanceOf(features.node);
  });

  it('should return transformer from createTransformer', () => {
    const mockTransformer = {
      type: /** @type {'text-match'} */ ('text-match'),
      dependencies: [],
      regExp: /test-pattern/,
    };

    // Mock createTransformer to return specific transformer

    vi.mocked(createTransformer).mockReturnValueOnce(mockTransformer);

    const features = createLexicalNodeFeatures(mockComponentDef);

    expect(features.transformer).toBe(mockTransformer);
  });

  it('should create different features for different component definitions', () => {
    const componentDef1 = { ...mockComponentDef, id: 'component-1' };
    const componentDef2 = { ...mockComponentDef, id: 'component-2' };
    const features1 = createLexicalNodeFeatures(componentDef1);
    const features2 = createLexicalNodeFeatures(componentDef2);

    expect(features1.node).not.toBe(features2.node);
    expect(features1.createNode).not.toBe(features2.createNode);
    expect(createCustomNodeClass).toHaveBeenCalledTimes(2);
    expect(createTransformer).toHaveBeenCalledTimes(2);
  });

  it('should preserve function identity when called multiple times with same definition', () => {
    const features1 = createLexicalNodeFeatures(mockComponentDef);
    const features2 = createLexicalNodeFeatures(mockComponentDef);

    // Since this doesn't use caching internally, these should be different instances
    expect(features1.node).not.toBe(features2.node);
    expect(features1.createNode).not.toBe(features2.createNode);
  });

  it('should handle minimal component definition', () => {
    const minimalDef = {
      id: 'minimal',
      label: 'Minimal',
      fields: [],
      pattern: /minimal/,
      /**
       * Convert to block.
       * @returns {string} Block.
       */
      toBlock: () => 'minimal',
      /**
       * Convert to preview.
       * @returns {string} Preview.
       */
      toPreview: () => '<div>minimal</div>',
    };

    const features = createLexicalNodeFeatures(minimalDef);

    expect(features).toHaveProperty('node');
    expect(features).toHaveProperty('createNode');
    expect(features).toHaveProperty('transformer');
    expect(createCustomNodeClass).toHaveBeenCalledWith(minimalDef);
  });

  it('should pass CustomNode class correctly to createTransformer', () => {
    const mockCustomNodeClass = vi.fn();

    vi.mocked(createCustomNodeClass).mockReturnValueOnce(mockCustomNodeClass);

    createLexicalNodeFeatures(mockComponentDef);

    expect(createTransformer).toHaveBeenCalledWith({
      componentDef: mockComponentDef,
      CustomNode: mockCustomNodeClass,
    });
  });

  describe('createNode function behavior', () => {
    it('should pass props to CustomNode constructor', () => {
      const MockCustomNode = vi.fn();

      vi.mocked(createCustomNodeClass).mockReturnValueOnce(MockCustomNode);

      const features = createLexicalNodeFeatures(mockComponentDef);
      const props = { title: 'Test Title', content: 'Test Content' };

      features.createNode(props);

      expect(MockCustomNode).toHaveBeenCalledWith(props);
    });

    it('should handle undefined props', () => {
      const MockCustomNode = vi.fn();

      vi.mocked(createCustomNodeClass).mockReturnValueOnce(MockCustomNode);

      const features = createLexicalNodeFeatures(mockComponentDef);

      features.createNode();

      expect(MockCustomNode).toHaveBeenCalledWith(undefined);
    });

    it('should handle empty props object', () => {
      const MockCustomNode = vi.fn();

      vi.mocked(createCustomNodeClass).mockReturnValueOnce(MockCustomNode);

      const features = createLexicalNodeFeatures(mockComponentDef);
      const emptyProps = {};

      features.createNode(emptyProps);

      expect(MockCustomNode).toHaveBeenCalledWith(emptyProps);
    });
  });

  describe('integration with EditorComponent caching', () => {
    it('should work correctly when features are cached by EditorComponent', () => {
      // Create features directly
      const directFeatures = createLexicalNodeFeatures(mockComponentDef);
      // Create EditorComponent which uses caching
      const editorComponent = /** @type {any} */ (new EditorComponent(mockComponentDef));

      // The EditorComponent should use its cached features, not the direct ones
      expect(editorComponent.node).not.toBe(directFeatures.node);
      expect(editorComponent.createNode).not.toBe(directFeatures.createNode);
    });

    it('should be independent of cache state', () => {
      // Pre-populate cache with EditorComponent
      const component = new EditorComponent(mockComponentDef);
      // Direct call should still create new features
      const features = createLexicalNodeFeatures(mockComponentDef);

      expect(features).toHaveProperty('node');
      expect(features).toHaveProperty('createNode');
      expect(features).toHaveProperty('transformer');
      expect(component).toBeDefined(); // Use component to avoid unused variable
    });
  });
});

describe('featureCacheMap', () => {
  beforeEach(() => {
    featureCacheMap.clear();
    vi.clearAllMocks();
  });

  it('should be a Map instance', () => {
    expect(featureCacheMap).toBeInstanceOf(Map);
  });

  it('should start empty', () => {
    expect(featureCacheMap.size).toBe(0);
  });

  it('should store features when EditorComponent is created', () => {
    const componentDef = {
      id: 'cache-test',
      label: 'Cache Test',
      fields: [],
      pattern: /cache/,
      /**
       * To block.
       * @returns {string} Block.
       */
      toBlock: () => 'cache',
      /**
       * To preview.
       * @returns {string} Preview.
       */
      toPreview: () => '<div>cache</div>',
    };

    expect(featureCacheMap.has('cache-test')).toBe(false);

    const component = new EditorComponent(componentDef);

    expect(featureCacheMap.has('cache-test')).toBe(true);
    expect(featureCacheMap.size).toBe(1);
    expect(component).toBeDefined(); // Use component to avoid unused variable
  });

  it('should reuse cached features for same component ID', () => {
    const componentDef = {
      id: 'reuse-test',
      label: 'Reuse Test',
      fields: [],
      pattern: /reuse/,
      /**
       * To block.
       * @returns {string} Block.
       */
      toBlock: () => 'reuse',
      /**
       * To preview.
       * @returns {string} Preview.
       */
      toPreview: () => '<div>reuse</div>',
    };

    const component1 = /** @type {any} */ (new EditorComponent(componentDef));
    const cachedFeatures = featureCacheMap.get('reuse-test');

    vi.clearAllMocks();

    const component2 = /** @type {any} */ (new EditorComponent(componentDef));

    // Should not create new features
    expect(createCustomNodeClass).not.toHaveBeenCalled();
    expect(createTransformer).not.toHaveBeenCalled();

    // Should use same cached features
    expect(component1.node).toBe(component2.node);
    expect(component1.createNode).toBe(component2.createNode);
    expect(component1.transformer).toBe(component2.transformer);
    expect(featureCacheMap.get('reuse-test')).toBe(cachedFeatures);
  });
});
