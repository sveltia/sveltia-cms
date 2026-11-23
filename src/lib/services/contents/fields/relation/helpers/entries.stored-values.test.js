import { beforeEach, describe, expect, test, vi } from 'vitest';

import { getField } from '$lib/services/contents/entry/fields';
import { processEntry } from '$lib/services/contents/fields/relation/helpers/entries';
import { prepareFieldTemplates } from '$lib/services/contents/fields/relation/helpers/templates';

/**
 * @import { Entry, InternalCollection } from '$lib/types/private';
 * @import { Field } from '$lib/types/public';
 */

// Unlike `entries.test.js`, these tests run the real `getFieldDisplayValue()`, which formats the
// values of the referenced entry’s fields, so they can tell the stored value from the display value
vi.mock('$lib/services/contents/entry/fields', async (importOriginal) => ({
  ...(await importOriginal()),
  getField: vi.fn(),
}));

/** @type {Record<string, Field>} */
const fieldMap = {
  title: { name: 'title', widget: 'string' },
  sku: { name: 'sku', widget: 'number' },
  cat: {
    name: 'cat',
    widget: 'select',
    options: [
      { label: 'Books', value: 'b' },
      { label: 'Music', value: 'm' },
    ],
  },
  date: { name: 'date', widget: 'datetime' },
  count: { name: 'count', widget: 'number' },
  featured: { name: 'featured', widget: 'boolean' },
};

const collection = /** @type {InternalCollection} */ (
  /** @type {unknown} */ ({
    name: 'products',
    folder: 'content/products',
    fields: Object.values(fieldMap),
    _type: 'entry',
    _i18n: { defaultLocale: 'en', i18nEnabled: true, allLocales: ['en', 'fr'] },
  })
);

/**
 * Create a referenced entry.
 * @param {Record<string, any>} content Content of the `en` locale.
 * @param {Record<string, any>} [frContent] Content of the `fr` locale.
 * @returns {Entry} Entry.
 */
const createEntry = (content, frContent) => ({
  id: 'products/item',
  slug: 'item',
  subPath: 'item',
  locales: {
    en: { slug: 'item', path: 'content/products/en/item.md', content },
    ...(frContent
      ? { fr: { slug: 'item', path: 'content/products/fr/item.md', content: frContent } }
      : {}),
  },
});

/**
 * Get the options of a Relation field referring to the given entry.
 * @param {object} args Arguments.
 * @param {string} args.valueField `value_field` option.
 * @param {string[]} [args.displayFields] `display_fields` option.
 * @param {Entry} args.entry Referenced entry.
 * @param {string} [args.locale] Locale.
 * @returns {import('$lib/types/private').RelationOption[]} Options.
 */
const getOptions = ({ valueField, displayFields = [valueField], entry, locale = 'en' }) =>
  processEntry({
    refEntry: entry,
    content: entry.locales[locale]?.content ?? {},
    collection,
    templates: prepareFieldTemplates(
      {
        name: 'product',
        widget: 'relation',
        collection: 'products',
        value_field: valueField,
        display_fields: displayFields,
      },
      'title',
    ),
    locale,
    identifierField: 'title',
  });

describe('Test processEntry() with stored and display values', () => {
  beforeEach(() => {
    vi.mocked(getField).mockImplementation(({ keyPath }) => fieldMap[keyPath]);
  });

  test('stores a Number field value without formatting it', () => {
    const [option] = getOptions({ valueField: 'sku', entry: createEntry({ sku: 123456 }) });

    expect(option.value).toBe('123456');
    expect(option.label).toBe('123,456');
    expect(option.searchValue).toBe('123,456');
  });

  test('stores the value of a Select field option, not its label', () => {
    const [option] = getOptions({ valueField: 'cat', entry: createEntry({ cat: 'b' }) });

    expect(option.value).toBe('b');
    expect(option.label).toBe('Books');
  });

  test('stores a DateTime field value in its stored format', () => {
    const [option] = getOptions({
      valueField: 'date',
      entry: createEntry({ date: '2024-01-02T10:00:00.000Z' }),
    });

    expect(option.value).toBe('2024-01-02T10:00:00.000Z');
    expect(option.label).not.toBe(option.value);
  });

  test('stores the values in a template, with display values in the label', () => {
    const [option] = getOptions({
      valueField: '{{cat}}-{{sku}}',
      displayFields: ['{{title}} ({{cat}})'],
      entry: createEntry({ title: 'Novel', cat: 'b', sku: 1000 }),
    });

    expect(option.value).toBe('b-1000');
    expect(option.label).toBe('Novel (Books)');
  });

  test('keeps a `0` or `false` value, which is not empty', () => {
    expect(getOptions({ valueField: 'count', entry: createEntry({ count: 0 }) })).toEqual([
      { label: '0', value: '0', searchValue: '0' },
    ]);

    expect(
      getOptions({
        valueField: 'featured',
        displayFields: ['title'],
        entry: createEntry({ title: 'Novel', featured: false }),
      }),
    ).toEqual([{ label: 'Novel', value: 'false', searchValue: 'Novel' }]);
  });

  test('leaves out an option whose value is empty', () => {
    expect(getOptions({ valueField: 'sku', entry: createEntry({ sku: null }) })).toEqual([]);
    expect(getOptions({ valueField: 'sku', entry: createEntry({ title: 'Novel' }) })).toEqual([]);
  });

  test('falls back to the stored value in the default locale', () => {
    const entry = createEntry({ sku: 123456, cat: 'b' }, { title: 'Roman' });
    const [option] = getOptions({ valueField: '{{cat}}/{{sku}}', entry, locale: 'fr' });

    expect(option.value).toBe('b/123456');
  });

  test('stores the stored values of non-list fields in a list item option', () => {
    const [first, second] = getOptions({
      valueField: '{{sku}}#{{tags.*}}',
      displayFields: ['{{tags.*}}'],
      entry: createEntry({ sku: 123456, 'tags.0': 'a', 'tags.1': 'b' }),
    });

    expect(first.value).toBe('123456#a');
    expect(second.value).toBe('123456#b');
  });
});
