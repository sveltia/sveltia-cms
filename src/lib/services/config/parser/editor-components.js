import { addMessage } from '$lib/services/config/parser/utils/validator';
import { isInlinePatternComponent } from '$lib/services/contents/fields/rich-text/components/inline-pattern';
import { isMultiLinePattern } from '$lib/services/contents/fields/rich-text/components/utils';

/**
 * @import { ConfigParserCollectors } from '$lib/types/private';
 * @import { CmsConfig, CustomEditorComponentDefinition, Field } from '$lib/types/public';
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
 * `CMS.registerEditorComponent()` API, apart from its fields, which are parsed like any other. A
 * pattern-based inline component has no fields, but its pattern has to match within a paragraph:
 * one with the `m` or `s` flag, or `[\s\S]`, is meant to span lines, which it can’t.
 * @param {object} args Arguments.
 * @param {CustomEditorComponentDefinition} args.definition Component definition.
 * @param {string} args.componentName Name the component is registered with.
 * @param {CmsConfig} args.cmsConfig CMS configuration.
 * @param {ConfigParserCollectors} args.collectors Collectors.
 */
export const parseEditorComponent = ({ definition, componentName, cmsConfig, collectors }) => {
  const context = { cmsConfig, componentName };

  if (isInlinePatternComponent(definition)) {
    if (isMultiLinePattern(definition.pattern)) {
      addMessage({
        type: 'warning',
        strKey: 'inline_component_multiline_pattern',
        context,
        collectors,
      });
    }

    return;
  }

  const { mode, fields } = definition;

  if (mode === 'inline' && !isInlineComponentFieldList(fields)) {
    addMessage({ strKey: 'invalid_inline_component_fields', context, collectors });
  }
};
