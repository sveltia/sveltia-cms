import { beforeEach, describe, expect, test, vi } from 'vitest';

import { checkFieldReferences } from '$lib/services/config/parser/utils/references';
import { addMessage } from '$lib/services/config/parser/utils/validator';

vi.mock('$lib/services/config/parser/utils/validator');

/**
 * @import { Field } from '$lib/types/public';
 */

/** @type {any} */
const context = { collection: { name: 'posts' } };
/** @type {any} */
const collectors = { errors: new Set(), warnings: new Set() };

/** @type {Field[]} */
const fields = /** @type {any} */ ([
  { name: 'title', widget: 'string' },
  { name: 'date', widget: 'datetime' },
  { name: 'author', widget: 'object', fields: [{ name: 'name', widget: 'string' }] },
  { name: 'images', widget: 'list', fields: [{ name: 'src', widget: 'image' }] },
]);

/**
 * Run the check with the given options.
 * @param {object} args Arguments to override.
 * @returns {void}
 */
const check = (args) =>
  checkFieldReferences(
    /** @type {any} */ ({ option: 'slug', fields, context, collectors, ...args }),
  );

/**
 * Assert the names that were reported, in order.
 * @param {string[]} names Expected names.
 */
const expectReported = (names) => {
  expect(vi.mocked(addMessage).mock.calls.map(([args]) => args)).toEqual(
    names.map((name) => ({
      strKey: 'option_field_not_found',
      values: { option: 'slug', name },
      context,
      collectors,
    })),
  );
};

describe('checkFieldReferences', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('with a template', () => {
    test('accepts tags that name fields, with or without the prefix', () => {
      check({ template: '{{title}}-{{fields.date}}-{{author.name}}-{{images.*.src}}' });
      expectReported([]);
    });

    test('reports each tag that names no field', () => {
      check({ template: '{{titel}}/{{fields.slug}}/{{author.email}}' });
      expectReported(['titel', 'fields.slug', 'author.email']);
    });

    test('checks the tag name in front of a transformation', () => {
      check({ template: '{{date | date("YYYY")}}-{{titel | truncate(20)}}' });
      expectReported(['titel']);
    });

    test('skips a tag with a default transformation', () => {
      check({ template: '{{titel | default("untitled")}}' });
      expectReported([]);
    });

    test('skips the special tags, but not their prefixed forms', () => {
      check({ template: '{{slug}}-{{year}}-{{fields.slug}}', specialTags: ['slug', 'year'] });
      expectReported(['fields.slug']);
    });

    test('skips a special tag listed in its prefixed form', () => {
      check({ template: '{{fields._slug}}', specialTags: ['fields._slug'] });
      expectReported([]);
    });

    test('checks only the prefixed tags when asked to', () => {
      check({ template: '{{index}}-{{fields.slug}}-{{titel}}', prefixedOnly: true });
      expectReported(['fields.slug']);
    });

    test('says nothing without tags, or with a template of the wrong type', () => {
      check({ template: 'static' });
      check({ template: undefined });
      check({ template: 1 });
      expectReported([]);
    });
  });

  describe('with key paths', () => {
    test('accepts a single key path that names a field', () => {
      check({ keyPaths: 'images.*.src' });
      expectReported([]);
    });

    test('reports each key path that names no field', () => {
      check({ keyPaths: ['title', 'cover', 'fields.author.photo'] });
      expectReported(['cover', 'fields.author.photo']);
    });

    test('skips key paths of the wrong type', () => {
      check({ keyPaths: ['', 1, null, undefined] });
      check({ keyPaths: undefined });
      expectReported([]);
    });
  });
});
