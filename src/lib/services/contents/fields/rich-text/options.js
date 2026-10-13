import { customComponentRegistry } from '$lib/services/api/registries';
import { cmsConfig } from '$lib/services/config';
import {
  BUILTIN_COMPONENTS,
  BUTTON_NAME_MAP,
  COMPONENT_NAME_PREFIX_REGEX,
} from '$lib/services/contents/fields/rich-text';
import { getComponentDef } from '$lib/services/contents/fields/rich-text/components/definitions';
import { supportsHTML } from '$lib/services/contents/fields/rich-text/components/utils';

/**
 * @import { TextEditorNodeType } from '@sveltia/ui';
 * @import {
 * EditorComponentDefinition,
 * MarkdownField,
 * RichTextEditorButtonName,
 * RichTextField,
 * RichTextValueFormat,
 * } from '$lib/types/public';
 */

/**
 * Get the names of the editor components enabled for the given RichText/Markdown field. The
 * `editor_components` option defaults to the field defaults, then all the built-in and custom
 * components. The `image` component is replaced with `linked-image` unless the `linked_images`
 * option is disabled.
 * @param {MarkdownField | RichTextField} fieldConfig Field configuration.
 * @returns {string[]} Component names.
 */
export const getEditorComponentNames = (fieldConfig) => {
  const defaultConfig = cmsConfig.current?.field_defaults?.richtext ?? {};

  const {
    editor_components: editorComponents = defaultConfig.editor_components ?? [
      ...BUILTIN_COMPONENTS,
      ...customComponentRegistry.keys(),
    ],
    linked_images: linkedImagesEnabled = defaultConfig.linked_images ?? true,
  } = fieldConfig;

  return editorComponents.map((name) =>
    name === 'image' && linkedImagesEnabled ? 'linked-image' : name,
  );
};

/**
 * Get the definitions of the editor components enabled for the given RichText/Markdown field,
 * leaving out any unknown component.
 * @param {MarkdownField | RichTextField} fieldConfig Field configuration.
 * @returns {EditorComponentDefinition[]} Component definitions.
 */
export const getEditorComponentDefs = (fieldConfig) =>
  /** @type {EditorComponentDefinition[]} */ (
    getEditorComponentNames(fieldConfig)
      .map((name) => getComponentDef(name))
      .filter((def) => !!def)
  );

/**
 * Built-in editor components implemented as buttons in Sveltia UI rather than as editor components.
 */
const BUTTON_COMPONENTS = ['code-block', 'table', 'hr'];

/**
 * Get the toolbar buttons of a rich text editor. The `code-block`, `table` and `hr` components are
 * implemented as buttons, which are added when the components are enabled. Unknown button names
 * are left out.
 * @param {RichTextEditorButtonName[]} buttonNames Names of the buttons in the `buttons` option.
 * @param {string[]} componentNames Names of the enabled editor components.
 * @returns {TextEditorNodeType[]} Sveltia UI button names.
 */
export const getToolbarButtons = (buttonNames, componentNames) =>
  [...buttonNames, ...BUTTON_COMPONENTS.filter((name) => componentNames.includes(name))]
    // @ts-ignore
    .map((name) => BUTTON_NAME_MAP[name])
    .filter(Boolean);

/**
 * Get the `allow_nested_components` option of the given RichText/Markdown field, falling back to
 * the field defaults, then `true`. A rich text editor within an editor component takes the option
 * from its root field, so pass that field’s configuration.
 * @param {MarkdownField | RichTextField | undefined} fieldConfig Field configuration.
 * @returns {boolean | 'exclude_self'} Option value.
 */
export const resolveAllowNestedComponents = (fieldConfig) =>
  fieldConfig?.allow_nested_components ??
  cmsConfig.current?.field_defaults?.richtext?.allow_nested_components ??
  true;

/**
 * Get the name of the root field from the key path of a field within an editor component.
 * @param {string} keyPath Key path, e.g. `body:c55:content`.
 * @returns {string} Field name, e.g. `body`.
 */
export const getRootFieldName = (keyPath) => /** @type {string} */ (keyPath.match(/^[^:]+/)?.[0]);

/**
 * Get the definitions of the editor components available in a rich text editor.
 * @param {object} args Arguments.
 * @param {MarkdownField | RichTextField} args.fieldConfig Field configuration.
 * @param {RichTextValueFormat} args.format Value format. Only the components with HTML syntax can
 * be used in HTML.
 * @param {boolean | 'exclude_self'} args.allowNestedComponents Resolved `allow_nested_components`
 * option. See {@link resolveAllowNestedComponents}.
 * @param {boolean} args.inEditorComponent Whether the editor is within an editor component.
 * @param {string[]} args.parentComponentNames IDs of the editor components the editor is within.
 * @returns {EditorComponentDefinition[]} Component definitions.
 */
export const getAvailableComponentDefs = ({
  fieldConfig,
  format,
  allowNestedComponents,
  inEditorComponent,
  parentComponentNames,
}) => {
  if (inEditorComponent && !allowNestedComponents) {
    return [];
  }

  return (
    getEditorComponentDefs(fieldConfig)
      .filter((def) => format !== 'html' || supportsHTML(def))
      // Compare the definition IDs, because the parent component names are the IDs, which are
      // prefixed for custom components, e.g. `x-youtube`
      .filter(
        (def) => allowNestedComponents !== 'exclude_self' || !parentComponentNames.includes(def.id),
      )
  );
};

/**
 * Get the keys of the extra values that belong to the editor components of a rich text field but
 * are no longer present in the editor. Left in place, they would trigger validation errors when the
 * entry is saved.
 * @param {Record<string, any>} extraValues Extra values of the locale.
 * @param {string} keyPath Key path of the rich text field.
 * @param {(prefix: string) => boolean} isPresent Function that tells whether the component with
 * the given key path prefix, e.g. `body:c12:`, is present in the editor.
 * @returns {string[]} Keys.
 */
export const getStaleExtraValueKeys = (extraValues, keyPath, isPresent) =>
  Object.keys(extraValues).filter((key) => {
    const [prefix] = key.match(COMPONENT_NAME_PREFIX_REGEX) ?? [];

    return !!prefix?.startsWith(`${keyPath}:`) && !isPresent(prefix);
  });
