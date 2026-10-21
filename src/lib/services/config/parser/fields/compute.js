import { FIELD_TAG_PREFIX_REGEX, UUID_TYPES } from '$lib/services/common/template/constants';
import { processNestedTemplates } from '$lib/services/common/template/nested';
import { splitTemplateTags } from '$lib/services/common/template/tags';
import { stripFieldTagPrefix } from '$lib/services/common/template/utils';
import { parseTransformations } from '$lib/services/common/transformations';
import { getRootFields } from '$lib/services/config/parser/utils/fields';
import { checkFieldReferences } from '$lib/services/config/parser/utils/references';
import { addMessage } from '$lib/services/config/parser/utils/validator';
import { parseExpression } from '$lib/services/contents/fields/compute/expression';
import { yieldsNumber } from '$lib/services/contents/fields/number/helpers';
import { getOrCreate } from '$lib/services/utils/cache';

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

  return splitTemplateTags(value).tags.map((content) => ({ content, allItems: false }));
};

/**
 * Regular expression matching a variable type name in a typed key path, e.g. `<product>`.
 */
const TYPE_NAME_REGEX = /<[^>]*>/g;
/**
 * Regular expression matching a list index in a key path, e.g. `.0` in `lines.0.price`.
 */
const LIST_INDEX_REGEX = /(?<=^|\.)\d+(?=\.|$)/g;

/**
 * Get the fields the given template tag refers to: the tag itself, if it’s a `{{fields.*}}` tag,
 * and the tags in its transformation arguments, like `{{fields.title}}` in
 * `default('{{fields.title}}')`, which the runtime resolves as well.
 * @param {string} content Content of the tag, e.g. `fields.title | upper`.
 * @returns {{ tagName: string, keyPath: string }[]} The name of each tag, e.g.
 * `fields.lines.0.price`, and the key path it refers to, with a `*` for every list index as in the
 * key path of the field, e.g. `lines.*.price`.
 */
