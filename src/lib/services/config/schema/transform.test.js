// `then` and `else` are JSON Schema keywords, not promise callbacks
/* oxlint-disable unicorn/no-thenable */
import { describe, expect, test } from 'vitest';

import { prepareSchema } from './transform';

/**
 * Build a schema with the given definitions and a root that references `Root`.
 * @param {Record<string, any>} definitions Definitions.
 * @returns {Record<string, any>} Schema.
 */
const build = (definitions) => ({ $ref: '#/definitions/Root', definitions });

describe('config/schema/transform', () => {
  describe('prepareSchema', () => {
    test('allows unknown properties', () => {
      const { definitions } = prepareSchema(
        build({
          Root: {
            type: 'object',
            additionalProperties: false,
            properties: { nested: { type: 'object', additionalProperties: false } },
          },
        }),
      );

      expect(definitions.Root.additionalProperties).toBeUndefined();
      expect(definitions.Root.properties.nested.additionalProperties).toBeUndefined();
    });

    test('keeps an explicit additional property schema', () => {
      const { definitions } = prepareSchema(
        build({ Root: { type: 'object', additionalProperties: { type: 'string' } } }),
      );

      expect(definitions.Root.additionalProperties).toEqual({ type: 'string' });
    });

    test('leaves values that are not schemas alone', () => {
      const { definitions } = prepareSchema(
        build({ Root: { type: 'object', required: ['a'], enum: [1, null, 'x'] } }),
      );

      expect(definitions.Root).toEqual({ type: 'object', required: ['a'], enum: [1, null, 'x'] });
    });

    test('leaves a union with a single branch alone', () => {
      const { definitions } = prepareSchema(
        build({ Root: { anyOf: [{ $ref: '#/definitions/A' }] }, A: { properties: {} } }),
      );

      expect(definitions.Root.anyOf).toEqual([{ $ref: '#/definitions/A' }]);
    });

    test('leaves a union of non-object branches alone', () => {
      const { definitions } = prepareSchema(
        build({ Root: { anyOf: [{ type: 'string' }, { type: 'number' }] } }),
      );

      expect(definitions.Root.anyOf).toEqual([{ type: 'string' }, { type: 'number' }]);
    });
  });

  describe('discrimination by a constant tag', () => {
    const fieldTypes = {
      Root: { anyOf: [{ $ref: '#/definitions/Text' }, { $ref: '#/definitions/Str' }] },
      Text: {
        properties: { widget: { const: 'text' }, name: { type: 'string' } },
        required: ['name', 'widget'],
      },
      // A field without a `widget` option defaults to a string, so the tag is optional here
      Str: { properties: { widget: { const: 'string' } }, required: ['name'] },
    };

    test('selects the branch the tag names', () => {
      const { definitions } = prepareSchema(build(fieldTypes));

      expect(definitions.Root).toEqual({
        if: { required: ['widget'], properties: { widget: { const: 'text' } } },
        then: { $ref: '#/definitions/Text' },
        else: {
          if: { properties: { widget: { const: 'string' } } },
          then: { $ref: '#/definitions/Str' },
          else: {
            required: ['widget'],
            properties: { widget: { enum: ['text', 'string'] } },
          },
        },
      });
    });

    test('reports every allowed value when no branch matches', () => {
      const schema = prepareSchema(build(fieldTypes));

      expect(schema.definitions.Root.else.else).toEqual({
        required: ['widget'],
        properties: { widget: { enum: ['text', 'string'] } },
      });
    });

    test('uses an untagged branch as the fallback', () => {
      const { definitions } = prepareSchema(
        build({
          Root: { anyOf: [{ $ref: '#/definitions/Known' }, { $ref: '#/definitions/Custom' }] },
          Known: { properties: { widget: { const: 'text' } }, required: ['widget'] },
          Custom: { properties: { widget: { type: 'string' } }, required: ['widget'] },
        }),
      );

      expect(definitions.Root).toEqual({
        if: { required: ['widget'], properties: { widget: { const: 'text' } } },
        then: { $ref: '#/definitions/Known' },
        else: { $ref: '#/definitions/Custom' },
      });
    });

    test('flattens a nested union into the values of its leaves', () => {
      const { definitions } = prepareSchema(
        build({
          Root: { anyOf: [{ $ref: '#/definitions/Group' }, { $ref: '#/definitions/Solo' }] },
          Group: { anyOf: [{ $ref: '#/definitions/A' }, { $ref: '#/definitions/B' }] },
          A: { properties: { widget: { const: 'a' } }, required: ['widget'] },
          B: { properties: { widget: { const: 'b' } }, required: ['widget'] },
          Solo: { properties: { widget: { const: 'c' } }, required: ['widget'] },
        }),
      );

      expect(definitions.Root.if).toEqual({
        required: ['widget'],
        properties: { widget: { enum: ['a', 'b'] } },
      });
      expect(definitions.Root.then).toEqual({ $ref: '#/definitions/Group' });
    });

    test('falls back to the second tag when the first doesn’t identify a branch', () => {
      const { definitions } = prepareSchema(
        build({
          Root: { anyOf: [{ $ref: '#/definitions/A' }, { $ref: '#/definitions/B' }] },
          // Both branches share a `widget` value, so only `name` can tell them apart
          A: { properties: { widget: { const: 'x' }, name: { const: 'a' } }, required: ['name'] },
          B: { properties: { widget: { const: 'x' }, name: { const: 'b' } }, required: ['name'] },
        }),
      );

      expect(definitions.Root.if).toEqual({
        required: ['name'],
        properties: { name: { const: 'a' } },
      });
    });

    test('ignores a tag more than one branch leaves out', () => {
      const { definitions } = prepareSchema(
        build({
          Root: {
            anyOf: [
              { $ref: '#/definitions/A' },
              { $ref: '#/definitions/B' },
              { $ref: '#/definitions/C' },
            ],
          },
          A: { properties: { widget: { const: 'a' } }, required: ['a'] },
          B: { properties: { b: { type: 'string' } }, required: ['b'] },
          C: { properties: { c: { type: 'string' } }, required: ['c'] },
        }),
      );

      // `widget` is unusable, so the branches are told apart by what they require instead
      expect(definitions.Root.if).toEqual({ required: ['a'] });
    });

    test('ignores an enumerated tag that isn’t unique to a branch', () => {
      const { definitions } = prepareSchema(
        build({
          Root: { anyOf: [{ $ref: '#/definitions/A' }, { $ref: '#/definitions/B' }] },
          A: { properties: { widget: { enum: ['x', 'y'] } } },
          B: { properties: { widget: { enum: ['y', 'z'] } } },
        }),
      );

      expect(definitions.Root.anyOf).toHaveLength(2);
    });
  });

  describe('discrimination by required properties', () => {
    const collections = {
      Root: { anyOf: [{ $ref: '#/definitions/Entry' }, { $ref: '#/definitions/File' }] },
      Entry: {
        properties: { name: { type: 'string' }, folder: {}, fields: {} },
        required: ['name', 'folder', 'fields'],
      },
      File: { properties: { name: { type: 'string' }, files: {} }, required: ['name', 'files'] },
    };

    test('selects the branch by the properties only it accepts', () => {
      const { definitions } = prepareSchema(build(collections));

      expect(definitions.Root).toEqual({
        // `name` identifies neither branch, as both accept it
        if: { anyOf: [{ required: ['folder'] }, { required: ['fields'] }] },
        then: { $ref: '#/definitions/Entry' },
        else: {
          if: { required: ['files'] },
          then: { $ref: '#/definitions/File' },
          else: {
            anyOf: [
              { anyOf: [{ required: ['folder'] }, { required: ['fields'] }] },
              { required: ['files'] },
            ],
          },
        },
      });
    });

    test('uses a branch without a marker as the fallback', () => {
      const { definitions } = prepareSchema(
        build({
          Root: { anyOf: [{ $ref: '#/definitions/Plain' }, { $ref: '#/definitions/WithSub' }] },
          Plain: { properties: { name: {} }, required: ['name'] },
          WithSub: { properties: { name: {}, field: {} }, required: ['name', 'field'] },
        }),
      );

      expect(definitions.Root).toEqual({
        if: { required: ['field'] },
        then: { $ref: '#/definitions/WithSub' },
        else: { $ref: '#/definitions/Plain' },
      });
    });

    test('ignores a required property the other branches also accept', () => {
      const { definitions } = prepareSchema(
        build({
          Root: { anyOf: [{ $ref: '#/definitions/Item' }, { $ref: '#/definitions/Divider' }] },
          Item: { properties: { name: {}, folder: {} }, required: ['name', 'folder'] },
          // A divider may carry a `name`, so `name` can’t select a collection
          Divider: { properties: { name: {}, divider: {} }, required: ['divider'] },
        }),
      );

      expect(definitions.Root.if).toEqual({ required: ['folder'] });
    });

    test('takes the properties a nested union always requires', () => {
      const { definitions } = prepareSchema(
        build({
          ...collections,
          Item: { anyOf: [{ $ref: '#/definitions/Root' }, { $ref: '#/definitions/Divider' }] },
          Divider: { properties: { name: {}, divider: {} }, required: ['divider'] },
        }),
      );

      // Both collection branches require a `name`, which a divider may have too, so only `divider`
      // identifies anything
      expect(definitions.Item).toEqual({
        if: { required: ['divider'] },
        then: { $ref: '#/definitions/Divider' },
        else: { $ref: '#/definitions/Root' },
      });
    });

    test('gives up when more than one branch has no marker', () => {
      const { definitions } = prepareSchema(
        build({
          Root: { anyOf: [{ $ref: '#/definitions/A' }, { $ref: '#/definitions/B' }] },
          A: { properties: { name: {} }, required: ['name'] },
          B: { properties: { name: {} }, required: ['name'] },
        }),
      );

      expect(definitions.Root.anyOf).toHaveLength(2);
    });

    test('gives up when no branch has a marker', () => {
      const { definitions } = prepareSchema(
        build({
          Root: { anyOf: [{ $ref: '#/definitions/A' }, { $ref: '#/definitions/B' }] },
          A: { properties: { a: {} } },
          B: { properties: { b: {} } },
        }),
      );

      expect(definitions.Root.anyOf).toHaveLength(2);
    });

    test('gives up when a branch is not an object schema', () => {
      const { definitions } = prepareSchema(
        build({
          Root: { anyOf: [{ $ref: '#/definitions/A' }, { type: 'string' }] },
          A: { properties: { a: {} }, required: ['a'] },
        }),
      );

      expect(definitions.Root.anyOf).toHaveLength(2);
    });
  });

  describe('malformed references', () => {
    test('gives up on a circular reference', () => {
      const { definitions } = prepareSchema(
        build({
          Root: { anyOf: [{ $ref: '#/definitions/A' }, { $ref: '#/definitions/B' }] },
          A: { $ref: '#/definitions/A' },
          B: { properties: { b: {} }, required: ['b'] },
        }),
      );

      expect(definitions.Root.anyOf).toHaveLength(2);
    });

    test('gives up on a reference that doesn’t resolve', () => {
      const { definitions } = prepareSchema(
        build({
          Root: { anyOf: [{ $ref: '#/definitions/Missing' }, { $ref: '#/definitions/B' }] },
          B: { properties: { b: {} }, required: ['b'] },
        }),
      );

      expect(definitions.Root.anyOf).toHaveLength(2);
    });

    test('gives up on a union nested deeper than the limit', () => {
      /** @type {Record<string, any>} */
      const definitions = {
        Root: { anyOf: [{ $ref: '#/definitions/L0' }, { $ref: '#/definitions/Other' }] },
        Other: { properties: { other: {} }, required: ['other'] },
      };

      // Ten levels of nesting, which is deeper than the schema is ever expected to go
      Array.from({ length: 10 }).forEach((_item, index) => {
        definitions[`L${index}`] = { anyOf: [{ $ref: `#/definitions/L${index + 1}` }] };
      });

      definitions.L10 = { properties: { deep: {} }, required: ['deep'] };

      expect(prepareSchema(build(definitions)).definitions.Root.anyOf).toHaveLength(2);
    });
  });
});
