import { beforeEach, describe, expect, test, vi } from 'vitest';

import {
  checkFieldReferences,
  checkThumbnailField,
} from '$lib/services/config/parser/utils/references';
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

describe('checkThumbnailField', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  /** @type {Field[]} */
  const subfields = /** @type {any} */ ([
    { name: 'image', widget: 'image' },
    { name: 'document', widget: 'file' },
    { name: 'caption', widget: 'string' },
    { name: 'untyped' },
    { name: 'meta', widget: 'object', fields: [{ name: 'cover', widget: 'image' }] },
  ]);

  /**
   * Run the check with the given `thumbnail` option.
   * @param {any} thumbnail The option value.
   */
  const checkThumbnail = (thumbnail) => {
    checkThumbnailField({ thumbnail, fields: subfields, context, collectors });
  };

  /**
   * Assert the messages that were added, in order.
   * @param {object[]} messages Expected message properties.
   */
  const expectMessages = (messages) => {
    expect(vi.mocked(addMessage).mock.calls.map(([args]) => args)).toEqual(
      messages.map((message) => ({ context, collectors, ...message })),
    );
  };

  test('accepts an Image or File subfield, nested or prefixed', () => {
    checkThumbnail('image');
    checkThumbnail('document');
    checkThumbnail('meta.cover');
    checkThumbnail('fields.image');
    expectMessages([]);
  });

  test('skips a missing or wrongly typed option', () => {
    checkThumbnail(undefined);
    checkThumbnail('');
    checkThumbnail(true);
    checkThumbnail(['image']);
    expectMessages([]);
  });

  test('reports a subfield that is not defined, and nothing else about it', () => {
    checkThumbnail('photo');
    expectMessages([
      { strKey: 'option_field_not_found', values: { option: 'thumbnail', name: 'photo' } },
    ]);
  });

  test('accepts a name shared by the subfields of several types if any is a media field', () => {
    /** @type {Field[]} */
    const typedFields = /** @type {any} */ ([
      { name: 'src', widget: 'string' },
      { name: 'src', widget: 'image' },
    ]);

    checkThumbnailField({ thumbnail: 'src', fields: typedFields, context, collectors });
    expectMessages([]);
  });

  test('reports a name shared by the subfields of several types if none is a media field', () => {
    /** @type {Field[]} */
    const typedFields = /** @type {any} */ ([
      { name: 'src', widget: 'string' },
      { name: 'src', widget: 'number' },
    ]);

    checkThumbnailField({ thumbnail: 'src', fields: typedFields, context, collectors });
    expectMessages([
      { strKey: 'thumbnail_field_not_media', values: { name: 'src', widget: 'string' } },
    ]);
  });

  test('reports a subfield of another type', () => {
    checkThumbnail('caption');
    checkThumbnail('untyped');
    checkThumbnail('meta');
    expectMessages([
      { strKey: 'thumbnail_field_not_media', values: { name: 'caption', widget: 'string' } },
      { strKey: 'thumbnail_field_not_media', values: { name: 'untyped', widget: 'string' } },
      { strKey: 'thumbnail_field_not_media', values: { name: 'meta', widget: 'object' } },
    ]);
  });
});
