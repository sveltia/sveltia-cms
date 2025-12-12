import { describe, expect, test, vi } from 'vitest';

import { editors, previews } from './index.js';

// Mock all Svelte components - they're not needed for this test, but they must be mocked
// because Vitest 4 cannot load .svelte files in Node environment
vi.mock('$lib/components/contents/details/fields/boolean/boolean-editor.svelte', () => ({
  default: {},
}));
vi.mock('$lib/components/contents/details/fields/boolean/boolean-preview.svelte', () => ({
  default: {},
}));
vi.mock('$lib/components/contents/details/fields/code/code-editor.svelte', () => ({
  default: {},
}));
vi.mock('$lib/components/contents/details/fields/code/code-preview.svelte', () => ({
  default: {},
}));
vi.mock('$lib/components/contents/details/fields/color/color-editor.svelte', () => ({
  default: {},
}));
vi.mock('$lib/components/contents/details/fields/color/color-preview.svelte', () => ({
  default: {},
}));
vi.mock('$lib/components/contents/details/fields/compute/compute-editor.svelte', () => ({
  default: {},
}));
vi.mock('$lib/components/contents/details/fields/compute/compute-preview.svelte', () => ({
  default: {},
}));
vi.mock('$lib/components/contents/details/fields/date-time/date-time-editor.svelte', () => ({
  default: {},
}));
vi.mock('$lib/components/contents/details/fields/date-time/date-time-preview.svelte', () => ({
  default: {},
}));
vi.mock('$lib/components/contents/details/fields/file/file-editor.svelte', () => ({
  default: {},
}));
vi.mock('$lib/components/contents/details/fields/file/file-preview.svelte', () => ({
  default: {},
}));
vi.mock('$lib/components/contents/details/fields/key-value/key-value-editor.svelte', () => ({
  default: {},
}));
vi.mock('$lib/components/contents/details/fields/key-value/key-value-preview.svelte', () => ({
  default: {},
}));
vi.mock('$lib/components/contents/details/fields/list/list-editor.svelte', () => ({
  default: {},
}));
vi.mock('$lib/components/contents/details/fields/list/list-preview.svelte', () => ({
  default: {},
}));
vi.mock('$lib/components/contents/details/fields/map/map-editor.svelte', () => ({
  default: {},
}));
vi.mock('$lib/components/contents/details/fields/map/map-preview.svelte', () => ({
  default: {},
}));
vi.mock('$lib/components/contents/details/fields/markdown/markdown-editor.svelte', () => ({
  default: {},
}));
vi.mock('$lib/components/contents/details/fields/markdown/markdown-preview.svelte', () => ({
  default: {},
}));
vi.mock('$lib/components/contents/details/fields/number/number-editor.svelte', () => ({
  default: {},
}));
vi.mock('$lib/components/contents/details/fields/number/number-preview.svelte', () => ({
  default: {},
}));
vi.mock('$lib/components/contents/details/fields/object/object-editor.svelte', () => ({
  default: {},
}));
vi.mock('$lib/components/contents/details/fields/object/object-preview.svelte', () => ({
  default: {},
}));
vi.mock('$lib/components/contents/details/fields/relation/relation-editor.svelte', () => ({
  default: {},
}));
vi.mock('$lib/components/contents/details/fields/relation/relation-preview.svelte', () => ({
  default: {},
}));
vi.mock('$lib/components/contents/details/fields/select/select-editor.svelte', () => ({
  default: {},
}));
vi.mock('$lib/components/contents/details/fields/select/select-preview.svelte', () => ({
  default: {},
}));
vi.mock('$lib/components/contents/details/fields/string/string-editor.svelte', () => ({
  default: {},
}));
vi.mock('$lib/components/contents/details/fields/string/string-preview.svelte', () => ({
  default: {},
}));
vi.mock('$lib/components/contents/details/fields/text/text-editor.svelte', () => ({
  default: {},
}));
vi.mock('$lib/components/contents/details/fields/text/text-preview.svelte', () => ({
  default: {},
}));
vi.mock('$lib/components/contents/details/fields/uuid/uuid-editor.svelte', () => ({
  default: {},
}));
vi.mock('$lib/components/contents/details/fields/uuid/uuid-preview.svelte', () => ({
  default: {},
}));

