import { beforeEach, describe, expect, it, vi } from 'vitest';

import { cmsConfig } from '$lib/services/config/state';
import { resolveLibraryOptions } from '$lib/services/integrations/media-libraries/options';

import { fillLibraryPrefix } from './prefix';

vi.mock('$lib/services/contents/draft/slugs', () => ({
  getFillSlugOptions: vi.fn(({ draft }) => ({
    collection: draft.collection,
    content: draft.currentValues.en,
    locale: 'en',
    dateTimeParts: { year: '2026' },
    randomValues: new Map(),
  })),
}));

/**
 * Create an entry draft with the given values.
 * @param {Record<string, any>} en Values in the default locale.
 * @param {Record<string, any>} [fr] Values in another locale.
 * @returns {any} Draft.
 */
const createDraft = (en, fr = {}) => ({
  collection: { _type: 'entry', name: 'posts', _i18n: { defaultLocale: 'en' } },
  currentValues: { en, fr },
  isIndexFile: false,
});

/**
 * Create a field with the given prefix.
 * @param {string} [prefix] The `prefix` option.
 * @returns {any} Field configuration.
 */
const createField = (prefix) => ({
  name: 'audio',
  widget: 'file',
  media_libraries: { aws_s3: { bucket: 'field-bucket', prefix } },
});

/**
 * Fill the prefix of the given field.
 * @param {string} prefix The `prefix` option.
 * @param {any} draft Draft.
 * @param {string} [locale] Locale.
 * @returns {string | undefined} Filled prefix, or `undefined` if it’s unresolved.
 */
const getPrefix = (prefix, draft, locale) => {
  const { fieldConfig, unresolved } = fillLibraryPrefix({
    serviceId: 'aws_s3',
    fieldConfig: createField(prefix),
    draft,
    locale,
  });

  return unresolved ? undefined : /** @type {any} */ (fieldConfig).media_libraries.aws_s3.prefix;
};

describe('assets/external/prefix', () => {
  beforeEach(() => {
    cmsConfig.current = undefined;
  });

  it('should fill a field tag, keeping the rest of the prefix', () => {
    expect(getPrefix('{{fields.release}}/', createDraft({ release: 12 }))).toBe('12/');
    expect(getPrefix('audio/{{release}}/raw/', createDraft({ release: 0 }))).toBe('audio/0/raw/');
  });

  it('should reach a nested field, and fill the date tags', () => {
    expect(getPrefix('{{fields.meta.no}}/', createDraft({ 'meta.no': 'a' }))).toBe('a/');
    expect(getPrefix('{{year}}/', createDraft({}))).toBe('2026/');
  });

  it('should fill the slug of the entry', () => {
    const draft = createDraft({ title: 'Hello' });

    expect(getPrefix('{{slug}}/', { ...draft, originalEntry: { slug: 'first-post' } })).toBe(
      'first-post/',
    );
    expect(
      getPrefix('{{slug}}/', {
        ...createDraft({ title: 'Hello', _slug: 'typed' }),
        originalEntry: { slug: 'first-post' },
      }),
    ).toBe('typed/');
  });

  it('should fill the fields of a singleton or a file collection', () => {
    const draft = createDraft({ release: 12 });

    expect(
      getPrefix('{{fields.release}}/', {
        ...draft,
        collection: { ...draft.collection, _type: 'singleton' },
        fileName: 'settings',
      }),
    ).toBe('12/');
  });

  it('should support the transformations', () => {
    expect(getPrefix("{{fields.no | default('none')}}/", createDraft({}))).toBe('none/');
  });

  it('should keep a value from adding path segments or leaving the prefix', () => {
    expect(getPrefix('a/{{fields.t}}/', createDraft({ t: 'Episode 1/Part 2' }))).toBe(
      'a/episode-1-part-2/',
    );
    expect(getPrefix('a/{{fields.t}}/', createDraft({ t: '../../secret' }))).toBe('a/secret/');
  });

  it('should prefer the value of the locale, then the default locale', () => {
    const draft = createDraft({ title: 'hello', release: 3 }, { title: 'bonjour' });

    expect(getPrefix('{{fields.title}}/{{fields.release}}/', draft, 'fr')).toBe('bonjour/3/');
    expect(getPrefix('{{fields.title}}/', draft)).toBe('hello/');
  });

  it.each([
    ['missing', {}],
    ['empty', { release: '' }],
    ['null', { release: null }],
    ['only made of path segments', { release: '..' }],
  ])('should leave a prefix unresolved when the value is %s', (_name, values) => {
    const fieldConfig = createField('{{fields.release}}/');

    expect(
      fillLibraryPrefix({ serviceId: 'aws_s3', fieldConfig, draft: createDraft(values) }),
    ).toEqual({ fieldConfig, unresolved: true });
  });

  it('should leave a template unresolved without a draft', () => {
    const fieldConfig = createField('{{fields.release}}/');

    expect(fillLibraryPrefix({ serviceId: 'aws_s3', fieldConfig })).toEqual({
      fieldConfig,
      unresolved: true,
    });
  });

  it('should return the same field config without a template', () => {
    const draft = createDraft({ release: 12 });

    [
      createField('uploads/'),
      createField(),
      { name: 'audio', media_libraries: { aws_s3: false } },
      { name: 'audio' },
      undefined,
    ].forEach((field) => {
      const fieldConfig = /** @type {any} */ (field);

      expect(fillLibraryPrefix({ serviceId: 'aws_s3', fieldConfig, draft })).toEqual({
        fieldConfig,
        unresolved: false,
      });
    });
  });

  it('should fill a legacy `media_library` option', () => {
    const fieldConfig = /** @type {any} */ ({
      name: 'audio',
      media_library: { name: 'aws_s3', prefix: '{{fields.release}}/' },
    });

    const filled = fillLibraryPrefix({
      serviceId: 'aws_s3',
      fieldConfig,
      draft: createDraft({ release: 12 }),
    });

    expect(/** @type {any} */ (filled.fieldConfig).media_libraries.aws_s3.prefix).toBe('12/');
  });

  it('should not touch the original field config', () => {
    const fieldConfig = createField('{{fields.release}}/');

    fillLibraryPrefix({ serviceId: 'aws_s3', fieldConfig, draft: createDraft({ release: 12 }) });

    expect(fieldConfig.media_libraries.aws_s3.prefix).toBe('{{fields.release}}/');
  });

  it('should override the site-level prefix, and keep the other options', () => {
    cmsConfig.current = /** @type {any} */ ({
      media_libraries: { aws_s3: { bucket: 'site-bucket', region: 'garage', prefix: 'site/' } },
    });

    const { fieldConfig } = fillLibraryPrefix({
      serviceId: 'aws_s3',
      fieldConfig: createField('{{fields.release}}/'),
      draft: createDraft({ release: 12 }),
    });

    expect(resolveLibraryOptions('aws_s3', fieldConfig)).toEqual({
      bucket: 'field-bucket',
      region: 'garage',
      prefix: '12/',
    });
  });
});
