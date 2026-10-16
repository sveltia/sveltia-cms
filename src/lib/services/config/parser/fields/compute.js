import { FIELD_TAG_PREFIX_REGEX, UUID_TYPES } from '$lib/services/common/template/constants';
import { replaceTemplateTags } from '$lib/services/common/template/tags';
import { stripFieldTagPrefix } from '$lib/services/common/template/utils';
import { parseTransformations } from '$lib/services/common/transformations';
import { getRootFields } from '$lib/services/config/parser/utils/fields';
import { checkFieldReferences } from '$lib/services/config/parser/utils/references';
import { addMessage } from '$lib/services/config/parser/utils/validator';
import { parseExpression } from '$lib/services/contents/fields/compute/expression';

/**
 * @import { FieldParserArgs } from '$lib/types/private';
 * @import { ExpressionTag } from '$lib/services/contents/fields/compute/expression';
 * @import { ComputeField } from '$lib/types/public';
 */

/**
 * Check the arithmetic expression of a Compute field with a numeric `value_type`. An invalid one,
 * or one with a UUID tag, which never resolves to a number, would leave the value empty.
 * @param {FieldParserArgs} args Arguments.
 */
const checkExpression = ({ config, context, collectors }) => {
  const { value, value_type: valueType } = /** @type {ComputeField} */ (config);
  const { tree, tags } = parseExpression(value);

  if (!tree) {
    addMessage({
      strKey: 'compute_field_invalid_expression',
      values: { valueType },
      context,
      collectors,
    });

    return;
  }

  if (tags.some(({ content }) => Object.hasOwn(UUID_TYPES, parseTransformations(content).value))) {
    addMessage({
      strKey: 'compute_field_uuid_in_expression',
      values: { valueType },
      context,
      collectors,
    });
  }
};

/**
 * Get the template tags in the `value` option of a Compute field.
 * @param {string} value The `value` option.
 * @param {boolean} numeric Whether the field has a numeric `value_type`, which makes the option an
 * arithmetic expression.
 * @returns {ExpressionTag[]} Tags. `allItems` is only set for a tag passed to an aggregate function
 * in an arithmetic expression. Empty for an invalid expression.
 */
const getTags = (value, numeric) => {
  if (numeric) {
    const { tree, tags } = parseExpression(value);

    // Which tag is passed to an aggregate function isn’t known for an invalid expression, which is
    // reported anyway
    return tree ? tags : [];
  }

  /** @type {ExpressionTag[]} */
  const tags = [];

  replaceTemplateTags(value, (match, content) => {
    tags.push({ content, allItems: false });

    return match;
  });

  return tags;
};

/**
 * Check the `{{fields.*}}` tags of a Compute field. A tag referring to the field itself, like
 * `{{fields.lines.*.amount}}` in `lines.*.amount`, makes the value change whenever it’s resolved,
 * which happens again whenever a value changes, so it never settles. Every `*` has to stand for an
 * item the field is in, like `{{fields.lines.*.price}}` for a field in the `lines` list. Any other
 * `*` resolves to nothing, unless the tag is passed to an aggregate function like `sum()`, where it
 * covers every item.
 * @param {FieldParserArgs} args Arguments.
 * @param {ExpressionTag[]} tags Template tags in the `value` option.
 */
const checkFieldTags = ({ context, collectors }, tags) => {
  // Drop the variable type names, as in `lines.*<product>.amount`
  const ownKeyPath = (context.typedKeyPath ?? '').replace(/<[^>]*>/g, '');
  const ownSegments = ownKeyPath.split('.');

  tags.forEach(({ content, allItems }) => {
    const { value: tagName } = parseTransformations(content);

    if (!FIELD_TAG_PREFIX_REGEX.test(tagName)) {
      return;
    }

    const keyPath = stripFieldTagPrefix(tagName);

    if (keyPath === ownKeyPath) {
      addMessage({
        type: 'warning',
        strKey: 'compute_field_self_reference',
        values: { name: tagName },
        context,
        collectors,
      });

      return;
    }

    if (allItems) {
      return;
    }

    const segments = keyPath.split('.');

    const valid = segments.every(
      (segment, index) =>
        segment !== '*' || segments.slice(0, index + 1).every((s, i) => s === ownSegments[i]),
    );

    if (!valid) {
      addMessage({
        type: 'warning',
        strKey: 'compute_field_wildcard_without_item',
        values: { name: tagName },
        context,
        collectors,
      });
    }
  });
};

/**
 * Parse and validate a Compute field configuration. The `value` template reads other fields of the
 * entry through `{{fields.*}}` tags, and a tag that names no field yields an empty string, so the
 * computed value silently comes out wrong. Bare tags are not field references: `{{index}}` is the
 * position of the item in a list, `{{uuid}}` and its shorter variants are generated, and any other
 * one yields nothing, so there is no point checking them against the fields. With a numeric
 * `value_type`, the `value` is also checked as an arithmetic expression. A tag is checked not to
 * refer to the field itself, and a `*` in it to stand for an item the field is in.
 * @param {FieldParserArgs} args Arguments.
 */
export const parseComputeFieldConfig = ({ config, context, collectors }) => {
  const { value, value_type: valueType = 'string' } = /** @type {ComputeField} */ (config);
  // The fields of a custom editor component aren’t known here, so only a field of a collection or
  // file can be checked
  const fields = getRootFields(context);

  // A value of another type is reported against the JSON schema
  if (typeof value === 'string') {
    if (valueType !== 'string') {
      checkExpression({ config, context, collectors });
    }

    // The key path of a field of a custom editor component is relative to the component, while a
    // tag can refer to a field of the entry as well
    if (!context.componentName) {
      checkFieldTags({ config, context, collectors }, getTags(value, valueType !== 'string'));
    }
  }

  if (fields?.length) {
    checkFieldReferences({
      option: 'value',
      template: value,
      prefixedOnly: true,
      fields,
      context,
      collectors,
    });
  }
};
