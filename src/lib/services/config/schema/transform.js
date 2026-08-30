import { isObject } from '@sveltia/utils/object';

/**
 * Properties that can discriminate a union of object schemas. The generated schema pins these to a
 * constant in each branch: `widget` identifies a field type and `name` identifies a backend
 * service.
 */
const TAG_PROPERTIES = ['widget', 'name'];
/**
 * Maximum depth to follow while collecting the leaf schemas of a nested union. The generated schema
 * nests unions three levels deep at most; the limit only guards against a malformed schema.
 */
const MAX_UNION_DEPTH = 8;

/**
 * Resolve a local `$ref` pointer, following a chain of references.
 * @param {Record<string, any>} schema Root schema.
 * @param {any} node Node that may be a reference.
 * @returns {Record<string, any> | undefined} Resolved schema object, or `undefined` if the node is
 * not an object or the reference is circular or unresolvable.
 */
const resolveRef = (schema, node) => {
  /** @type {Set<string>} */
  const visited = new Set();
  let current = node;

  while (isObject(current) && typeof current.$ref === 'string') {
    if (visited.has(current.$ref)) {
      return undefined;
    }

    visited.add(current.$ref);

    current = current.$ref
      .split('/')
      .slice(1)
      .reduce((/** @type {any} */ value, key) => value?.[key], schema);
  }

  return isObject(current) ? current : undefined;
};

/**
 * Collect the leaf object schemas of a union branch. A branch can be a union itself, as `Field` is
 * a union of `StandardField` and `CustomField`, and `StandardField` in turn is a union of every
 * field type.
 * @param {Record<string, any>} schema Root schema.
 * @param {any} node Branch to inspect.
 * @param {number} [depth] Current recursion depth.
 * @returns {Record<string, any>[]} Leaf schemas, or an empty array if the branch is not made of
 * object schemas.
 */
const getLeaves = (schema, node, depth = 0) => {
  const resolved = resolveRef(schema, node);

  if (!resolved || depth > MAX_UNION_DEPTH) {
    return [];
  }

  if (Array.isArray(resolved.anyOf)) {
    return resolved.anyOf.flatMap((branch) => getLeaves(schema, branch, depth + 1));
  }

  return isObject(resolved.properties) ? [resolved] : [];
};

/**
 * Get the constant values a leaf schema allows for the given property.
 * @param {Record<string, any>} leaf Leaf schema.
 * @param {string} key Property name.
 * @returns {any[] | undefined} Allowed values, or `undefined` if the property is not pinned to a
 * constant or an enumeration.
 */
const getConstValues = (leaf, key) => {
  const property = leaf.properties?.[key];

  if (!isObject(property)) {
    return undefined;
  }

  if (property.const !== undefined) {
    return [property.const];
  }

  return Array.isArray(property.enum) ? property.enum : undefined;
};

/**
 * Describe how a union branch uses the given tag property.
 * @param {Record<string, any>} schema Root schema.
 * @param {any} branch Branch to inspect.
 * @param {string} key Tag property name.
 * @returns {{ values: any[], optional: boolean } | undefined} The values the branch accepts and
 * whether the tag can be omitted, or `undefined` if the branch is not tagged.
 */
const describeTag = (schema, branch, key) => {
  const leaves = getLeaves(schema, branch);

  if (!leaves.length) {
    return undefined;
  }

  /** @type {any[]} */
  const values = [];
  let optional = false;

  // Every leaf has to be tagged, or the branch can’t be selected by the tag alone
  if (
    !leaves.every((leaf) => {
      const leafValues = getConstValues(leaf, key);

      if (!leafValues) {
        return false;
      }

      values.push(...leafValues);
      optional ||= !(leaf.required ?? []).includes(key);

      return true;
    })
  ) {
    return undefined;
  }

  return { values: [...new Set(values)], optional };
};

/**
 * Get the properties a union branch always requires, which is the intersection of what its leaves
 * require.
 * @param {Record<string, any>} schema Root schema.
 * @param {any} branch Branch to inspect.
 * @returns {Set<string> | undefined} Property names, or `undefined` if the branch is not made of
 * object schemas.
 */
const getRequired = (schema, branch) => {
  const leaves = getLeaves(schema, branch);

  if (!leaves.length) {
    return undefined;
  }

  return leaves
    .map((leaf) => new Set(leaf.required ?? []))
    .reduce((a, b) => new Set([...a].filter((key) => b.has(key))));
};

/**
 * Get the names of every property a union branch defines, including those of its leaves.
 * @param {Record<string, any>} schema Root schema.
 * @param {any} branch Branch to inspect.
 * @returns {Set<string>} Property names.
 */
const getPropertyNames = (schema, branch) =>
  new Set(getLeaves(schema, branch).flatMap((leaf) => Object.keys(leaf.properties)));

/**
 * Build a schema that matches an object whose given property holds one of the given values.
 * @param {string} key Property name.
 * @param {any[]} values Allowed values.
 * @returns {Record<string, any>} Schema.
 */
const matchProperty = (key, values) => ({
  properties: { [key]: values.length === 1 ? { const: values[0] } : { enum: values } },
});

/**
 * Fold a list of conditional branches into a nested `if`/`then`/`else` chain.
 * @param {{ condition: Record<string, any>, branch: any }[]} entries Branches to chain, in the
 * order they should be tested.
 * @param {any} fallback Schema to apply when no condition matches.
 * @returns {Record<string, any>} Schema.
 */
const buildChain = (entries, fallback) =>
  entries.reduceRight(
    // oxlint-disable-next-line unicorn/no-thenable -- `then` is a JSON Schema keyword here
    (rest, { condition, branch }) => ({ if: condition, then: branch, else: rest }),
    fallback,
  );

