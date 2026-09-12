import { customFieldTypeRegistry } from '$lib/services/api/registries';
import { BUILTIN_FIELD_TYPES } from '$lib/services/contents/fields';
import { getFieldConfigMap, getPreviewData } from '$lib/services/contents/fields/custom/helpers';

/**
 * @import { EntryDraft, InternalLocaleCode } from '$lib/types/private';
 * @import {
 * CustomField,
 * CustomFieldAddFileOptions,
 * CustomFieldControl,
 * CustomFieldControlProps,
 * CustomFieldPickFileOptions,
 * CustomFieldPickedFile,
 * } from '$lib/types/public';
 */

/**
 * Resolve the actual control component from a string reference or return the component itself.
 * @param {CustomFieldControl | string | undefined} ctrl Control component or widget name.
 * @returns {CustomFieldControl | undefined} Resolved control component or undefined.
 */
export const resolveControl = (ctrl) => {
  if (typeof ctrl === 'function') {
    return ctrl;
  }

  if (typeof ctrl === 'string') {
    const customFieldType = customFieldTypeRegistry.get(ctrl);

    if (customFieldType?.control) {
      if (typeof customFieldType.control === 'function') {
        return customFieldType.control;
      }

      return resolveControl(customFieldType.control);
    }

    if (/** @type {string[]} */ (BUILTIN_FIELD_TYPES).includes(ctrl)) {
      // Built-in editors are Svelte components, not React components. We can’t use them as React
      // controls, so return `undefined`.
      // eslint-disable-next-line no-console
      console.warn(
        `Custom field references built-in editor "${ctrl}" which is not a React component.`,
      );

      return undefined;
    }
  }

  return undefined;
};

/**
 * Build the props for a custom field control component. The `entry` prop lets a control read any
 * value in the entry being edited, including the values of sibling fields, so that it can render
 * options derived from them. It’s rebuilt whenever the draft is updated, so the control is always
 * given the latest content. The `addFile` prop lets a control hand a file to the CMS, so that it’s
 * uploaded along with the entry; the blob URL it resolves to is meant to be stored in the value.
 * The `pickFile` prop opens the Select Assets dialog, so that a control can let the user pick an
 * existing asset the way a built-in File/Image field does.
 * @param {object} args Arguments.
 * @param {string | null | undefined} args.fieldId Field ID.
 * @param {string | null | undefined} args.fieldClassName Class name for the wrapper element.
 * @param {CustomField} args.fieldConfig Field configuration.
 * @param {any} args.currentValue Current field value.
 * @param {EntryDraft | null | undefined} args.draft Draft entry state.
 * @param {InternalLocaleCode} args.locale Current locale.
 * @param {(value: any) => void} args.onChange Change handler.
 * @param {(file: File | Blob, options?: CustomFieldAddFileOptions) => Promise<string>}
 * args.addFile Handler to add a file to the entry draft.
 * @param {(options?: CustomFieldPickFileOptions) => Promise<CustomFieldPickedFile |
 * CustomFieldPickedFile[] | null>} args.pickFile Handler to pick a file in the Select Assets
 * dialog.
 * @param {(instance: any) => void} args.handleRef Ref callback.
 * @returns {CustomFieldControlProps & { ref?: (instance: any) => void }} Props for React rendering.
 */
export const buildControlProps = ({
  fieldId,
  fieldClassName,
  fieldConfig,
  currentValue,
  draft,
  locale,
  onChange,
  addFile,
  pickFile,
  handleRef,
}) => ({
  value: currentValue,
  field: getFieldConfigMap(fieldConfig),
  forID: fieldId ?? '',
  classNameWrapper: fieldClassName ?? '',
  entry: draft ? getPreviewData({ draft, locale }).entryMap : undefined,
  onChange,
  addFile,
  pickFile,
  ref: handleRef,
});
