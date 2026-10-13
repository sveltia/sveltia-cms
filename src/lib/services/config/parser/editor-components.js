import { addMessage } from '$lib/services/config/parser/utils/validator';

/**
 * @import { ConfigParserCollectors } from '$lib/types/private';
 * @import { CmsConfig, EditorComponentDefinition, Field } from '$lib/types/public';
 */

/**
 * Field types a component in the `inline` mode can have. They all hold a single simple value
 * edited with a compact control, which fits in a line of text.
 */
export const INLINE_COMPONENT_FIELD_TYPES = [
  'boolean',
  'color',
  'datetime',
  'number',
  'relation',
  'select',
  'string',
];

/**
 * Check if the given fields can be edited in a component in the `inline` mode: a single field of
 * one of the {@link INLINE_COMPONENT_FIELD_TYPES}, holding one value rather than several.
 * @param {Field[]} fields Fields of the component.
 * @returns {boolean} Result.
 */
export const isInlineComponentFieldList = (fields) => {
  if (fields.length !== 1) {
    return false;
  }

  const [field] = fields;
  const fieldType = field.widget ?? 'string';

  return (
    INLINE_COMPONENT_FIELD_TYPES.includes(fieldType) &&
    !(/** @type {{ multiple?: boolean }} */ (field).multiple)
  );
};

/**
 * Parse and validate the definition of a custom editor component registered with the
 * `CMS.registerEditorComponent()` API, apart from its fields, which are parsed like any other.
 * @param {object} args Arguments.
 * @param {EditorComponentDefinition} args.definition Component definition.
 * @param {string} args.componentName Name the component is registered with.
 * @param {CmsConfig} args.cmsConfig CMS configuration.
 * @param {ConfigParserCollectors} args.collectors Collectors.
 */
export const parseEditorComponent = ({ definition, componentName, cmsConfig, collectors }) => {
  const { mode, fields } = definition;

  if (mode === 'inline' && !isInlineComponentFieldList(fields)) {
    addMessage({
      strKey: 'invalid_inline_component_fields',
      context: { cmsConfig, componentName },
      collectors,
    });
  }
};