const getFieldReferences = (content) => {
  const { value: tagName, transformations } = parseTransformations(content);
  /** @type {{ tagName: string, keyPath: string }[]} */
  const references = [];

  if (FIELD_TAG_PREFIX_REGEX.test(tagName)) {
    references.push({
      tagName,
      keyPath: stripFieldTagPrefix(tagName).replace(LIST_INDEX_REGEX, '*'),
    });
  }

  processNestedTemplates(transformations, (innerTag) => {
    references.push(...getFieldReferences(innerTag));

    return '';
  });

  return references;
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
  const ownKeyPath = (context.typedKeyPath ?? '').replace(TYPE_NAME_REGEX, '');
  const ownSegments = ownKeyPath.split('.');

  tags.forEach(({ content, allItems }) => {
    const selfReference = getFieldReferences(content).find(({ keyPath }) => keyPath === ownKeyPath);

    if (selfReference) {
      addMessage({
        type: 'warning',
        strKey: 'compute_field_self_reference',
        values: { name: selfReference.tagName },
        context,
        collectors,
      });

      return;
    }

    const { value: tagName } = parseTransformations(content);

    if (!FIELD_TAG_PREFIX_REGEX.test(tagName)) {
      return;
    }

    const keyPath = stripFieldTagPrefix(tagName);

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
 * A Compute field in the field list of a collection or file, with the fields it refers to.
 * @typedef {object} ComputeFieldNode
 * @property {string} typedKeyPath Key path of the field as given to the field parser, including any
 * variable type name, e.g. `lines.*<product>.amount`.
 * @property {string} keyPath The same without the type names, e.g. `lines.*.amount`.
 * @property {Set<string>} references Key paths of the `{{fields.*}}` tags in the `value` option,
 * with a `*` for every list index, e.g. `lines.*.price` for `{{fields.lines.0.price}}`.
 */

/**
 * Collect the Compute fields in the given field list, at any depth.
 * @param {any} fields Field list. A value that isn’t a list is reported against the JSON schema.
 * @param {string} [typedKeyPath] Typed key path of the field holding the list, if any.
 * @returns {ComputeFieldNode[]} Fields.
 */
const collectComputeFieldNodes = (fields, typedKeyPath = '') =>
  (Array.isArray(fields) ? fields : []).flatMap((field) =>
    // eslint-disable-next-line no-use-before-define
    collectFromField(field, typedKeyPath ? `${typedKeyPath}.${field?.name}` : `${field?.name}`),
  );

/**
 * Collect the Compute fields in the variable types of an Object or List field.
 * @param {any} types The `types` option.
 * @param {string} typedKeyPath Typed key path of the object or the list item, without the type.
 * @returns {ComputeFieldNode[]} Fields.
 */
const collectFromTypes = (types, typedKeyPath) =>
  (Array.isArray(types) ? types : []).flatMap((type) =>
    collectComputeFieldNodes(type?.fields, `${typedKeyPath}<${type?.name}>`),
  );

/**
 * Collect the given field if it’s a Compute field, or the Compute fields below it otherwise. The
 * key paths are built the same way as the field parser builds `typedKeyPath`.
 * @param {any} field Field configuration.
 * @param {string} typedKeyPath Typed key path of the field.
 * @returns {ComputeFieldNode[]} Fields.
 */
const collectFromField = (field, typedKeyPath) => {
  const { widget = 'string', value } = field ?? {};

  if (widget === 'compute') {
    const references = new Set(
      (typeof value === 'string' ? getTags(value, yieldsNumber(field)) : []).flatMap(
        ({ content }) => getFieldReferences(content).map(({ keyPath }) => keyPath),
      ),
    );

    return [{ typedKeyPath, keyPath: typedKeyPath.replace(TYPE_NAME_REGEX, ''), references }];
  }

  if (widget === 'object') {
    return [
      ...collectComputeFieldNodes(field.fields, typedKeyPath),
      ...collectFromTypes(field.types, typedKeyPath),
    ];
  }

  if (widget === 'list') {
    const itemKeyPath = `${typedKeyPath}.*`;

    return [
      // The single subfield takes the item’s own key path
      ...(field.field ? collectFromField(field.field, itemKeyPath) : []),
      ...collectComputeFieldNodes(field.fields, itemKeyPath),
      ...collectFromTypes(field.types, itemKeyPath),
    ];
  }

  return [];
};

/**
 * Reference cycles among the Compute fields of a field list, keyed by the list. A list is shared by
 * every Compute field in it, so the cycles are found once for all of them.
 * @type {WeakMap<object, Map<string, string>>}
 */
const referenceCycleCacheMap = new WeakMap();

/**
 * Find the reference cycles among the Compute fields in the given field list, like `a` referring
 * to `b` and `b` referring back to `a`, possibly through others. Each such group of fields is
 * found as a strongly connected component of the reference graph, in a single depth-first search.
 * A field referring to itself alone is reported separately, so it’s not a cycle here.
 * @param {object} fields Root field list of a collection or file.
 * @returns {Map<string, string>} Key path of another field of the cycle, keyed by the typed key
 * path of the field the cycle is reported for: the first field of each cycle in key path order, so
 * each one is reported once.
 */
const getReferenceCycles = (fields) =>
  getOrCreate(referenceCycleCacheMap, fields, () => {
    const nodes = collectComputeFieldNodes(fields);

    // A reference matches every variable type of the field, as a tag can’t name the type. A field
    // referring to the same key path, in its own type or another, is reported as referring to
    // itself instead
    const targets = new Map(
      nodes.map((node) => [
        node,
        nodes.filter(
          (other) => other.keyPath !== node.keyPath && node.references.has(other.keyPath),
        ),
      ]),
    );

    /** @type {Map<ComputeFieldNode, { index: number, lowLink: number }>} */
    const visited = new Map();
    /** @type {ComputeFieldNode[]} */
    const stack = [];
    /** @type {Set<ComputeFieldNode>} */
    const onStack = new Set();
    /** @type {Map<string, string>} */
    const cycles = new Map();

    /**
     * Visit the given node and the nodes it refers to, recording each strongly connected component
     * of more than one node.
     * @param {ComputeFieldNode} node Node.
     */
    const visit = (node) => {
      const state = { index: visited.size, lowLink: visited.size };

      visited.set(node, state);
      stack.push(node);
      onStack.add(node);

      /** @type {ComputeFieldNode[]} */ (targets.get(node)).forEach((target) => {
        if (!visited.has(target)) {
          visit(target);
          state.lowLink = Math.min(
            state.lowLink,
            /** @type {{ lowLink: number }} */ (visited.get(target)).lowLink,
          );
        } else if (onStack.has(target)) {
          state.lowLink = Math.min(
            state.lowLink,
            /** @type {{ index: number }} */ (visited.get(target)).index,
          );
        }
      });

      if (state.lowLink !== state.index) {
        return;
      }

      /** @type {ComputeFieldNode[]} */
      const component = [];
      /** @type {ComputeFieldNode | undefined} */
      let member;

      do {
        member = /** @type {ComputeFieldNode} */ (stack.pop());
        onStack.delete(member);
        component.push(member);
      } while (member !== node);

      if (component.length > 1) {
        const [first] = component.toSorted((a, b) => a.typedKeyPath.localeCompare(b.typedKeyPath));

        const next = /** @type {ComputeFieldNode} */ (
          /** @type {ComputeFieldNode[]} */ (targets.get(first)).find((target) =>
            component.includes(target),
          )
        );

        cycles.set(first.typedKeyPath, next.keyPath);
      }
    };

    nodes.forEach((node) => {
      if (!visited.has(node)) {
        visit(node);
      }
    });

    return cycles;
  });

/**
 * Parse and validate a Compute field configuration. The `value` template reads other fields of the
 * entry through `{{fields.*}}` tags, and a tag that names no field yields an empty string, so the
 * computed value silently comes out wrong. Bare tags are not field references: `{{index}}` is the
 * position of the item in a list, `{{uuid}}` and its shorter variants are generated, and any other
 * one yields nothing, so there is no point checking them against the fields. With a numeric
 * `value_type`, the `value` is also checked as an arithmetic expression. A tag is checked not to
 * refer to the field itself, and a `*` in it to stand for an item the field is in. A reference
 * cycle among the Compute fields of the collection or file is reported for one of its fields.
 * @param {FieldParserArgs} args Arguments.
 */
export const parseComputeFieldConfig = ({ config, context, collectors }) => {
  const { value } = /** @type {ComputeField} */ (config);
  const numeric = yieldsNumber(config);
  // The fields of a custom editor component aren’t known here, so only a field of a collection or
  // file can be checked
  const fields = getRootFields(context);

  // A value of another type is reported against the JSON schema
  if (typeof value === 'string') {
    if (numeric) {
      checkExpression({ config, context, collectors });
    }

    // The key path of a field of a custom editor component is relative to the component, while a
    // tag can refer to a field of the entry as well
    if (!context.componentName) {
      checkFieldTags({ config, context, collectors }, getTags(value, numeric));
    }
  }

  if (fields?.length) {
    // The values of the fields in a cycle keep changing each other, so they never settle
    const otherKeyPath = getReferenceCycles(fields).get(context.typedKeyPath ?? '');

    if (otherKeyPath !== undefined) {
      addMessage({
        type: 'warning',
        strKey: 'compute_field_reference_cycle',
        values: { name: `fields.${otherKeyPath}` },
        context,
        collectors,
      });
    }

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
