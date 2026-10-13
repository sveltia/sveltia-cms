import { afterEach, describe, expect, test, vi } from 'vitest';

import { customComponentRegistry } from '$lib/services/api/registries';
import { cmsConfig } from '$lib/services/config';
import {
  getAvailableComponentDefs,
  getEditorComponentDefs,
  getEditorComponentNames,
  getRootFieldName,
  getStaleExtraValueKeys,
  getToolbarButtons,
  resolveAllowNestedComponents,
} from '$lib/services/contents/fields/rich-text/options';

vi.mock('$lib/services/config', () => ({ cmsConfig: { current: undefined } }));
vi.mock('$lib/services/contents/fields/rich-text/components/definitions', () => ({
  getComponentDef: vi.fn((name) =>
    name === 'unknown' ? undefined : { id: name === 'youtube' ? 'x-youtube' : name, name },
  ),
}));
vi.mock('$lib/services/contents/fields/rich-text/components/utils', () => ({
  supportsHTML: vi.fn(({ id }) => id !== 'x-youtube'),
}));

/** @type {any} */
const fieldConfig = { name: 'body', widget: 'richtext' };

afterEach(() => {
  cmsConfig.current = undefined;
  customComponentRegistry.clear();
});

describe('getEditorComponentNames()', () => {
  test('includes the built-in and custom components by default', () => {
    customComponentRegistry.set('youtube', /** @type {any} */ ({}));
    // `table` and `hr` have to be enabled explicitly
    expect(getEditorComponentNames(fieldConfig)).toEqual(['code-block', 'linked-image', 'youtube']);
  });

  test('includes `table` when listed', () => {
    expect(
      getEditorComponentNames({ ...fieldConfig, editor_components: ['image', 'table'] }),
    ).toEqual(['linked-image', 'table']);
  });

  test('uses the field defaults', () => {
    cmsConfig.current = /** @type {any} */ ({
      field_defaults: { richtext: { editor_components: ['image'], linked_images: false } },
    });
    expect(getEditorComponentNames(fieldConfig)).toEqual(['image']);
  });

  test('uses the field options', () => {
    expect(
      getEditorComponentNames({
        ...fieldConfig,
        editor_components: ['image'],
        linked_images: true,
      }),
    ).toEqual(['linked-image']);
    expect(
      getEditorComponentNames({
        ...fieldConfig,
        editor_components: ['image'],
        linked_images: false,
      }),
    ).toEqual(['image']);
  });
});

describe('getEditorComponentDefs()', () => {
  test('leaves out unknown components', () => {
    expect(
      getEditorComponentDefs({ ...fieldConfig, editor_components: ['code-block', 'unknown'] }),
    ).toEqual([{ id: 'code-block', name: 'code-block' }]);
  });
});

describe('getToolbarButtons()', () => {
  test('maps the button names, adding `code-block` when the component is enabled', () => {
    expect(getToolbarButtons(['bold', 'quote', /** @type {any} */ ('x')], ['code-block'])).toEqual([
      'bold',
      'blockquote',
      'code-block',
    ]);
    expect(getToolbarButtons(['heading-one'], ['linked-image'])).toEqual(['heading-1']);
  });

  test('maps the `align` button', () => {
    expect(getToolbarButtons(['bold', 'align'], [])).toEqual(['bold', 'align']);
  });

  test('adds `horizontal-rule` when the `hr` component is enabled', () => {
    expect(getToolbarButtons(['bold'], ['hr'])).toEqual(['bold', 'horizontal-rule']);
  });

  test('adds `table` when the component is enabled', () => {
    expect(getToolbarButtons(['bold'], ['table', 'linked-image'])).toEqual(['bold', 'table']);
    expect(getToolbarButtons(['bold'], ['table', 'code-block'])).toEqual([
      'bold',
      'code-block',
      'table',
    ]);
  });
});

describe('resolveAllowNestedComponents()', () => {
  test('uses the field option, the field defaults, then `true`', () => {
    expect(resolveAllowNestedComponents({ ...fieldConfig, allow_nested_components: false })).toBe(
      false,
    );
    expect(resolveAllowNestedComponents(undefined)).toBe(true);
    cmsConfig.current = /** @type {any} */ ({
      field_defaults: { richtext: { allow_nested_components: 'exclude_self' } },
    });
    expect(resolveAllowNestedComponents(fieldConfig)).toBe('exclude_self');
  });
});

describe('getRootFieldName()', () => {
  test('extracts the root field name', () => {
    expect(getRootFieldName('body:c55:content')).toBe('body');
    expect(getRootFieldName('body')).toBe('body');
  });
});

describe('getAvailableComponentDefs()', () => {
  const args = {
    fieldConfig: { ...fieldConfig, editor_components: ['code-block', 'youtube'] },
    format: /** @type {const} */ ('markdown'),
    allowNestedComponents: /** @type {boolean | 'exclude_self'} */ (true),
    inEditorComponent: false,
    parentComponentNames: /** @type {string[]} */ ([]),
  };

  test('lists the enabled components', () => {
    expect(getAvailableComponentDefs(args).map(({ id }) => id)).toEqual([
      'code-block',
      'x-youtube',
    ]);
  });

  test('lists only the components with HTML syntax for HTML', () => {
    expect(getAvailableComponentDefs({ ...args, format: 'html' }).map(({ id }) => id)).toEqual([
      'code-block',
    ]);
  });

  test('lists nothing within a component when nesting is disallowed', () => {
    expect(
      getAvailableComponentDefs({ ...args, inEditorComponent: true, allowNestedComponents: false }),
    ).toEqual([]);
    expect(getAvailableComponentDefs({ ...args, allowNestedComponents: false })).toHaveLength(2);
  });

  test('leaves out the parent components when excluding itself', () => {
    expect(
      getAvailableComponentDefs({
        ...args,
        inEditorComponent: true,
        allowNestedComponents: 'exclude_self',
        parentComponentNames: ['x-youtube'],
      }).map(({ id }) => id),
    ).toEqual(['code-block']);
  });
});

describe('getStaleExtraValueKeys()', () => {
  test('lists the keys of the components of the field no longer present', () => {
    const extraValues = {
      'body:c1:image:src': 'a',
      'body:c2:image:src': 'b',
      'other:c3:image:src': 'c',
      plain: 'd',
    };

    expect(getStaleExtraValueKeys(extraValues, 'body', (prefix) => prefix === 'body:c1:')).toEqual([
      'body:c2:image:src',
    ]);
  });
});
