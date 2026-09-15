import { beforeEach, describe, expect, test, vi } from 'vitest';

import { checkCollectionFilter } from '$lib/services/config/parser/collections/filter';
import { addMessage, checkRegex } from '$lib/services/config/parser/utils/validator';

vi.mock('$lib/services/config/parser/utils/validator');

/** @type {any} */
const context = { collection: { name: 'posts' } };
/** @type {any} */
const collectors = { errors: new Set(), warnings: new Set() };

/**
 * Run the check with the given `filter` option.
 * @param {any} filter The option value.
 * @param {any[]} [fields] Collection fields.
 * @param {object} [options] Options.
 * @param {any} [options.i18n] Site-level i18n options.
 * @param {any} [options.collectionI18n] Collection-level i18n options.
 * @returns {void}
 */
const check = (
  filter,
  fields = [{ name: 'title' }, { name: 'meta', fields: [{ name: 'type' }] }],
  { i18n = undefined, collectionI18n = undefined } = {},
) =>
  checkCollectionFilter({
    collection: /** @type {any} */ ({
      name: 'posts',
      folder: 'content/posts',
      fields,
      filter,
      i18n: collectionI18n,
    }),
    context: { ...context, cmsConfig: /** @type {any} */ ({ i18n }) },
    collectors,
  });

describe('checkCollectionFilter', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  test('says nothing without a filter, or with one of the wrong type', () => {
    check(undefined);
    check('title');
    expect(addMessage).not.toHaveBeenCalled();
    expect(checkRegex).not.toHaveBeenCalled();
  });

  test('accepts a filter on a defined field with a value', () => {
    check({ field: 'title', value: 'Hello' });
    check({ field: 'meta.type', value: ['post', 'page'] });
    check({ field: 'title', value: null });
    expect(addMessage).not.toHaveBeenCalled();
  });

  test('accepts a filter on a defined field with a pattern, and checks the pattern', () => {
    check({ field: 'title', pattern: '^Hello' });

    expect(addMessage).not.toHaveBeenCalled();
    expect(checkRegex).toHaveBeenCalledExactlyOnceWith({
      option: 'filter',
      pattern: '^Hello',
      context: expect.objectContaining(context),
      collectors,
    });
  });

  test('accepts a metadata key, which is read from the entry rather than its fields', () => {
    check({ field: 'slug', pattern: '^2024-' });
    check({ field: 'commit_author', value: 'alice' });
    check({ field: 'commit_date', pattern: '^2024' });
    expect(addMessage).not.toHaveBeenCalled();
  });

  test('accepts the canonical slug key, which is part of the content without being a field', () => {
    const i18n = { locales: ['en', 'fr'] };

    check({ field: 'translationKey', value: 'hello' }, undefined, { i18n, collectionI18n: true });

    check({ field: 'translation_id', pattern: '^post-' }, undefined, {
      i18n: { ...i18n, canonical_slug: { key: 'translation_id' } },
      collectionI18n: true,
    });

    check({ field: 'translation_id', pattern: '^post-' }, undefined, {
      i18n,
      collectionI18n: { canonical_slug: { key: 'translation_id' } },
    });

    expect(addMessage).not.toHaveBeenCalled();
  });

  test('reports the canonical slug key when i18n is not enabled for the collection', () => {
    const i18n = { locales: ['en', 'fr'] };

    check({ field: 'translationKey', value: 'hello' });
    check({ field: 'translationKey', value: 'hello' }, undefined, { i18n });
    check({ field: 'translationKey', value: 'hello' }, undefined, { i18n, collectionI18n: false });

    check({ field: 'translationKey', value: 'hello' }, undefined, {
      i18n: { ...i18n, canonical_slug: { key: 'translation_id' } },
      collectionI18n: true,
    });

    expect(addMessage).toHaveBeenCalledTimes(4);

    expect(addMessage).toHaveBeenLastCalledWith({
      strKey: 'invalid_filter_field',
      values: { name: 'translationKey' },
      context: expect.objectContaining(context),
      collectors,
    });
  });

  test('reports a field that is not defined', () => {
    check({ field: 'category', value: 'news' });

    expect(addMessage).toHaveBeenCalledExactlyOnceWith({
      strKey: 'invalid_filter_field',
      values: { name: 'category' },
      context: expect.objectContaining(context),
      collectors,
    });
  });

  test('reports a filter with neither a value nor a pattern', () => {
    check({ field: 'title' });

    expect(addMessage).toHaveBeenCalledExactlyOnceWith({
      strKey: 'invalid_filter_no_condition',
      context: expect.objectContaining(context),
      collectors,
    });
  });

  test('reports both problems of one filter', () => {
    check({ field: 'category' });
    expect(addMessage).toHaveBeenCalledTimes(2);
  });

  test('leaves a field of the wrong type to the schema', () => {
    check({ field: 1, value: 'x' });
    check({ field: '', value: 'x' });
    expect(addMessage).not.toHaveBeenCalled();
  });

  test('leaves the field alone when the collection has no fields, which is reported separately', () => {
    check({ field: 'title', value: 'x' }, []);
    check({ field: 'title', value: 'x' }, undefined);
    expect(addMessage).not.toHaveBeenCalled();
  });
});
