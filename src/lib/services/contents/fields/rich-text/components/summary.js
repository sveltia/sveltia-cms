import { flatten } from 'flat';

import { replaceTemplateTags } from '$lib/services/common/template/tags';
import { stripFieldTagPrefix } from '$lib/services/common/template/utils';
import { applyTransformations, parseTransformations } from '$lib/services/common/transformations';

/**
 * @import { Field, RawEntryContent } from '$lib/types/public';
 */

/**
 * Format the summary template of a rich text editor component, replacing `{{fieldName}}`
 * placeholders with the component’s values. Nested properties and transformations are supported
 * like the summary of an Object field, but the values are looked up in the component’s own values
 * rather than in the entry draft, so there is no key path to resolve.
 * @param {object} args Arguments.
 * @param {string} [args.template] Summary template, e.g. `{{title}} - {{linkType.url | upper}}`.
 * @param {RawEntryContent} [args.values] Current values (unflattened).
 * @param {Field[]} args.fields Field definitions of the component.
 * @param {string} [args.locale] Locale code passed to the transformations.
 * @returns {string | null} Formatted summary, or `null` if the template is blank or every
 * placeholder resolved to an empty value. A template without placeholders is returned as is.
 */
export const formatComponentSummary = ({ template, values, fields, locale }) => {
  if (!template) {
    return null;
  }

  const strippedTemplate = replaceTemplateTags(template, () => '');

  // A template without placeholders is plain text, shown as is unless it’s blank
  if (strippedTemplate === template) {
    return template.trim() || null;
  }

  if (!values) {
    return null;
  }

  /** @type {Record<string, any>} */
  const flatValues = flatten(values);

  const result = replaceTemplateTags(template, (__, placeholder) => {
    const { value: tag, transformations } = parseTransformations(placeholder);
    const fieldName = stripFieldTagPrefix(tag);
    let value = flatValues[fieldName];

    if (value === undefined || value === null) {
      return '';
    }

    if (transformations.length) {
      value = applyTransformations({
        fieldConfig: fields.find((f) => f.name === fieldName),
        value,
        transformations,
        locale,
      });
    }

    return String(value);
  });

  // Return `null` if the result (after stripping all placeholder-based content) is empty. This
  // handles the case where all field values are empty but literal text (e.g. ' — ') remains.
  if (result !== strippedTemplate && result.trim()) {
    return result.trim();
  }

  return null;
};

/**
 * Get the values to display in the placeholder of a rich text editor component in `dialog` mode:
 * the values stored in the entry draft, or the values parsed from the document while the draft has
 * no field values yet, e.g. on the initial render.
 * @param {object} args Arguments.
 * @param {RawEntryContent} [args.currentValues] Values stored in the entry draft.
 * @param {RawEntryContent} [args.values] Values parsed from the document.
 * @param {Field[]} args.fields Field definitions of the component.
 * @returns {RawEntryContent | undefined} Values.
 */
export const getComponentDisplayValues = ({ currentValues, values, fields }) =>
  fields.some((f) => currentValues?.[f.name] !== undefined) ? currentValues : values;

/**
 * Get the text shown in the placeholder of a rich text editor component in `dialog` mode: the
 * formatted summary template if it produces anything, the value of the first string or text field
 * otherwise, or the component label as a last resort. The label is omitted if a thumbnail is shown
 * instead, as the image identifies the component well enough.
 * @param {object} args Arguments.
 * @param {string} [args.template] Summary template, e.g. `{{title}}`.
 * @param {RawEntryContent} [args.currentValues] Values stored in the entry draft.
 * @param {RawEntryContent} [args.values] Values parsed from the document, used while the entry
 * draft has no field values yet, e.g. on the initial render.
 * @param {Field[]} args.fields Field definitions of the component.
 * @param {string} [args.locale] Locale code passed to the transformations.
 * @param {string} args.label Component label.
 * @param {boolean} [args.hasThumbnail] Whether the placeholder shows a thumbnail.
 * @returns {string} Text, which can be empty if {@link args.hasThumbnail} is `true`.
 */
export const getComponentDisplayText = ({
  template,
  currentValues,
  values,
  fields,
  locale,
  label,
  hasThumbnail = false,
}) => {
  const _values = getComponentDisplayValues({ currentValues, values, fields });
  const formatted = formatComponentSummary({ template, values: _values, fields, locale });

  if (formatted) {
    return formatted;
  }

  const displayField = fields.find(
    (f) => f.widget === 'string' || f.widget === 'text' || !f.widget,
  );

  if (displayField && _values) {
    const value = _values[displayField.name];

    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return hasThumbnail ? '' : label;
};
