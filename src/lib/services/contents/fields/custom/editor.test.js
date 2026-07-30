import { beforeEach, describe, expect, it, vi } from 'vitest';

// Create a mock registry that can be shared across tests
/** @type {Map<string, any>} */
let mockRegistry;

// Mock the modules before importing
vi.doMock('$lib/services/api/registries', () => {
  mockRegistry = new Map();
  return {
    customFieldTypeRegistry: mockRegistry,
  };
});

const { buildControlProps, resolveControl } = await import('./editor');

describe('contents/fields/custom/helpers', () => {
  beforeEach(() => {
    // Reset the registry before each test
    mockRegistry.clear();
  });

  it('resolves a function control directly', () => {
    const control = vi.fn();

    expect(resolveControl(control)).toBe(control);
  });

  it('resolves a registered custom widget control from the registry', () => {
    const control = vi.fn();

    mockRegistry.set('custom-widget', { control });

    expect(resolveControl('custom-widget')).toBe(control);
  });

  it('returns undefined for built-in editors', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = resolveControl('string');

    expect(result).toBeUndefined();
    expect(warn).toHaveBeenCalledWith(
      'Custom field references built-in editor "string" which is not a React component.',
    );
  });

  it('returns undefined for non-function and non-string controls', () => {
    expect(resolveControl(undefined)).toBeUndefined();
  });

  it('returns undefined for unknown controls without registry matches', () => {
    expect(resolveControl('unknown')).toBeUndefined();
  });

  it('returns undefined for a built-in field type that is not registered as custom', () => {
    expect(resolveControl('string')).toBeUndefined();
  });

  it('returns undefined when a registry entry exists but has no control', () => {
    mockRegistry.set('custom-widget', {});

    expect(resolveControl('custom-widget')).toBeUndefined();
  });

  it('resolves a nested custom widget control referenced by a string', () => {
    const control = vi.fn();

    mockRegistry.set('parent-widget', { control: 'child-widget' });
    mockRegistry.set('child-widget', { control });

    expect(resolveControl('parent-widget')).toBe(control);
  });

  it('builds props for the React widget with immutable field data', () => {
    const onChange = vi.fn();
    const handleRef = vi.fn();

    const props = buildControlProps({
      currentValue: 'hello',
      fieldConfig: { name: 'custom', widget: 'text' },
      fieldId: 'field-id',
      fieldClassName: 'custom-class',
      onChange,
      handleRef,
    });

    expect(props.value).toBe('hello');
    expect(props.forID).toBe('field-id');
    expect(props.classNameWrapper).toBe('custom-class');
    expect(props.onChange).toBe(onChange);
    expect(props.ref).toBe(handleRef);
    expect(props.field.get('widget')).toBe('text');
    expect(props.field.get('name')).toBe('custom');
    expect(props.field.toJS()).toEqual({ name: 'custom', widget: 'text' });
  });

  it('uses default widget and empty id when values are missing', () => {
    const props = buildControlProps({
      currentValue: 'hello',
      fieldConfig: { widget: 'custom', name: 'custom' },
      fieldId: '',
      fieldClassName: '',
      onChange: vi.fn(),
      handleRef: vi.fn(),
    });

    expect(props.field.get('widget')).toBe('custom');
    expect(props.forID).toBe('');
  });

  it('uses empty string fallback for null fieldId and fieldClassName', () => {
    const props = buildControlProps({
      currentValue: 'test',
      fieldConfig: { widget: 'custom', name: 'field' },
      fieldId: null,
      fieldClassName: null,
      onChange: vi.fn(),
      handleRef: vi.fn(),
    });

    expect(props.forID).toBe('');
    expect(props.classNameWrapper).toBe('');
  });

  it('uses empty string fallback for undefined fieldId and fieldClassName', () => {
    const props = buildControlProps({
      currentValue: 'test',
      fieldConfig: { widget: 'custom', name: 'field' },
      fieldId: undefined,
      fieldClassName: undefined,
      onChange: vi.fn(),
      handleRef: vi.fn(),
    });

    expect(props.forID).toBe('');
    expect(props.classNameWrapper).toBe('');
  });
});
