import { beforeEach, describe, expect, test, vi } from 'vitest';

import { checkPreviewPath } from '$lib/services/config/parser/collections/preview';
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
const withDateField = /** @type {any} */ ([
  { name: 'title', widget: 'string' },
  { name: 'pubDate', widget: 'datetime' },
]);

/** @type {Field[]} */
const withoutDateField = /** @type {any} */ ([
  { name: 'title', widget: 'string' },
  { name: 'body', widget: 'markdown' },
]);

/**
 * Run the check with the given options.
 * @param {object} [args] Arguments to override.
 * @returns {void}
 */
const check = (args = {}) =>
  checkPreviewPath(
    /** @type {any} */ ({
      pathTemplate: '/blog/{{year}}/{{month}}/{{slug}}',
      dateFieldName: undefined,
      fields: withDateField,
      context,
      collectors,
      ...args,
    }),
  );

describe('checkPreviewPath', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  test('says nothing when a DateTime field is there to fill the tags in', () => {
    check();
    expect(addMessage).not.toHaveBeenCalled();
  });

  test('says nothing without a preview path', () => {
    check({ pathTemplate: undefined });
    expect(addMessage).not.toHaveBeenCalled();
  });

  /** @type {string[]} */
  const templatesWithoutDateTags = ['/blog/{{slug}}', '/{{locale}}/{{dirname}}/{{filename}}', '/'];

  test.each(templatesWithoutDateTags)('says nothing about %o, which needs no date', (template) => {
    check({ pathTemplate: template, fields: withoutDateField });
    expect(addMessage).not.toHaveBeenCalled();
  });

  /** @type {string[]} */
  const dateTags = ['year', 'month', 'day', 'hour', 'minute', 'second'];

  test.each(dateTags)('warns about a {{%s}} tag with no DateTime field', (tag) => {
    check({ pathTemplate: `/blog/{{${tag}}}/{{slug}}`, fields: withoutDateField });

    expect(addMessage).toHaveBeenCalledWith({
      type: 'warning',
      strKey: 'preview_path_no_date_field',
      values: { name: undefined },
      context,
      collectors,
    });
  });

  test('warns when the collection has no fields at all', () => {
    check({ fields: [] });

    expect(addMessage).toHaveBeenCalledWith(
      expect.objectContaining({ strKey: 'preview_path_no_date_field' }),
    );
  });

  describe('with preview_path_date_field', () => {
    test('says nothing when it names a DateTime field', () => {
      check({ dateFieldName: 'pubDate' });
      expect(addMessage).not.toHaveBeenCalled();
    });

    test('warns when it names a field that doesn’t exist', () => {
      check({ dateFieldName: 'date' });

      expect(addMessage).toHaveBeenCalledWith({
        type: 'warning',
        strKey: 'preview_path_date_field_not_found',
        values: { name: 'date' },
        context,
        collectors,
      });
    });

    test('warns when it names a field that isn’t a DateTime field', () => {
      // A String field holding a date string can’t be parsed with a DateTime field’s config
      check({ dateFieldName: 'title' });

      expect(addMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          strKey: 'preview_path_date_field_not_found',
          values: { name: 'title' },
        }),
      );
    });
  });

  // An unresolvable tag used to fill in a random ID, which changed the preview URL on every render
  // and spun the entry editor until Svelte killed the reactive graph
  // @see https://github.com/sveltia/sveltia-cms/issues/943
  describe('with a {{fields.*}} tag', () => {
    test('says nothing when the tag names a field', () => {
      check({ pathTemplate: 'blog/{{fields.title}}', fields: withoutDateField });
      expect(addMessage).not.toHaveBeenCalled();
    });

    test('warns when the tag names no field', () => {
      check({ pathTemplate: 'blog/{{fields.slug}}', fields: withoutDateField });

      expect(addMessage).toHaveBeenCalledWith({
        type: 'warning',
        strKey: 'preview_path_field_not_found',
        values: { name: 'fields.slug' },
        context,
        collectors,
      });
    });

    test('says nothing when a `default` transformation supplies a value', () => {
      check({
        pathTemplate: "blog/{{fields.slug | default('missing')}}",
        fields: withoutDateField,
      });

      expect(addMessage).not.toHaveBeenCalled();
    });

    test('resolves a nested key path', () => {
      const fields = /** @type {any} */ ([
        { name: 'author', widget: 'object', fields: [{ name: 'name', widget: 'string' }] },
      ]);

      check({ pathTemplate: 'blog/{{fields.author.name}}', fields });
      expect(addMessage).not.toHaveBeenCalled();

      check({ pathTemplate: 'blog/{{fields.author.email}}', fields });

      expect(addMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          strKey: 'preview_path_field_not_found',
          values: { name: 'fields.author.email' },
        }),
      );
    });

    test('leaves bare tags alone, since they may be special tags rather than fields', () => {
      // `{{slug}}` is the entry slug and `{{year}}` a date part; neither is a field
      check({ pathTemplate: 'blog/{{slug}}', fields: withoutDateField });
      expect(addMessage).not.toHaveBeenCalled();
    });
  });
});
