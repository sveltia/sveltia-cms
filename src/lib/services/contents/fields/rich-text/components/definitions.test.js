// @ts-nocheck
/* eslint-disable jsdoc/require-jsdoc */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  customComponentRegistry,
  getBuiltInComponentDefs,
  getComponentDef,
  IMAGE_COMPONENT,
  LINKED_IMAGE_COMPONENT,
} from './definitions.js';

// Mock dependencies
vi.mock('svelte/store', () => ({
  get: vi.fn((store) => {
    if (typeof store === 'function') return store;
    return (key) => key;
  }),
}));

vi.mock('svelte-i18n', () => ({
  _: vi.fn((key) => key),
}));

vi.mock('./utils.js', () => ({
  encodeQuotes: vi.fn((str) => str.replace(/"/g, '&quot;')),
  replaceQuotes: vi.fn((str) => str.replace(/"/g, "'")),
}));

vi.mock('$lib/services/contents/fields/rich-text/constants', () => ({
  IMAGE_OR_LINKED_IMAGE_REGEX: /!\[([^\]]*)\]\(([^)]+)\)/g,
  IMAGE_REGEX: /!\[([^\]]*)\]\(([^)]+)\)/,
}));

describe('definitions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    customComponentRegistry.clear();
  });

  describe('customComponentRegistry', () => {
    it('should be a Map instance', () => {
      expect(customComponentRegistry).toBeInstanceOf(Map);
    });

    it('should allow adding custom components', () => {
      const customComponent = {
        id: 'custom-test',
        label: 'Custom Test',
        fields: [],
        pattern: /test/,
        toBlock: () => 'test',
        toPreview: () => '<div>test</div>',
      };

      customComponentRegistry.set('custom-test', customComponent);

      expect(customComponentRegistry.has('custom-test')).toBe(true);
      expect(customComponentRegistry.get('custom-test')).toBe(customComponent);
    });

    it('should allow removing custom components', () => {
      const customComponent = {
        id: 'removable-test',
        label: 'Removable Test',
        fields: [],
        pattern: /test/,
        toBlock: () => 'test',
        toPreview: () => '<div>test</div>',
      };

      customComponentRegistry.set('removable-test', customComponent);
      expect(customComponentRegistry.has('removable-test')).toBe(true);

      customComponentRegistry.delete('removable-test');
      expect(customComponentRegistry.has('removable-test')).toBe(false);
    });
  });

  describe('IMAGE_COMPONENT', () => {
    it('should have correct structure', () => {
      expect(IMAGE_COMPONENT.id).toBe('image');
      expect(IMAGE_COMPONENT.label).toBe('Image');
      expect(Array.isArray(IMAGE_COMPONENT.fields)).toBe(true);
      expect(IMAGE_COMPONENT.fields).toHaveLength(3);
      expect(typeof IMAGE_COMPONENT.toBlock).toBe('function');
      expect(typeof IMAGE_COMPONENT.toPreview).toBe('function');
    });

    it('should have correct field definitions', () => {
      const [srcField, altField, titleField] = IMAGE_COMPONENT.fields;

      expect(srcField.name).toBe('src');
      expect(srcField.label).toBe('Source');
      expect(srcField.widget).toBe('image');

      expect(altField.name).toBe('alt');
      expect(altField.label).toBe('Alt Text');
      expect(altField.required).toBe(false);

      expect(titleField.name).toBe('title');
      expect(titleField.label).toBe('Title');
      expect(titleField.required).toBe(false);
    });

    describe('toBlock method', () => {
      it('should generate markdown for image with all properties', () => {
        const props = {
          src: 'https://example.com/image.jpg',
          alt: 'Test image',
          title: 'Test title',
        };

        const result = IMAGE_COMPONENT.toBlock(props);

        expect(result).toBe('![Test image](https://example.com/image.jpg "Test title")');
      });

      it('should generate markdown for image without title', () => {
        const props = {
          src: 'https://example.com/image.jpg',
          alt: 'Test image',
        };

        const result = IMAGE_COMPONENT.toBlock(props);

        expect(result).toBe('![Test image](https://example.com/image.jpg)');
      });

      it('should return empty string when no src provided', () => {
        const props = {
          alt: 'Test image',
          title: 'Test title',
        };

        const result = IMAGE_COMPONENT.toBlock(props);

        expect(result).toBe('');
      });
    });

    describe('toPreview method', () => {
      it('should generate HTML for image with all properties', () => {
        const props = {
          src: 'https://example.com/image.jpg',
          alt: 'Test image',
          title: 'Test title',
        };

        const result = IMAGE_COMPONENT.toPreview(props);

        expect(result).toBe(
          '<img src="https://example.com/image.jpg" alt="Test image" title="Test title">',
        );
      });

      it('should generate HTML for image without properties', () => {
        const props = {};
        const result = IMAGE_COMPONENT.toPreview(props);

        expect(result).toBe('<img src="" alt="" title="">');
      });
    });
  });

  describe('LINKED_IMAGE_COMPONENT', () => {
    it('should have correct structure', () => {
      expect(LINKED_IMAGE_COMPONENT.id).toBe('linked-image');
      expect(LINKED_IMAGE_COMPONENT.label).toBe('Image');
      expect(Array.isArray(LINKED_IMAGE_COMPONENT.fields)).toBe(true);
      expect(LINKED_IMAGE_COMPONENT.fields).toHaveLength(4);
      expect(typeof LINKED_IMAGE_COMPONENT.toBlock).toBe('function');
      expect(typeof LINKED_IMAGE_COMPONENT.toPreview).toBe('function');
      expect(typeof LINKED_IMAGE_COMPONENT.fromBlock).toBe('function');
    });

    it('should include link field in addition to image fields', () => {
      const linkField = LINKED_IMAGE_COMPONENT.fields.find((field) => field.name === 'link');

      expect(linkField).toBeDefined();
      expect(linkField.label).toBe('Link');
      expect(linkField.required).toBe(false);
    });

    describe('toBlock method', () => {
      it('should generate markdown for linked image', () => {
        const props = {
          src: 'https://example.com/image.jpg',
          alt: 'Test image',
          title: 'Test title',
          link: 'https://example.com',
        };

        const result = LINKED_IMAGE_COMPONENT.toBlock(props);

        expect(result).toBe(
          '[![Test image](https://example.com/image.jpg "Test title")](https://example.com)',
        );
      });

      it('should generate markdown for image without link', () => {
        const props = {
          src: 'https://example.com/image.jpg',
          alt: 'Test image',
          title: 'Test title',
        };

        const result = LINKED_IMAGE_COMPONENT.toBlock(props);

        expect(result).toBe('![Test image](https://example.com/image.jpg "Test title")');
      });

      it('should generate markdown for linked image without title', () => {
        const props = {
          src: 'https://example.com/image.jpg',
          alt: 'Test image',
          link: 'https://example.com',
        };

        const result = LINKED_IMAGE_COMPONENT.toBlock(props);

        expect(result).toBe('[![Test image](https://example.com/image.jpg)](https://example.com)');
      });

      it('should return empty string for linked image without src', () => {
        const props = {
          alt: 'Test image',
          title: 'Test title',
          link: 'https://example.com',
        };

        const result = LINKED_IMAGE_COMPONENT.toBlock(props);

        expect(result).toBe('');
      });

      it('should return empty string for image without src and without link', () => {
        const props = {
          alt: 'Test image',
          title: 'Test title',
        };

        const result = LINKED_IMAGE_COMPONENT.toBlock(props);

        expect(result).toBe('');
      });
    });

    describe('toPreview method', () => {
      it('should generate HTML for linked image', () => {
        const props = {
          src: 'https://example.com/image.jpg',
          alt: 'Test image',
          title: 'Test title',
          link: 'https://example.com',
        };

        const result = LINKED_IMAGE_COMPONENT.toPreview(props);

        expect(result).toBe(
          '<a href="https://example.com"><img src="https://example.com/image.jpg" alt="Test image" title="Test title"></a>',
        );
      });

      it('should generate HTML for image without link', () => {
        const props = {
          src: 'https://example.com/image.jpg',
          alt: 'Test image',
          title: 'Test title',
        };

        const result = LINKED_IMAGE_COMPONENT.toPreview(props);

        expect(result).toBe(
          '<img src="https://example.com/image.jpg" alt="Test image" title="Test title">',
        );
      });
    });

    describe('fromBlock method', () => {
      it('should parse image markdown correctly', () => {
        const match = {
          groups: {
            src: 'https://example.com/image.jpg',
            alt: 'Test image',
            title: 'Test title',
            link: 'https://example.com',
          },
        };

        const result = LINKED_IMAGE_COMPONENT.fromBlock(match);

        expect(result).toEqual({
          src: 'https://example.com/image.jpg',
          alt: 'Test image',
          title: 'Test title',
          link: 'https://example.com',
        });
      });

      it('should handle missing groups', () => {
        const match = { groups: undefined };
        const result = LINKED_IMAGE_COMPONENT.fromBlock(match);

        expect(result).toEqual({
          src: '',
          alt: '',
          title: '',
          link: '',
        });
      });
    });
  });

  describe('getBuiltInComponentDefs', () => {
    it('should return array of built-in component definitions', () => {
      const builtInDefs = getBuiltInComponentDefs();

      expect(Array.isArray(builtInDefs)).toBe(true);
      expect(builtInDefs.length).toBe(2);
    });

    it('should include image and linked-image components', () => {
      const builtInDefs = getBuiltInComponentDefs();
      const imageComponent = builtInDefs.find((def) => def.id === 'image');
      const linkedImageComponent = builtInDefs.find((def) => def.id === 'linked-image');

      expect(imageComponent).toBeDefined();
      expect(linkedImageComponent).toBeDefined();
    });

    it('should return components with localized labels', () => {
      const builtInDefs = getBuiltInComponentDefs();

      builtInDefs.forEach((def) => {
        expect(typeof def.label).toBe('string');
        expect(def.label.length).toBeGreaterThan(0);
      });
    });
  });

  describe('getComponentDef', () => {
    it('should return built-in image component by id', () => {
      const imageDef = getComponentDef('image');

      expect(imageDef).toBeDefined();
      expect(imageDef?.id).toBe('image');
      expect(imageDef?.label).toBeDefined();
      expect(Array.isArray(imageDef?.fields)).toBe(true);
      expect(typeof imageDef?.toBlock).toBe('function');
      expect(typeof imageDef?.toPreview).toBe('function');
    });

    it('should return built-in linked-image component by id', () => {
      const linkedImageDef = getComponentDef('linked-image');

      expect(linkedImageDef).toBeDefined();
      expect(linkedImageDef?.id).toBe('linked-image');
      expect(linkedImageDef?.label).toBeDefined();
      expect(Array.isArray(linkedImageDef?.fields)).toBe(true);
      expect(typeof linkedImageDef?.toBlock).toBe('function');
      expect(typeof linkedImageDef?.toPreview).toBe('function');
    });

    it('should return custom component by id', () => {
      const customComponent = {
        id: 'custom-component',
        label: 'Custom Component',
        fields: [],
        pattern: /custom/,
        toBlock: () => 'custom',
        toPreview: () => '<div>custom</div>',
      };

      customComponentRegistry.set('custom-component', customComponent);

      const result = getComponentDef('custom-component');

      expect(result).toBe(customComponent);
    });

    it('should prioritize custom components over built-in ones', () => {
      const customImageComponent = {
        id: 'image',
        label: 'Custom Image Component',
        fields: [],
        pattern: /custom-image/,
        toBlock: () => 'custom-image',
        toPreview: () => '<div>custom-image</div>',
      };

      customComponentRegistry.set('image', customImageComponent);

      const result = getComponentDef('image');

      expect(result).toBe(customImageComponent);
      expect(result?.label).toBe('Custom Image Component');
    });

    it('should return undefined for non-existent component', () => {
      const result = getComponentDef('non-existent');

      expect(result).toBeUndefined();
    });

    it('should handle empty string id', () => {
      const result = getComponentDef('');

      expect(result).toBeUndefined();
    });

    it('should test image component functionality', () => {
      const imageDef = getComponentDef('image');

      if (imageDef) {
        // Test toBlock method
        const blockResult = imageDef.toBlock({
          src: 'https://example.com/image.jpg',
          alt: 'Test image',
          title: 'Test title',
        });

        expect(typeof blockResult).toBe('string');
        expect(blockResult).toContain('![Test image]');
        expect(blockResult).toContain('https://example.com/image.jpg');

        // Test toPreview method
        const previewResult = imageDef.toPreview({
          src: 'https://example.com/image.jpg',
          alt: 'Test image',
          title: 'Test title',
        });

        expect(typeof previewResult).toBe('string');
        expect(previewResult).toContain('<img');
        expect(previewResult).toContain('src=');
        expect(previewResult).toContain('alt=');
        expect(previewResult).toContain('title=');
      }
    });

    it('should handle empty props for image component', () => {
      const imageDef = getComponentDef('image');

      if (imageDef) {
        const blockResult = imageDef.toBlock({});

        expect(blockResult).toBe('');

        const previewResult = imageDef.toPreview({});

        expect(typeof previewResult).toBe('string');
        expect(previewResult).toContain('<img');
      }
    });

    it('should handle image component with only src', () => {
      const imageDef = getComponentDef('image');

      if (imageDef) {
        const props = { src: 'https://example.com/image.jpg' };
        const blockResult = imageDef.toBlock(props);

        expect(blockResult).toBe('![](https://example.com/image.jpg)');
      }
    });

    it('should verify image component fields structure', () => {
      const imageDef = getComponentDef('image');

      if (imageDef?.fields) {
        const srcField = imageDef.fields.find((field) => field.name === 'src');
        const altField = imageDef.fields.find((field) => field.name === 'alt');
        const titleField = imageDef.fields.find((field) => field.name === 'title');

        expect(srcField).toBeDefined();
        expect(srcField?.widget).toBe('image');

        expect(altField).toBeDefined();
        expect(altField?.required).toBe(false);

        expect(titleField).toBeDefined();
        expect(titleField?.required).toBe(false);
      }
    });

    it('should localize component labels using get(_) (line 77)', async () => {
      // This tests the localization path where get(_)(...) is called
      const { get } = await import('svelte/store');

      vi.clearAllMocks();

      // Mock get to return a function that returns the i18n key
      const getMock = vi.mocked(get);

      getMock.mockImplementation((store) => {
        if (typeof store === 'function') {
          return (key) => `localized_${key}`;
        }

        return store;
      });

      const builtInDefs = getBuiltInComponentDefs();

      // Should have localized labels
      builtInDefs.forEach((def) => {
        expect(typeof def.label).toBe('string');
        // Labels should be present (either from mock or actual localization)
        expect(def.label.length).toBeGreaterThan(0);
      });

      // Verify that get was called for i18n (specifically for labels)
      expect(getMock).toHaveBeenCalled();
    });

    it('should include localized field labels in built-in components', () => {
      // More tests for the localization paths in getBuiltInComponentDefs
      const builtInDefs = getBuiltInComponentDefs();

      builtInDefs.forEach((def) => {
        // Check that fields exist and have localized labels
        if (def.fields && Array.isArray(def.fields)) {
          def.fields.forEach((field) => {
            expect(typeof field.label).toBe('string');
            expect(field.label.length).toBeGreaterThan(0);
          });
        }
      });
    });

    it('should return components with correct field structure', () => {
      // Verify the common image props structure is used correctly
      const builtInDefs = getBuiltInComponentDefs();
      const imageDef = builtInDefs.find((def) => def.id === 'image');

      expect(imageDef).toBeDefined();
      expect(imageDef?.fields).toBeInstanceOf(Array);
      expect(imageDef?.fields.length).toBeGreaterThan(0);

      // Each field should have required structure
      imageDef?.fields.forEach((field) => {
        expect(field).toHaveProperty('name');
        expect(field).toHaveProperty('label');

        // Not all fields have the `widget` property, so just check it exists if present
        if (field.widget) {
          expect(typeof field.widget).toBe('string');
        }
      });
    });
  });

  describe('getComponentDef', () => {
    it('should return undefined for non-existent component', () => {
      const result = getComponentDef('non-existent-component');

      expect(result).toBeUndefined();
    });

    it('should return image component definition', () => {
      const result = getComponentDef('image');

      expect(result).toBeDefined();
      expect(result?.id).toBe('image');
      // The label depends on the i18n mock behavior
      expect(typeof result?.label).toBe('string');
      expect(result?.label.length).toBeGreaterThan(0);
    });

    it('should return linked-image component definition', () => {
      const result = getComponentDef('linked-image');

      expect(result).toBeDefined();
      expect(result?.id).toBe('linked-image');
      expect(result?.fields).toBeInstanceOf(Array);
      expect(result?.fields.length).toBeGreaterThan(3); // Has link field
    });

    it('should return custom registered component', () => {
      const customComponent = {
        id: 'custom',
        label: 'Custom',
        fields: [],
        pattern: /test/,
        toBlock: () => 'test',
        toPreview: () => '<div>test</div>',
      };

      customComponentRegistry.set('custom', customComponent);

      const result = getComponentDef('custom');

      expect(result).toBe(customComponent);

      customComponentRegistry.delete('custom');
    });
  });
});
