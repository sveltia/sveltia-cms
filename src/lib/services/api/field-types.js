import { isObject } from '@sveltia/utils/object';
import equal from 'fast-deep-equal';
import { createElement, useCallback, useContext, useRef } from 'react';
import { mount, unmount } from 'svelte';

import { editors, previews } from '$lib/components/contents/details/fields';
import { fieldStateContext } from '$lib/services/api/field-state';
import { createSvelteProps, updateSvelteProps } from '$lib/services/api/field-types.svelte';
import { customFieldTypeRegistry } from '$lib/services/api/registries';
import { BUILTIN_FIELD_TYPES } from '$lib/services/contents/fields';

/**
 * @import { ReactElement } from 'react';
 * @import { Component } from 'svelte';
 * @import { SvelteProps } from '$lib/services/api/field-types.svelte';
 * @import { FieldState } from '$lib/services/api/field-state';
 * @import { CustomField, FieldTypeDefinition } from '$lib/types/public';
 */

/**
 * List of built-in field types that can be reused in a custom field type with the
 * `CMS.getFieldType()` API. The editor and preview components for these field types are driven
 * solely by their props, so they can be rendered anywhere. The other built-in field types read from
 * and write to the entry draft store directly, so they only work within the entry editor.
 */
export const REUSABLE_BUILTIN_FIELD_TYPES = [
  'boolean',
  'color',
  'datetime',
  'map',
  'number',
  'select',
  'string',
  'text',
  'uuid',
];

/**
 * Cache of the field type definitions created with {@link createBuiltInFieldType}, so that repeated
 * `CMS.getFieldType()` calls return the same React components. React remounts a component whenever
 * its type changes, so returning a new component each time would reset the field on every render.
 * @type {Map<string, FieldTypeDefinition>}
 */
const builtInFieldTypeCache = new Map();

/**
 * Convert the `field` prop passed to a React component to a field configuration object that a
 * built-in Svelte component can read. Three shapes are accepted: an Immutable Map, as passed to a
 * custom field control by the CMS; a plain object, which is handy when a custom field type composes
 * a built-in field type with an ad hoc configuration; and any other object exposing an Immutable
 * Map-like `get` method. Netlify/Decap CMS custom widgets are often given the last shape, because
 * their controls only ever call `field.get()`. Its keys cannot be enumerated, so the options are
 * read lazily through the method.
 * @param {any} field Field configuration.
 * @returns {CustomField} Field configuration.
 */
const normalizeFieldConfig = (field) => {
  if (typeof field?.toJS === 'function') {
    return field.toJS();
  }

  if (typeof field?.get === 'function') {
    return /** @type {CustomField} */ (
      new Proxy(/** @type {any} */ ({}), {
        // eslint-disable-next-line jsdoc/require-jsdoc
        get: (_target, key) => (typeof key === 'string' ? field.get(key) : undefined),
        // eslint-disable-next-line jsdoc/require-jsdoc
        has: (_target, key) => typeof key === 'string' && field.get(key) !== undefined,
      })
    );
  }

  return /** @type {CustomField} */ (isObject(field) ? field : {});
};

/**
 * Build the props for a built-in field editor component. Each prop given to the React component
 * takes precedence over the state of the field being edited, which in turn takes precedence over
 * the field configuration. Props that are left `undefined` fall back to the defaults defined in the
 * editor component.
 * @param {Record<string, any>} props Props passed to the React component.
 * @param {FieldState} fieldState State of the field being edited.
 * @returns {Record<string, any>} Props for the Svelte component.
 */
const buildEditorProps = (props, fieldState) => {
  const { value, field, forID, locale, keyPath, required, readonly, invalid } = props;
  const { name, label, required: requiredOption } = normalizeFieldConfig(field);

  return {
    locale: locale ?? fieldState.locale ?? '',
    keyPath: keyPath ?? fieldState.keyPath ?? name ?? '',
    typedKeyPath: '',
    fieldId: forID ?? '',
    fieldLabel: label ?? name ?? '',
    // Store the field configuration as given, so that a change can be detected. It’s converted
    // when the Svelte component reads the prop.
    fieldConfig: field,
    currentValue: value,
    required: required ?? fieldState.required ?? requiredOption,
    readonly: readonly ?? fieldState.readonly,
    invalid: invalid ?? fieldState.invalid,
  };
};

/**
 * Build the props for a built-in field preview component.
 * @param {Record<string, any>} props Props passed to the React component.
 * @param {FieldState} fieldState State of the field being previewed.
 * @returns {Record<string, any>} Props for the Svelte component.
 */
const buildPreviewProps = ({ value, field, locale, keyPath }, fieldState) => ({
  locale: locale ?? fieldState.locale ?? '',
  keyPath: keyPath ?? fieldState.keyPath ?? normalizeFieldConfig(field).name ?? '',
  typedKeyPath: '',
  fieldConfig: field,
  currentValue: value,
});

