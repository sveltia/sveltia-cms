import { beforeEach, describe, expect, test, vi } from 'vitest';

import { cmsConfig } from '$lib/services/config';
import { DEFAULT_I18N_CONFIG } from '$lib/services/contents/i18n/config';

import { createAssetNameTemplate, fillAssetNameTemplate, getPendingFileName } from './name';

/**
 * @import { EntryDraft, InternalEntryCollection } from '$lib/types/private';
 */

vi.mock('$lib/services/config', () => ({ cmsConfig: { current: undefined } }));
vi.mock('$lib/services/contents/collection/entries', () => ({
  getEntriesByCollection: vi.fn(() => []),
}));
vi.mock('$lib/services/contents/entry/fields', () => ({
  getField: vi.fn(() => undefined),
}));

/** @type {InternalEntryCollection} */
const collection = /** @type {any} */ ({
  name: 'posts',
  folder: 'content/posts',
  fields: [],
  _type: 'entry',
  _file: { extension: 'md', format: 'yaml-frontmatter', basePath: 'content/posts' },
  _i18n: DEFAULT_I18N_CONFIG,
  _thumbnailFieldNames: [],
});

const dateTimeParts = {
  year: '2026',
  month: '09',
  day: '29',
  hour: '08',
  minute: '05',
  second: '03',
};

/**
 * Create a template with fixed date/time parts.
 * @param {string} template Template.
 * @returns {import('$lib/types/private').AssetNameTemplate} Template.
 */
const createTemplate = (template) => ({ template, randomValues: new Map(), dateTimeParts });

beforeEach(() => {
  cmsConfig.current = /** @type {any} */ ({ slug: { encoding: 'unicode' } });
});

describe('createAssetNameTemplate()', () => {
  test('captures the current date and time in UTC by default', () => {
    vi.useFakeTimers({ now: new Date('2026-09-29T23:30:45Z') });

    const { template, randomValues, dateTimeParts: parts } = createAssetNameTemplate('{{year}}');

    expect(template).toBe('{{year}}');
    expect(randomValues).toBeInstanceOf(Map);
    expect(createAssetNameTemplate('{{year}}').slugificationEnabled).toBe(false);
    expect(
      createAssetNameTemplate('{{year}}', { slugificationEnabled: true }).slugificationEnabled,
    ).toBe(true);
    expect(randomValues.size).toBe(0);
    expect(parts).toMatchObject({ year: '2026', month: '09', day: '29', hour: '23' });

    vi.useRealTimers();
  });

  test('uses the local time zone if the slug option says so', () => {
    cmsConfig.current = /** @type {any} */ ({ slug: { timezone: 'local' } });

    const date = new Date('2026-09-29T23:30:45Z');

    vi.useFakeTimers({ now: date });

    expect(createAssetNameTemplate('{{hour}}').dateTimeParts.hour).toBe(
      String(date.getHours()).padStart(2, '0'),
    );

    vi.useRealTimers();
  });

  test('works without a site configuration', () => {
    cmsConfig.current = undefined;

    expect(createAssetNameTemplate('{{year}}').template).toBe('{{year}}');
  });
});

describe('fillAssetNameTemplate()', () => {
  test('fills the file name tags and appends the original extension', () => {
    expect(
      fillAssetNameTemplate({
        nameTemplate: createTemplate('{{year}}{{month}}{{day}}-{{filename}}-{{extension}}'),
        originalName: 'My Photo.JPG',
      }),
    ).toBe('20260929-my-photo-jpg.JPG');
  });

  test('handles a file without an extension', () => {
    expect(
      fillAssetNameTemplate({
        nameTemplate: createTemplate("{{filename}}-{{extension | default('none')}}"),
        originalName: 'README',
      }),
    ).toBe('readme-none');
  });

  test('fills the entry tags with the given slug and content', () => {
    expect(
      fillAssetNameTemplate({
        nameTemplate: createTemplate('{{slug}}_{{fields.title | upper}}_{{author}}'),
        originalName: 'IMG_1234.png',
        collection,
        content: { title: 'Hello World', author: 'Jane Doe' },
        slug: 'hello-world',
      }),
    ).toBe('hello-world_hello-world_jane-doe.png');
  });

  test('keeps the random values the same from one fill to the next', () => {
    const nameTemplate = createTemplate('{{uuid_short}}-{{fields.missing}}');
    const args = { nameTemplate, originalName: 'a.webp', collection, content: {} };
    const first = fillAssetNameTemplate(args);

    expect(first).toMatch(/^[0-9a-f]+-[0-9a-f]+\.webp$/);
    expect(fillAssetNameTemplate(args)).toBe(first);
    expect(nameTemplate.randomValues.size).toBe(2);
  });

  test('falls back to a random value for the entry tags without an entry', () => {
    expect(
      fillAssetNameTemplate({
        nameTemplate: createTemplate('{{slug}}'),
        originalName: 'a.png',
      }),
    ).toMatch(/^[0-9a-f]+\.png$/);
  });

  test('uses the identifier field for the slug if no slug is given', () => {
    expect(
      fillAssetNameTemplate({
        nameTemplate: createTemplate('{{slug}}'),
        originalName: 'a.png',
        collection: { ...collection, identifier_field: 'name' },
        content: { name: 'Summer Beach' },
      }),
    ).toBe('summer-beach.png');

    expect(
      fillAssetNameTemplate({
        nameTemplate: createTemplate('{{slug}}'),
        originalName: 'a.png',
        collection,
        content: { title: 'Summer Beach' },
      }),
    ).toBe('summer-beach.png');
  });
});

describe('getPendingFileName()', () => {
  const file = new File([''], 'IMG 1.png', { type: 'image/png' });

  const draft = /** @type {EntryDraft} */ (
    /** @type {any} */ ({
      collection,
      collectionName: 'posts',
      fileName: undefined,
      isIndexFile: false,
      defaultLocale: 'en',
      currentValues: { en: { title: 'Hello' }, fr: { title: 'Bonjour' } },
    })
  );

  test('returns the file’s own name without a template', () => {
    expect(
      getPendingFileName({
        draft,
        item: { file, folder: undefined, replace: false },
        defaultLocaleSlug: 'hello',
      }),
    ).toBe('IMG 1.png');
  });

  test('fills the template with the default locale’s slug and content', () => {
    expect(
      getPendingFileName({
        draft,
        item: {
          file,
          folder: undefined,
          replace: false,
          nameTemplate: createTemplate('{{slug}}-{{fields.title}}-{{filename}}'),
        },
        defaultLocaleSlug: 'hello-slug',
      }),
    ).toBe('hello-slug-hello-img-1.png');
  });

  test('sanitizes the filled name, and slugifies it if enabled', () => {
    /**
     * Get the name with the given template options.
     * @param {boolean} slugificationEnabled Whether to slugify the name.
     * @returns {string} Name.
     */
    const getName = (slugificationEnabled) =>
      getPendingFileName({
        draft,
        item: {
          file,
          folder: undefined,
          replace: false,
          nameTemplate: { ...createTemplate('Cover: {{slug}}'), slugificationEnabled },
        },
        defaultLocaleSlug: 'hello',
      });

    expect(getName(false)).toBe('Cover hello.png');
    expect(getName(true)).toBe('cover-hello.png');
  });
});
