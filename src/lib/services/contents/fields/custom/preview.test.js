import { describe, expect, it, vi } from 'vitest';

import { buildPreviewProps } from './preview';

vi.mock('$lib/services/api/helpers', () => ({
  convertEntryToMap: vi.fn(({ entry, locale, collectionName, content }) => ({
    __mocked: true,
    content: content ?? entry?.locales?.[locale]?.content ?? {},
    path: entry?.locales?.[locale]?.path ?? '',
    collectionName,
    isNew: false,
  })),
  createEntryMap: vi.fn((args) => ({ ...args, __mocked: true })),
  createGetAsset: vi.fn(() => vi.fn()),
  getMetaData: vi.fn(() => ({ get: vi.fn(() => undefined) })),
  buildPreviewData: vi.fn(({ draft, locale }) => ({
    entryMap: {
      __mocked: true,
      content: draft?.originalEntry?.locales?.[locale]?.content ?? {},
      path: draft?.originalEntry?.locales?.[locale]?.path ?? '',
      collectionName: draft?.collectionName ?? '',
      isNew: false,
    },
    fieldsMetaData: { get: vi.fn(() => undefined) },
    getAsset: vi.fn(),
  })),
}));

describe('contents/fields/custom/preview-helpers', () => {
  it('returns undefined when the preview component or entry draft is missing', () => {
    expect(
      buildPreviewProps({
        preview: undefined,
        currentValue: 'value',
        fieldConfig: { widget: 'custom', name: 'title' },
        locale: 'en',
        draft: /** @type {any} */ ({ originalEntry: {} }),
      }),
    ).toBeUndefined();

    expect(
      buildPreviewProps({
        preview: vi.fn(),
        currentValue: 'value',
        fieldConfig: { widget: 'custom', name: 'title' },
        locale: 'en',
        draft: undefined,
      }),
    ).toBeUndefined();
  });

  it('builds preview props from the draft entry context', () => {
    const preview = vi.fn();

    /** @type {any} */
    const draft = {
      originalEntry: {
        slug: 'hello',
        locales: {
          en: { content: { title: 'Hello' }, path: 'content/hello.md' },
          fr: { content: { title: 'Bonjour' }, path: 'content/bonjour.md' },
        },
      },
      collectionName: 'posts',
      fileName: 'index.md',
      isIndexFile: false,
      currentValues: { en: { title: 'Hello' } },
      collectionFile: undefined,
      collection: { _i18n: { defaultLocale: 'en', allLocales: ['en', 'fr'] } },
    };

    const props = buildPreviewProps({
      preview,
      currentValue: 'value',
      fieldConfig: { widget: 'custom', name: 'title' },
      locale: 'en',
      draft,
    });

    expect(props).toBeDefined();
    expect(props?.value).toBe('value');
    expect(props?.field.get('widget')).toBe('custom');
    expect(props?.entry).toMatchObject({ __mocked: true });
    expect(props?.getAsset).toBeTypeOf('function');
    expect(props?.fieldsMetaData).toBeDefined();
  });

  it('uses fallback values when locale metadata and field details are missing', () => {
    const preview = vi.fn();

    /** @type {any} */
    const draft = {
      originalEntry: {
        slug: 'hello',
        locales: {
          _default: {},
        },
      },
      collectionName: 'posts',
      fileName: 'index.md',
      isIndexFile: false,
      currentValues: undefined,
      collectionFile: undefined,
      collection: undefined,
    };

    const props = buildPreviewProps({
      preview,
      currentValue: 'value',
      fieldConfig: { widget: 'custom', name: 'title' },
      locale: 'en',
      draft,
    });

    expect(props?.field.get('widget')).toBe('custom');
    expect(props?.entry).toMatchObject({
      content: {},
      path: '',
      collectionName: 'posts',
      isNew: false,
    });
    expect(props?.metadata).toBeDefined();
  });
});