/**
 * Create a React component that renders a built-in Svelte field component, so that a custom field
 * type registered with the `CMS.registerFieldType()` API can reuse it. The Svelte component is
 * mounted once and then updated in place, instead of being remounted on every React render, so that
 * the user’s input, including the focus and selection state, is retained.
 * @param {object} args Arguments.
 * @param {Component} args.SvelteComponent Built-in editor or preview component.
 * @param {(props: Record<string, any>, fieldState: FieldState) => Record<string, any>}
 * args.buildProps Function to convert the React props to the Svelte component props.
 * @returns {(props: Record<string, any>) => ReactElement} React function component.
 */
const createFieldComponent =
  ({ SvelteComponent, buildProps }) =>
  /**
   * Render the built-in Svelte component within a wrapper element.
   * @param {Record<string, any>} props Props passed by React.
   * @returns {ReactElement} React element.
   */
  (props) => {
    // The state of the field being edited, provided by the custom field control wrapper
    const fieldState = useContext(fieldStateContext);
    /** @type {{ current: Record<string, any> }} */
    const latestProps = useRef(props);
    /** @type {{ current: SvelteProps | undefined }} */
    const context = useRef(undefined);

    // Keep the latest props available to the callbacks below, which are created only once
    latestProps.current = props;

    if (context.current) {
      updateSvelteProps(context.current.values, buildProps(props, fieldState));
    } else {
      context.current = createSvelteProps({
        initialProps: buildProps(props, fieldState),
        transforms: { fieldConfig: normalizeFieldConfig },
        /**
         * Handle a value written back to the bindable `currentValue` prop by the built-in editor.
         * @param {any} value New value.
         */
        onValueChange: (value) => {
          const { values } = /** @type {SvelteProps} */ (context.current);

          // Guard against an infinite loop, given that the new value is sent back to this component
          // as the `value` prop once the entry draft is updated
          if (!equal(values.currentValue, value)) {
            values.currentValue = value;
            latestProps.current.onChange?.(value);
          }
        },
      });
    }

    const ref = useCallback(
      /**
       * Mount the Svelte component when the wrapper element is added to the DOM, and unmount it
       * when the element is removed. The callback is memoized, so React doesn’t call it on every
       * render, which would otherwise remount the component.
       * @param {HTMLElement | null} target Wrapper element. React calls the callback with `null`
       * instead of the cleanup function below if the component failed to be mounted.
       * @returns {(() => void) | undefined} Cleanup function called by React.
       */
      (target) => {
        if (!target) {
          return undefined;
        }

        const { props: svelteProps } = /** @type {SvelteProps} */ (context.current);
        const instance = mount(SvelteComponent, { target, props: svelteProps });

        return () => {
          unmount(instance);
        };
      },
      [],
    );

    return createElement('div', { ref });
  };

/**
 * Create a field type definition for a built-in field type, comprising React components that render
 * the built-in editor and preview components.
 * @param {string} name Field type name.
 * @returns {FieldTypeDefinition} Field type definition.
 */
const createBuiltInFieldType = (name) => ({
  control: /** @type {any} */ (
    createFieldComponent({ SvelteComponent: editors[name], buildProps: buildEditorProps })
  ),
  preview: /** @type {any} */ (
    createFieldComponent({ SvelteComponent: previews[name], buildProps: buildPreviewProps })
  ),
});

/**
 * Get the definition of a built-in field type.
 * @param {string} name Field type name.
 * @returns {FieldTypeDefinition | undefined} Field type definition, or `undefined` if the field
 * type cannot be reused.
 */
const getBuiltInFieldType = (name) => {
  if (!REUSABLE_BUILTIN_FIELD_TYPES.includes(name)) {
    if (/** @type {string[]} */ (BUILTIN_FIELD_TYPES).includes(name)) {
      // eslint-disable-next-line no-console
      console.warn(
        `The built-in "${name}" field type cannot be reused in a custom field type, because its ` +
          'editor works only within the entry editor. Reusable field types are: ' +
          `${REUSABLE_BUILTIN_FIELD_TYPES.join(', ')}.`,
      );
    }

    return undefined;
  }

  const cache = builtInFieldTypeCache.get(name);

  if (cache) {
    return cache;
  }

  const definition = createBuiltInFieldType(name);

  builtInFieldTypeCache.set(name, definition);

  return definition;
};

/**
 * Get the definition of a custom or built-in field type.
 * @param {string} name Field type name.
 * @param {Set<string>} [visited] Names of the field types already looked up, used to avoid an
 * infinite loop when custom field types reference each other.
 * @returns {FieldTypeDefinition | undefined} Field type definition, or `undefined` if the field
 * type is not available.
 */
export const getFieldTypeDefinition = (name, visited = new Set()) => {
  const customFieldType = customFieldTypeRegistry.get(name);

  if (!customFieldType) {
    return getBuiltInFieldType(name);
  }

  const { control, preview, schema } = customFieldType;

  if (typeof control !== 'string') {
    return { control, preview, schema };
  }

  visited.add(name);

  return {
    // The control can be the name of another field type, which is resolved recursively
    control: visited.has(control) ? undefined : getFieldTypeDefinition(control, visited)?.control,
    preview,
    schema,
  };
};