/**
 * Rewrite a union whose branches are identified by a constant tag property, such as the field type
 * in `widget` or the backend service in `name`.
 * @param {Record<string, any>} schema Root schema.
 * @param {any[]} branches Original union branches.
 * @param {any[]} rewritten Branches with their own unions already rewritten.
 * @returns {Record<string, any> | undefined} Schema, or `undefined` if no tag identifies the
 * branches.
 */
const discriminateByTag = (schema, branches, rewritten) =>
  TAG_PROPERTIES.reduce((result, key) => {
    if (result) {
      return result;
    }

    const tags = branches.map((branch) => describeTag(schema, branch, key));
    const tagged = /** @type {{ values: any[], optional: boolean }[]} */ (tags.filter(Boolean));
    const values = tagged.flatMap((tag) => tag.values);

    // One untagged branch can serve as the fallback, as `CustomField` does for `Field`. Any more
    // than that, or overlapping values, and the tag doesn’t identify a single branch.
    if (
      !tagged.length ||
      tags.length - tagged.length > 1 ||
      values.length !== new Set(values).size
    ) {
      return undefined;
    }

    const entries = rewritten
      .map((branch, index) => ({ branch, tag: tags[index] }))
      .filter((entry) => !!entry.tag)
      // A branch that allows the tag to be omitted matches an object without one, so it has to be
      // tested after the branches that require it
      .sort((a, b) => Number(a.tag?.optional) - Number(b.tag?.optional))
      .map(({ branch, tag }) => ({
        branch,
        condition: tag?.optional
          ? matchProperty(key, tag.values)
          : { required: [key], ...matchProperty(key, /** @type {any[]} */ (tag?.values)) },
      }));

    const untagged = rewritten.filter((_branch, index) => !tags[index]);

    // Without an untagged branch, an unmatched object gets an error naming every allowed value
    return buildChain(entries, untagged[0] ?? { required: [key], ...matchProperty(key, values) });
  }, /** @type {Record<string, any> | undefined} */ (undefined));

/**
 * Rewrite a union whose branches are identified by the properties they require, such as `folder`
 * for an entry collection and `files` for a file collection.
 * @param {Record<string, any>} schema Root schema.
 * @param {any[]} branches Original union branches.
 * @param {any[]} rewritten Branches with their own unions already rewritten.
 * @returns {Record<string, any> | undefined} Schema, or `undefined` if no required property
 * identifies the branches.
 */
const discriminateByRequired = (schema, branches, rewritten) => {
  const required = branches.map((branch) => getRequired(schema, branch));

  if (required.some((names) => !names)) {
    return undefined;
  }

  const signatures = /** @type {Set<string>[]} */ (required);

  // A required property only identifies a branch if the other branches don’t accept it at all. A
  // collection divider may have a `name`, for instance, so `name` can’t select a collection.
  const markers = signatures.map((names, index) => {
    const others = branches.reduce(
      (acc, branch, otherIndex) =>
        index === otherIndex ? acc : new Set([...acc, ...getPropertyNames(schema, branch)]),
      /** @type {Set<string>} */ (new Set()),
    );

    return [...names].filter((name) => !others.has(name));
  });

  // As with tags, one branch without a marker can serve as the fallback
  if (markers.filter((names) => !names.length).length > 1) {
    return undefined;
  }

  const entries = rewritten
    .map((branch, index) => ({ branch, markers: markers[index] }))
    .filter((entry) => entry.markers.length)
    .map(({ branch, markers: names }) => ({
      branch,
      condition:
        names.length === 1
          ? { required: [names[0]] }
          : { anyOf: names.map((name) => ({ required: [name] })) },
    }));

  const fallbackIndex = markers.findIndex((names) => !names.length);

  const fallback =
    fallbackIndex > -1
      ? rewritten[fallbackIndex]
      : { anyOf: entries.map(({ condition }) => condition) };

  return buildChain(entries, fallback);
};

/**
 * Adapt the published JSON schema for runtime validation.
 *
 * Two changes make the validator’s output usable. Unknown properties are allowed, because a
 * configuration written for another CMS, or for a newer version of Sveltia CMS, carries options
 * that are simply ignored and shouldn’t stop anyone from signing in. And each union of object
 * schemas becomes an `if`/`then`/`else` chain keyed on whatever identifies its branches, so that a
 * mistyped option in a Markdown field is reported once against the Markdown field, instead of once
 * for every field type the object failed to be.
 * @param {Record<string, any>} schema Published schema.
 * @returns {Record<string, any>} Schema to validate against.
 */
export const prepareSchema = (schema) => {
  /**
   * Rewrite a node and everything below it.
   * @param {any} node Node to rewrite.
   * @returns {any} Rewritten node.
   */
  const rewrite = (node) => {
    if (Array.isArray(node)) {
      return node.map(rewrite);
    }

    if (!isObject(node)) {
      return node;
    }

    /** @type {Record<string, any>} */
    const result = {};

    Object.entries(node).forEach(([key, value]) => {
      // `anyOf` is handled below, once its branches have been rewritten
      if (key !== 'anyOf' && !(key === 'additionalProperties' && value === false)) {
        result[key] = rewrite(value);
      }
    });

    if (Array.isArray(node.anyOf)) {
      const rewritten = node.anyOf.map(rewrite);

      const replacement =
        node.anyOf.length > 1
          ? (discriminateByTag(schema, node.anyOf, rewritten) ??
            discriminateByRequired(schema, node.anyOf, rewritten))
          : undefined;

      if (replacement) {
        Object.assign(result, replacement);
      } else {
        result.anyOf = rewritten;
      }
    }

    return result;
  };

  return rewrite(schema);
};
