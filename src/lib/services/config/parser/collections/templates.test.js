import { beforeEach, describe, expect, test, vi } from 'vitest';

import { checkCollectionTemplates } from '$lib/services/config/parser/collections/templates';
import { addMessage } from '$lib/services/config/parser/utils/validator';

vi.mock('$lib/services/config/parser/utils/validator');

/** @type {any} */
const context = { collection: { name: 'posts' } };
/** @type {any} */
const collectors = { errors: new Set(), warnings: new Set() };

/** @type {any[]} */
const fields = [
  { name: 'title', widget: 'string' },
  { name: 'date', widget: 'datetime' },
  { name: 'category', widget: 'string' },
  { name: 'cover', widget: 'image' },
  { name: 'gallery', widget: 'list', fields: [{ name: 'src', widget: 'image' }] },
];

/**
 * Run the check on a folder collection with the given options.
 * @param {object} options Collection options.
 * @returns {void}
 */
const check = (options) =>
  checkCollectionTemplates({
    collection: /** @type {any} */ ({ name: 'posts', folder: 'content/posts', fields, ...options }),
    context,
    collectors,
  });

/**
 * Assert the options and names that were reported, in order.
 * @param {[string, string][]} pairs Expected option and name pairs.
 */
const expectReported = (pairs) => {
  expect(vi.mocked(addMessage).mock.calls.map(([args]) => args)).toEqual(
    pairs.map(([option, name]) => ({
      strKey: 'option_field_not_found',
      values: { option, name },
      context,
      collectors,
    })),
  );
};

describe('checkCollectionTemplates', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  test('says nothing without the options', () => {
    check({});
    expectReported([]);
  });

  test('says nothing when the collection has no fields, which is reported separately', () => {
    check({ fields: [], slug: '{{titel}}' });
    check({ fields: undefined, slug: '{{titel}}' });
    expectReported([]);
  });

  describe('slug and path', () => {
    test('accept fields and the special tags', () => {
      check({
        slug: '{{year}}-{{month}}-{{day}}-{{title}}-{{uuid_short}}',
        path: '{{category}}/{{slug}}/{{fields._slug}}/{{hour}}{{minute}}{{second}}/{{uuid}}',
      });

      expectReported([]);
    });

    test('accept the slug editor tag in both forms', () => {
      check({ slug: '{{_slug}}', path: '{{fields._slug | localize}}' });
      expectReported([]);
    });

    test('report tags that name no field', () => {
      check({ slug: '{{titel}}', path: '{{categories}}/{{slug}}' });
      expectReported([
        ['slug', 'titel'],
        ['path', 'categories'],
      ]);
    });

    test('treat a locale tag as a field, which it is not in a slug', () => {
      check({ slug: '{{locale}}-{{title}}' });
      expectReported([['slug', 'locale']]);
    });
  });

  describe('summary', () => {
    test('accepts fields and the special tags', () => {
      check({
        summary:
          '{{title}} {{fields.date | date("YYYY")}} {{slug}} {{locales}} {{dirname}} {{filename}} ' +
          '{{extension}} {{commit_date}} {{commit_author}}',
      });

      expectReported([]);
    });

    test('accepts the title tag without a title field, as it falls back to the entry summary', () => {
      check({
        fields: [{ name: 'name', widget: 'string' }],
        summary: '{{title}} {{fields.title}}',
      });
      expectReported([]);
    });

    test('reports tags that name no field', () => {
      check({ summary: '{{title}} by {{author}}' });
      expectReported([['summary', 'author']]);
    });
  });

  describe('thumbnail', () => {
    test('accepts a boolean', () => {
      check({ thumbnail: true });
      check({ thumbnail: false });
      expectReported([]);
    });

    test('accepts key paths that name fields', () => {
      check({ thumbnail: 'cover' });
      check({ thumbnail: ['cover', 'gallery.*.src'] });
      expectReported([]);
    });

    test('reports key paths that name no field', () => {
      check({ thumbnail: 'hero' });
      check({ thumbnail: ['cover', 'gallery.*.url'] });
      expectReported([
        ['thumbnail', 'hero'],
        ['thumbnail', 'gallery.*.url'],
      ]);
    });
  });
});
