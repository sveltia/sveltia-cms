/* eslint-disable jsdoc/require-jsdoc */
import { get } from 'svelte/store';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { entryDraft } from '$lib/services/contents/draft';
import {
  collectComponentComputeFields,
  collectComputeFields,
  updateComputedValues,
} from '$lib/services/contents/draft/update/compute';
import { indexListItems } from '$lib/services/contents/entry/content-index';
import { getFieldDisplayValue } from '$lib/services/contents/entry/fields';
import { getComponentDef } from '$lib/services/contents/fields/rich-text/components/definitions';

vi.mock('$lib/services/contents/entry/fields', () => ({
  getFieldDisplayValue: vi.fn(({ valueMap, keyPath }) => valueMap[keyPath]),
}));
vi.mock('$lib/services/contents/fields/rich-text/components/definitions', () => ({
  getComponentDef: vi.fn(),
}));
vi.mock('$lib/services/user/prefs.svelte', () => ({
  prefs: { devModeEnabled: false },
}));

/** @type {any} */
const SLUG_FIELD = { name: 'slug', widget: 'compute', value: '{{index}}' };

/**
 * Collect the Compute fields in the given fields and content.
 * @param {any[]} fields Field list.
 * @param {Record<string, any>} valueMap Flattened entry content.
 * @returns {string[]} Key paths of the collected fields.
 */
const collect = (fields, valueMap) =>
  collectComputeFields({ fields, valueMap, getIndex: () => indexListItems(valueMap) }).map(
    ({ keyPath }) => keyPath,
  );

describe('collectComputeFields()', () => {
  test('should collect a root-level field', () => {
    expect(collect([{ name: 'title' }, SLUG_FIELD], {})).toEqual(['slug']);
  });

  test('should collect a field before it holds anything', () => {
    expect(collect([{ name: 'author', widget: 'object', fields: [SLUG_FIELD] }], {})).toEqual([
      'author.slug',
    ]);
  });

  test('should skip a collapsed optional Object field', () => {
    const fields = [{ name: 'author', widget: 'object', fields: [SLUG_FIELD] }];

    expect(collect(fields, { author: null })).toEqual([]);
  });

  test('should resolve the variable type of an Object field', () => {
    const fields = [
      {
        name: 'block',
        widget: 'object',
        types: [
          { name: 'text', fields: [{ name: 'body' }] },
          { name: 'card', fields: [SLUG_FIELD] },
        ],
      },
    ];

    expect(collect(fields, { 'block.type': 'card' })).toEqual(['block.slug']);
    expect(collect(fields, { 'block.type': 'text' })).toEqual([]);
    expect(collect(fields, {})).toEqual([]);
  });

  test('should collect one field per list item', () => {
    const fields = [{ name: 'authors', widget: 'list', fields: [{ name: 'name' }, SLUG_FIELD] }];

    const valueMap = {
      'authors.0.name': 'A',
      'authors.1.name': 'B',
      'authors.2.name': 'C',
    };

    expect(collect(fields, valueMap)).toEqual([
      'authors.0.slug',
      'authors.1.slug',
      'authors.2.slug',
    ]);
  });

  test('should collect a list item’s single sub-field at the item key path', () => {
    const fields = [{ name: 'slugs', widget: 'list', field: SLUG_FIELD }];

    expect(collect(fields, { 'slugs.0': '', 'slugs.1': '' })).toEqual(['slugs.0', 'slugs.1']);
  });

  test('should skip a simple list', () => {
    expect(collect([{ name: 'tags', widget: 'list' }], { 'tags.0': 'a' })).toEqual([]);
  });

  test('should resolve the variable type of each list item', () => {
    const fields = [
      {
        name: 'blocks',
        widget: 'list',
        types: [
          { name: 'text', fields: [{ name: 'body' }] },
          { name: 'card', fields: [SLUG_FIELD] },
        ],
      },
    ];

    const valueMap = { 'blocks.0.type': 'text', 'blocks.1.type': 'card' };

    expect(collect(fields, valueMap)).toEqual(['blocks.1.slug']);
  });

  test('should descend into a nested list', () => {
    const fields = [
      {
        name: 'sections',
        widget: 'list',
        fields: [{ name: 'authors', widget: 'list', fields: [SLUG_FIELD] }],
      },
    ];

    const valueMap = { 'sections.0.authors.0.slug': '', 'sections.0.authors.1.slug': '' };

    expect(collect(fields, valueMap)).toEqual([
      'sections.0.authors.0.slug',
      'sections.0.authors.1.slug',
    ]);
  });
});

describe('collectComponentComputeFields()', () => {
  test('should collect the fields of each component instance', () => {
    vi.mocked(getComponentDef).mockImplementation((/** @type {any} */ name) =>
      name === 'card'
        ? /** @type {any} */ ({ fields: [{ name: 'title' }, SLUG_FIELD] })
        : undefined,
    );

    const valueMap = {
      'body:c1:__sc_component_name': 'card',
      'body:c1:title': 'A',
      'body:c2:__sc_component_name': 'image',
      'body:c2:src': 'a.png',
      title: 'Not a component',
    };

    expect(
      collectComponentComputeFields(valueMap, () => indexListItems(valueMap)).map(
        ({ keyPath }) => keyPath,
      ),
    ).toEqual(['body:c1:slug']);
  });
});

