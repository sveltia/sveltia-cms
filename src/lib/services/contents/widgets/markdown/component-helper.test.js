// @ts-nocheck

import { describe, expect, it, vi } from 'vitest';

import { MULTI_VALUE_WIDGETS, SIMPLE_VALUE_WIDGETS } from '$lib/services/contents/widgets';

import { getEditorComponent, isWidgetSupported } from './component-helper';

// Mock the editors module
vi.mock('$lib/components/contents/details/widgets', () => ({
  editors: {
    boolean: 'MockBooleanEditor',
    code: 'MockCodeEditor',
    color: 'MockColorEditor',
    compute: 'MockComputeEditor',
    datetime: 'MockDatetimeEditor',
    file: 'MockFileEditor',
    image: 'MockFileEditor', // alias
    keyvalue: 'MockKeyvalueEditor',
    list: 'MockListEditor',
    map: 'MockMapEditor',
    markdown: 'MockMarkdownEditor',
    number: 'MockNumberEditor',
    object: 'MockObjectEditor',
    relation: 'MockRelationEditor',
    select: 'MockSelectEditor',
    string: 'MockStringEditor',
    text: 'MockTextEditor',
    uuid: 'MockUuidEditor',
  },
}));

describe('component-helper', () => {
  describe('isWidgetSupported', () => {
    describe('simple value widgets', () => {
      it.each(SIMPLE_VALUE_WIDGETS)('should support %s widget', (widget) => {
        const fieldConfig = { widget };

        expect(isWidgetSupported(fieldConfig)).toBe(true);
      });

      it.each(SIMPLE_VALUE_WIDGETS)('should support %s widget with multiple=false', (widget) => {
        const fieldConfig = { widget, multiple: false };

        expect(isWidgetSupported(fieldConfig)).toBe(true);
      });

      it.each(SIMPLE_VALUE_WIDGETS)('should support %s widget with multiple=true', (widget) => {
        const fieldConfig = { widget, multiple: true };

        expect(isWidgetSupported(fieldConfig)).toBe(true);
      });
    });

    describe('multi-value widgets', () => {
      it.each(MULTI_VALUE_WIDGETS)('should support %s widget when multiple=false', (widget) => {
        const fieldConfig = { widget, multiple: false };

        expect(isWidgetSupported(fieldConfig)).toBe(true);
      });

      it.each(MULTI_VALUE_WIDGETS)(
        'should support %s widget when multiple is undefined',
        (widget) => {
          const fieldConfig = { widget };

          expect(isWidgetSupported(fieldConfig)).toBe(true);
        },
      );

      it.each(MULTI_VALUE_WIDGETS)('should not support %s widget when multiple=true', (widget) => {
        const fieldConfig = { widget, multiple: true };

        expect(isWidgetSupported(fieldConfig)).toBe(false);
      });
    });

    describe('code widget special case', () => {
      it('should support code widget with output_code_only=true', () => {
        const fieldConfig = { widget: 'code', output_code_only: true };

        expect(isWidgetSupported(fieldConfig)).toBe(true);
      });

      it('should not support code widget with output_code_only=false', () => {
        const fieldConfig = { widget: 'code', output_code_only: false };

        expect(isWidgetSupported(fieldConfig)).toBe(false);
      });

      it('should not support code widget without output_code_only', () => {
        const fieldConfig = { widget: 'code' };

        expect(isWidgetSupported(fieldConfig)).toBe(false);
      });

      it('should support code widget with output_code_only=true and multiple=false', () => {
        const fieldConfig = { widget: 'code', output_code_only: true, multiple: false };

        expect(isWidgetSupported(fieldConfig)).toBe(true);
      });

      it('should support code widget with output_code_only=true and multiple=true', () => {
        const fieldConfig = { widget: 'code', output_code_only: true, multiple: true };

        expect(isWidgetSupported(fieldConfig)).toBe(true);
      });
    });

    describe('default widget behavior', () => {
      it('should default to string widget when widget is not specified', () => {
        const fieldConfig = {};

        expect(isWidgetSupported(fieldConfig)).toBe(true);
      });

      it('should default to multiple=false when multiple is not specified', () => {
        const fieldConfig = { widget: 'file' };

        expect(isWidgetSupported(fieldConfig)).toBe(true);
      });
    });

    describe('unsupported widgets', () => {
      it('should not support non-existent widget', () => {
        const fieldConfig = { widget: 'nonexistent' };

        expect(isWidgetSupported(fieldConfig)).toBe(false);
      });

      it('should not support undefined widget type', () => {
        const fieldConfig = { widget: undefined };

        expect(isWidgetSupported(fieldConfig)).toBe(true); // defaults to 'string'
      });

      it('should not support null widget type', () => {
        const fieldConfig = { widget: null };

        expect(isWidgetSupported(fieldConfig)).toBe(false);
      });
    });

    describe('edge cases', () => {
      it('should handle empty field config', () => {
        const fieldConfig = {};

        expect(isWidgetSupported(fieldConfig)).toBe(true); // defaults to string widget
      });

      it('should handle field config with only multiple property', () => {
        const fieldConfig = { multiple: true };

        expect(isWidgetSupported(fieldConfig)).toBe(true); // defaults to string widget
      });

      it('should handle field config with extra properties', () => {
        const fieldConfig = {
          widget: 'string',
          multiple: false,
          required: true,
          label: 'Test Field',
          hint: 'This is a test field',
        };

        expect(isWidgetSupported(fieldConfig)).toBe(true);
      });
    });
  });

  describe('getEditorComponent', () => {
    describe('supported widgets', () => {
      it('should return component for supported string widget', () => {
        const fieldConfig = { widget: 'string' };
        const component = getEditorComponent(fieldConfig);

        expect(component).toBe('MockStringEditor');
      });

      it('should return component for supported boolean widget', () => {
        const fieldConfig = { widget: 'boolean' };
        const component = getEditorComponent(fieldConfig);

        expect(component).toBe('MockBooleanEditor');
      });

      it('should return component for supported file widget with multiple=false', () => {
        const fieldConfig = { widget: 'file', multiple: false };
        const component = getEditorComponent(fieldConfig);

        expect(component).toBe('MockFileEditor');
      });

      it('should return component for supported code widget with output_code_only=true', () => {
        const fieldConfig = { widget: 'code', output_code_only: true };
        const component = getEditorComponent(fieldConfig);

        expect(component).toBe('MockCodeEditor');
      });

      it('should return component for default widget (string)', () => {
        const fieldConfig = {};
        const component = getEditorComponent(fieldConfig);

        expect(component).toBe('MockStringEditor');
      });
    });

    describe('unsupported widgets', () => {
      it('should return null for unsupported file widget with multiple=true', () => {
        const fieldConfig = { widget: 'file', multiple: true };
        const component = getEditorComponent(fieldConfig);

        expect(component).toBeNull();
      });

      it('should return null for unsupported code widget without output_code_only', () => {
        const fieldConfig = { widget: 'code' };
        const component = getEditorComponent(fieldConfig);

        expect(component).toBeNull();
      });

      it('should return null for non-existent widget', () => {
        const fieldConfig = { widget: 'nonexistent' };
        const component = getEditorComponent(fieldConfig);

        expect(component).toBeNull();
      });

      it('should return null for null widget', () => {
        const fieldConfig = { widget: null };
        const component = getEditorComponent(fieldConfig);

        expect(component).toBeNull();
      });
    });

    describe('widget aliases', () => {
      it('should return component for image widget (alias for file)', () => {
        const fieldConfig = { widget: 'image', multiple: false };
        const component = getEditorComponent(fieldConfig);

        expect(component).toBe('MockFileEditor');
      });

      it('should not support image widget with multiple=true', () => {
        const fieldConfig = { widget: 'image', multiple: true };
        const component = getEditorComponent(fieldConfig);

        expect(component).toBeNull();
      });
    });

    describe('all supported simple value widgets', () => {
      it.each(SIMPLE_VALUE_WIDGETS)('should return component for %s widget', (widget) => {
        const fieldConfig = { widget };
        const component = getEditorComponent(fieldConfig);
        const widgetName = widget.charAt(0).toUpperCase() + widget.slice(1).toLowerCase();
        const expectedComponent = `Mock${widgetName}Editor`;

        expect(component).toBe(expectedComponent);
      });
    });

    describe('all supported multi-value widgets', () => {
      it.each(MULTI_VALUE_WIDGETS)(
        'should return component for %s widget with multiple=false',
        (widget) => {
          const fieldConfig = { widget, multiple: false };
          const component = getEditorComponent(fieldConfig);

          const expectedComponent =
            widget === 'image'
              ? 'MockFileEditor' // image is an alias for file
              : `Mock${widget.charAt(0).toUpperCase() + widget.slice(1).toLowerCase()}Editor`;

          expect(component).toBe(expectedComponent);
        },
      );
    });
  });

  describe('integration tests', () => {
    it('should correctly identify and return components for a variety of field configs', () => {
      const testCases = [
        // Simple value widgets
        {
          config: { widget: 'string' },
          expectedSupported: true,
          expectedComponent: 'MockStringEditor',
        },
        {
          config: { widget: 'boolean' },
          expectedSupported: true,
          expectedComponent: 'MockBooleanEditor',
        },
        {
          config: { widget: 'number', multiple: true },
          expectedSupported: true,
          expectedComponent: 'MockNumberEditor',
        },

        // Multi-value widgets
        {
          config: { widget: 'file' },
          expectedSupported: true,
          expectedComponent: 'MockFileEditor',
        },
        {
          config: { widget: 'file', multiple: true },
          expectedSupported: false,
          expectedComponent: null,
        },
        {
          config: { widget: 'select', multiple: false },
          expectedSupported: true,
          expectedComponent: 'MockSelectEditor',
        },

        // Code widget special cases
        {
          config: { widget: 'code', output_code_only: true },
          expectedSupported: true,
          expectedComponent: 'MockCodeEditor',
        },
        {
          config: { widget: 'code', output_code_only: false },
          expectedSupported: false,
          expectedComponent: null,
        },

        // Edge cases
        { config: {}, expectedSupported: true, expectedComponent: 'MockStringEditor' },
        { config: { widget: 'nonexistent' }, expectedSupported: false, expectedComponent: null },
      ];

      testCases.forEach(({ config, expectedSupported, expectedComponent }) => {
        expect(isWidgetSupported(config)).toBe(expectedSupported);
        expect(getEditorComponent(config)).toBe(expectedComponent);
      });
    });
  });
});
