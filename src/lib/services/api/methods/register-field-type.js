import { isObject } from '@sveltia/utils/object';

import { preloadImmutable } from '$lib/services/api/immutable';
import { isReactComponent } from '$lib/services/api/react';
import { preloadReactDom } from '$lib/services/api/react-dom';
import { customFieldTypeRegistry } from '$lib/services/api/registries';
import { BUILTIN_FIELD_TYPES } from '$lib/services/contents/fields';
import { isNonEmptyString } from '$lib/services/utils/string';

/**
 * @import {
 * CustomFieldControl,
 * CustomFieldPreview,
 * CustomFieldSchema,
 * CustomFieldTypeDefinition,
 * } from '../../../types/public';
 */
// Don’t use `$lib` in `from` above, or type declarations will not be exported

/**
 * Register a custom field type (widget), which can be used with the `widget` field option.
 * Registering a field type with the same name again replaces the previous one.
 * `CMS.registerWidget()` is an alias of this method for compatibility with Netlify/Decap CMS. The
 * field type can be given either as positional arguments or as a single definition object, which
 * also takes a summary component.
 * @param {string | CustomFieldTypeDefinition} name Field type name, which cannot be the name of a
 * built-in field type, or a field type definition. With a definition, the other arguments are
 * ignored.
 * @param {CustomFieldControl | string} [control] React component for the edit pane, or the name of
 * another custom field type whose control is reused. Required unless a definition is given.
 * @param {CustomFieldPreview} [preview] React component for the preview pane. If omitted, no
 * preview is rendered for the field.
 * @param {CustomFieldSchema} [schema] JSON schema to validate the field type’s options in the CMS
 * configuration.
 * @throws {TypeError} If `name` is neither a non-empty string nor a definition object, the control
 * is neither a React component nor a string, the preview or the summary is given but not a React
 * component, or the schema is given but not an object.
 * @throws {Error} If `name` is the name of a built-in field type.
 * @see https://decapcms.org/docs/custom-widgets/
 * @see https://sveltiacms.app/en/docs/api/field-types
 */
const registerFieldType = (name, control, preview, schema) => {
  const isDefinition = isObject(name);

  /** @type {Partial<CustomFieldTypeDefinition>} */
  const definition = isDefinition
    ? /** @type {CustomFieldTypeDefinition} */ (name)
    : { name, controlComponent: control, previewComponent: preview, schema };

  // Name the options in error messages the way they were given
  const [controlOption, previewOption] = isDefinition
    ? ['controlComponent', 'previewComponent']
    : ['control', 'preview'];

  const {
    name: typeName,
    controlComponent,
    previewComponent,
    summaryComponent,
    schema: typeSchema,
  } = definition;

  if (!isNonEmptyString(typeName)) {
    throw new TypeError(
      'The `name` option for `CMS.registerFieldType()` must be a non-empty string',
    );
  }

  if (/** @type {string[]} */ (BUILTIN_FIELD_TYPES).includes(typeName)) {
    throw new Error(
      `The field type name "${typeName}" is reserved for a built-in field type. ` +
        'Choose a different name for your custom field type.',
    );
  }

  if (!isReactComponent(controlComponent) && typeof controlComponent !== 'string') {
    throw new TypeError(
      `The \`${controlOption}\` option for \`CMS.registerFieldType()\` must be a React component ` +
        'or a string',
    );
  }

  if (previewComponent !== undefined && !isReactComponent(previewComponent)) {
    throw new TypeError(
      `The \`${previewOption}\` option for \`CMS.registerFieldType()\` must be a React component`,
    );
  }

  if (summaryComponent !== undefined && !isReactComponent(summaryComponent)) {
    throw new TypeError(
      'The `summaryComponent` option for `CMS.registerFieldType()` must be a React component',
    );
  }

  if (typeSchema !== undefined && !isObject(typeSchema)) {
    throw new TypeError('The `schema` option for `CMS.registerFieldType()` must be an object');
  }

  customFieldTypeRegistry.set(typeName, {
    control: controlComponent,
    preview: previewComponent,
    summary: summaryComponent,
    schema: typeSchema,
  });
  // The components are React components receiving Immutable Maps, so start loading the libraries
  // now rather than when the editor opens
  preloadImmutable();
  preloadReactDom();
};

// Export the function this way instead of `export const` to prevent the annotations from being
// stripped in the generated `register-field-type.d.ts` file
export { registerFieldType };