describe('updateComputedValues()', () => {
  /** @type {any} */
  let draft;

  beforeEach(() => {
    vi.mocked(getComponentDef).mockReturnValue(undefined);

    draft = {
      collectionName: 'posts',
      collection: { _i18n: { i18nEnabled: false, defaultLocale: 'en' } },
      fields: [
        { name: 'title' },
        { name: 'slug', widget: 'compute', value: 'post-{{fields.title}}' },
      ],
      currentLocales: { en: true },
      currentValues: { en: { title: 'Hello', slug: '' } },
      extraValues: { en: {} },
    };

    entryDraft.set(draft);
  });

  test('should write the computed value and report the change', () => {
    expect(updateComputedValues()).toBe(true);
    expect(draft.currentValues.en.slug).toBe('post-Hello');
  });

  test('should skip an entry configured without a Compute field', () => {
    draft.fields = [
      { name: 'title' },
      { name: 'author', widget: 'object', fields: [{ name: 'name' }] },
      { name: 'tags', widget: 'list' },
      { name: 'slugs', widget: 'list', field: { name: 'slug' } },
      { name: 'blocks', widget: 'list', types: [{ name: 'text', fields: [{ name: 'body' }] }] },
    ];

    expect(updateComputedValues()).toBe(false);
    expect(draft.currentValues.en.slug).toBe('');
  });

  test('should find a Compute field nested in an Object field', () => {
    draft.fields = [{ name: 'author', widget: 'object', fields: [SLUG_FIELD] }];
    draft.currentValues.en = { 'author.name': 'Kohei' };

    expect(updateComputedValues()).toBe(true);
    expect(draft.currentValues.en['author.slug']).toBe('');
  });

  test('should settle on the second run', () => {
    updateComputedValues();

    expect(updateComputedValues()).toBe(false);
  });

  test('should notify the subscribers once a value has changed', () => {
    const subscriber = vi.fn();
    const unsubscribe = entryDraft.subscribe(subscriber);

    subscriber.mockClear();
    updateComputedValues();
    expect(subscriber).toHaveBeenCalledTimes(1);

    subscriber.mockClear();
    updateComputedValues();
    expect(subscriber).not.toHaveBeenCalled();

    unsubscribe();
  });

  test('should do nothing without a draft', () => {
    entryDraft.set(null);

    expect(updateComputedValues()).toBe(false);
  });

  test('should skip a disabled locale', () => {
    draft.currentLocales = { en: true, fr: false };
    draft.currentValues.fr = { title: 'Bonjour', slug: '' };

    updateComputedValues();

    expect(draft.currentValues.fr.slug).toBe('');
  });

  test('should skip a non-default locale when the field is not localized', () => {
    draft.collection._i18n = { i18nEnabled: true, defaultLocale: 'en' };
    draft.currentLocales = { en: true, fr: true };
    draft.currentValues.fr = { title: 'Bonjour', slug: '' };

    updateComputedValues();

    expect(draft.currentValues.en.slug).toBe('post-Hello');
    expect(draft.currentValues.fr.slug).toBe('');
  });

  test('should compute a localized field in every locale', () => {
    draft.collection._i18n = { i18nEnabled: true, defaultLocale: 'en' };
    draft.fields[1].i18n = 'translate';
    draft.currentLocales = { en: true, fr: true };
    draft.currentValues.fr = { title: 'Bonjour', slug: '' };

    updateComputedValues();

    expect(draft.currentValues.fr.slug).toBe('post-Bonjour');
  });

  test('should use the collection file’s i18n config when there is one', () => {
    draft.collectionFile = { _i18n: { i18nEnabled: true, defaultLocale: 'fr' } };
    draft.currentLocales = { en: true, fr: true };
    draft.currentValues.fr = { title: 'Bonjour', slug: '' };

    updateComputedValues();

    expect(draft.currentValues.en.slug).toBe('');
    expect(draft.currentValues.fr.slug).toBe('post-Bonjour');
  });

  test('should compute the fields of a rich text editor component in every locale', () => {
    vi.mocked(getComponentDef).mockReturnValue(
      /** @type {any} */ ({
        fields: [{ name: 'caption' }, { name: 'slug', widget: 'compute', value: '{{index}}' }],
      }),
    );

    draft.collection._i18n = { i18nEnabled: true, defaultLocale: 'en' };
    draft.currentLocales = { en: true, fr: true };
    draft.currentValues.fr = { title: 'Bonjour', slug: '' };
    draft.extraValues.fr = { 'body:c1:__sc_component_name': 'image', 'body:c1:caption': 'A' };

    updateComputedValues();

    expect(draft.extraValues.fr['body:c1:slug']).toBe('');
  });

  test('should follow the items of a list the editor isn’t rendering', () => {
    draft.fields = [{ name: 'items', widget: 'list', fields: [{ name: 'name' }, SLUG_FIELD] }];

    draft.currentValues.en = {
      'items.0.name': 'A',
      'items.1.name': 'B',
      'items.2.name': 'C',
    };

    updateComputedValues();

    expect(draft.currentValues.en['items.0.slug']).toBe(0);
    expect(draft.currentValues.en['items.1.slug']).toBe(1);
    expect(draft.currentValues.en['items.2.slug']).toBe(2);

    // Remove the first item the way the List field editor does, by shifting the rest down
    draft.currentValues.en = {
      'items.0.name': 'B',
      'items.0.slug': 0,
      'items.1.name': 'C',
      'items.1.slug': 1,
    };

    expect(updateComputedValues()).toBe(false);
    expect(Object.keys(draft.currentValues.en)).not.toContain('items.2.slug');
  });

  test('should keep the draft as the store value', () => {
    updateComputedValues();

    expect(get(entryDraft)).toBe(draft);
    expect(vi.mocked(getFieldDisplayValue)).toHaveBeenCalled();
  });
});