describe('Widget components', () => {
  describe('editors', () => {
    test('should export all editor components', () => {
      expect(editors).toBeDefined();
      expect(Object.keys(editors)).toHaveLength(18);
    });

    test('should have boolean editor', () => {
      expect(editors.boolean).toBeDefined();
    });

    test('should have code editor', () => {
      expect(editors.code).toBeDefined();
    });

    test('should have color editor', () => {
      expect(editors.color).toBeDefined();
    });

    test('should have compute editor', () => {
      expect(editors.compute).toBeDefined();
    });

    test('should have datetime editor', () => {
      expect(editors.datetime).toBeDefined();
    });

    test('should have file editor', () => {
      expect(editors.file).toBeDefined();
    });

    test('should have image editor as alias to file editor', () => {
      expect(editors.image).toBeDefined();
      expect(editors.image).toBe(editors.file);
    });

    test('should have keyvalue editor', () => {
      expect(editors.keyvalue).toBeDefined();
    });

    test('should have list editor', () => {
      expect(editors.list).toBeDefined();
    });

    test('should have map editor', () => {
      expect(editors.map).toBeDefined();
    });

    test('should have markdown editor', () => {
      expect(editors.markdown).toBeDefined();
    });

    test('should have number editor', () => {
      expect(editors.number).toBeDefined();
    });

    test('should have object editor', () => {
      expect(editors.object).toBeDefined();
    });

    test('should have relation editor', () => {
      expect(editors.relation).toBeDefined();
    });

    test('should have select editor', () => {
      expect(editors.select).toBeDefined();
    });

    test('should have string editor', () => {
      expect(editors.string).toBeDefined();
    });

    test('should have text editor', () => {
      expect(editors.text).toBeDefined();
    });

    test('should have uuid editor', () => {
      expect(editors.uuid).toBeDefined();
    });
  });

  describe('previews', () => {
    test('should export all preview components', () => {
      expect(previews).toBeDefined();
      expect(Object.keys(previews)).toHaveLength(18);
    });

    test('should have boolean preview', () => {
      expect(previews.boolean).toBeDefined();
    });

    test('should have code preview', () => {
      expect(previews.code).toBeDefined();
    });

    test('should have color preview', () => {
      expect(previews.color).toBeDefined();
    });

    test('should have compute preview', () => {
      expect(previews.compute).toBeDefined();
    });

    test('should have datetime preview', () => {
      expect(previews.datetime).toBeDefined();
    });

    test('should have file preview', () => {
      expect(previews.file).toBeDefined();
    });

    test('should have image preview as alias to file preview', () => {
      expect(previews.image).toBeDefined();
      expect(previews.image).toBe(previews.file);
    });

    test('should have keyvalue preview', () => {
      expect(previews.keyvalue).toBeDefined();
    });

    test('should have list preview', () => {
      expect(previews.list).toBeDefined();
    });

    test('should have map preview', () => {
      expect(previews.map).toBeDefined();
    });

    test('should have markdown preview', () => {
      expect(previews.markdown).toBeDefined();
    });

    test('should have number preview', () => {
      expect(previews.number).toBeDefined();
    });

    test('should have object preview', () => {
      expect(previews.object).toBeDefined();
    });

    test('should have relation preview', () => {
      expect(previews.relation).toBeDefined();
    });

    test('should have select preview', () => {
      expect(previews.select).toBeDefined();
    });

    test('should have string preview', () => {
      expect(previews.string).toBeDefined();
    });

    test('should have text preview', () => {
      expect(previews.text).toBeDefined();
    });

    test('should have uuid preview', () => {
      expect(previews.uuid).toBeDefined();
    });
  });
});
