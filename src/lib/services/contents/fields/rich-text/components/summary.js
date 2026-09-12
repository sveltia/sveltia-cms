import { flatten } from 'flat';

import { replaceTemplateTags } from '$lib/services/common/template';
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
 * @returns {string | null} Formatted summary, or `null` if the template is empty or every
 * placeholder resolved to an empty value.
 */
export const formatComponentSummary = ({ template, values, fields, locale }) => {
  if (!template || !values) {
    return null;
  }

  /** @type {Record<string, any>} */
  const flatValues = flatten(values);

  const result = replaceTemplateTags(template, (__, placeholder) => {
    const { value: tag, transformations } = parseTransformations(placeholder);
    const fieldName = tag.replace(/^fields\./, '');
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
  const strippedTemplate = replaceTemplateTags(template, () => '');

  if (result !== strippedTemplate && result.trim()) {
    return result.trim();
  }

  return null;
};
