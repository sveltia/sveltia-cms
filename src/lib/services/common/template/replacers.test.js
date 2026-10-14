import { beforeEach, describe, expect, test, vi } from 'vitest';

import { customStringTransformationRegistry } from '$lib/services/api/registries';
import { cmsConfig } from '$lib/services/config';
import { getField } from '$lib/services/contents/entry/fields';

import { replaceTemplatePlaceholder, replaceTemplateTag } from './replacers';

/**
 * @import { ReplaceContext, ReplaceSubContext } from './replacers';
 */

vi.mock('$lib/services/config', () => ({
  cmsConfig: { current: undefined },
}));
vi.mock('$lib/services/contents/entry/fields', () => ({
  getField: vi.fn(() => undefined),
}));

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const SHORT_ID_REGEX = /^[0-9a-f]{12}$/;

/**
 * Create a replacement context for `replaceTemplateTag()`.
 * @param {Partial<ReplaceSubContext>} [overrides] Values to override.
 * @returns {ReplaceSubContext} Context.
 */
const createSubContext = (overrides = {}) =>
  /** @type {ReplaceSubContext} */ ({
    collection: {
      name: 'posts',
      folder: 'content/posts',
      fields: [],
      _type: 'entry',
      _file: { extension: 'md', format: 'yaml-frontmatter', basePath: 'content/posts' },
    },
    content: {},
    locale: 'en',
    dateTimeParts: {
      year: '2026',
      month: '10',
      day: '09',
      hour: '08',
      minute: '07',
      second: '06',
    },
    identifierField: 'title',
    basePath: 'content/posts',
    ...overrides,
  });

/**
 * Create a replacement context for `replaceTemplatePlaceholder()`.
 * @param {Partial<ReplaceSubContext>} [overrides] Values to override in the sub-context.
 * @returns {ReplaceContext} Context.
 */
const createContext = (overrides = {}) => ({
  replaceSubContext: createSubContext(overrides),
  getFieldArgs: { collectionName: 'posts', keyPath: '', valueMap: {}, isIndexFile: false },
});

beforeEach(() => {
  cmsConfig.current = undefined;
});

describe('replaceTemplateTag()', () => {
  test('returns the date-time parts', () => {
    const context = createSubContext();

    expect(replaceTemplateTag('year', context)).toBe('2026');
    expect(replaceTemplateTag('month', context)).toBe('10');
    expect(replaceTemplateTag('day', context)).toBe('09');
    expect(replaceTemplateTag('hour', context)).toBe('08');
    expect(replaceTemplateTag('minute', context)).toBe('07');
    expect(replaceTemplateTag('second', context)).toBe('06');
  });

  test('prefers a date-time part to a field of the same name', () => {
    expect(replaceTemplateTag('year', createSubContext({ content: { year: '1999' } }))).toBe(
      '2026',
    );
  });

  test('falls through to the field value when no date-time parts are given', () => {
    expect(
      replaceTemplateTag(
        'year',
        createSubContext({ dateTimeParts: {}, content: { year: '1999' } }),
      ),
    ).toBe('1999');
  });

  test('does not take an `Object.prototype` member for a missing field value', () => {
    const context = createSubContext({ dateTimeParts: {}, content: { title: 'A' } });

    // `Object.prototype.toString` and `Object` were returned
    expect(replaceTemplateTag('toString', context)).toBeUndefined();
    expect(replaceTemplateTag('fields.constructor', context)).toBeUndefined();
    expect(
      replaceTemplateTag('constructor', createSubContext({ content: { constructor: 'Ada' } })),
    ).toBe('Ada');
  });

  test('returns the current slug for the `slug` tag', () => {
    expect(replaceTemplateTag('slug', createSubContext({ currentSlug: 'my-post' }))).toBe(
      'my-post',
    );
  });

  test('builds the slug from the identifier field without a current slug', () => {
    const context = createSubContext({
      identifierField: 'headline',
      content: { headline: 'Hello World', title: 'Ignored' },
    });

    expect(replaceTemplateTag('slug', context)).toBe('Hello World');
  });

  test('returns an empty slug for an index file in a preview path', () => {
    const context = createSubContext({
      type: 'preview_path',
      isIndexFile: true,
      currentSlug: '_index',
    });

    expect(replaceTemplateTag('slug', context)).toBe('');
  });

  test('generates the UUID tags', () => {
    const context = createSubContext();

    expect(replaceTemplateTag('uuid', context)).toMatch(UUID_REGEX);
    expect(replaceTemplateTag('uuid_short', context)).toMatch(SHORT_ID_REGEX);
    expect(replaceTemplateTag('uuid_shorter', context)).toMatch(/^[0-9a-f]{8}$/);
  });

  test('generates a new UUID on every call without a cache of random values', () => {
    const context = createSubContext();

    expect(replaceTemplateTag('uuid', context)).not.toBe(replaceTemplateTag('uuid', context));
  });

  test('reuses a UUID from the cache of random values, per locale and tag', () => {
    /** @type {Map<string, string>} */
    const randomValues = new Map();
    const en = createSubContext({ randomValues, locale: 'en' });
    const ja = createSubContext({ randomValues, locale: 'ja' });
    const uuid = replaceTemplateTag('uuid', en);

    expect(replaceTemplateTag('uuid', en)).toBe(uuid);
    expect(randomValues.get('en:uuid')).toBe(uuid);
    expect(replaceTemplateTag('uuid_short', en)).not.toBe(uuid);
    expect(replaceTemplateTag('uuid', ja)).not.toBe(uuid);
    expect([...randomValues.keys()]).toEqual(['en:uuid', 'en:uuid_short', 'ja:uuid']);
  });

  test('uses a value already in the cache of random values', () => {
    const randomValues = new Map([['en:uuid', 'cached-id']]);

    expect(replaceTemplateTag('uuid', createSubContext({ randomValues }))).toBe('cached-id');
  });

  test('returns the parts of the asset file name being named', () => {
    const context = createSubContext({
      assetFileName: 'photo.JPG',
      content: { filename: 'field', extension: 'field' },
    });

    expect(replaceTemplateTag('filename', context)).toBe('photo');
    expect(replaceTemplateTag('extension', context)).toBe('JPG');
  });

  test('returns an empty extension for an asset file name without one', () => {
    const context = createSubContext({ assetFileName: 'README' });

    expect(replaceTemplateTag('filename', context)).toBe('README');
    expect(replaceTemplateTag('extension', context)).toBe('');
  });

  test('treats other tags normally while naming an asset file', () => {
    const context = createSubContext({ assetFileName: 'photo.jpg', content: { title: 'Hi' } });

    expect(replaceTemplateTag('title', context)).toBe('Hi');
    expect(replaceTemplateTag('dirname', context)).toBeUndefined();
  });

  test('returns the locale in a preview path only', () => {
    const content = { locale: 'field-locale' };

    expect(
      replaceTemplateTag('locale', createSubContext({ type: 'preview_path', locale: 'fr' })),
    ).toBe('fr');
    expect(replaceTemplateTag('locale', createSubContext({ locale: 'fr', content }))).toBe(
      'field-locale',
    );
    expect(
      replaceTemplateTag(
        'locale',
        createSubContext({
          type: 'media_folder',
          locale: 'fr',
          content,
          entryFilePath: 'content/posts/a.md',
        }),
      ),
    ).toBeUndefined();
  });

  test('returns the file path tags in a preview path', () => {
    const context = createSubContext({
      type: 'preview_path',
      entryFilePath: 'content/posts/2026/my.post.md',
      content: { title: 'Hello' },
    });

    expect(replaceTemplateTag('dirname', context)).toBe('2026');
    expect(replaceTemplateTag('filename', context)).toBe('my.post');
    expect(replaceTemplateTag('extension', context)).toBe('md');
    expect(replaceTemplateTag('title', context)).toBe('Hello');
    expect(replaceTemplateTag('fields.title', context)).toBe('Hello');
  });

  test('removes the locale suffix from the file name with the `multiple_files` structure', () => {
    const collection = /** @type {any} */ ({
      ...createSubContext().collection,
      _i18n: { structureMap: { i18nMultiFile: true }, allLocales: ['en', 'ja'] },
    });

    const context = createSubContext({
      type: 'preview_path',
      collection,
      entryFilePath: 'content/posts/my-post.ja.md',
    });

    expect(replaceTemplateTag('filename', context)).toBe('my-post');
  });

  test('returns the file path tags in a media folder path, but no field values', () => {
    const context = createSubContext({
      type: 'media_folder',
      entryFilePath: 'content/posts/sub/my-post.md',
      content: { title: 'Hello' },
    });

    expect(replaceTemplateTag('dirname', context)).toBe('sub');
    expect(replaceTemplateTag('filename', context)).toBe('my-post');
    expect(replaceTemplateTag('extension', context)).toBe('md');
    expect(replaceTemplateTag('title', context)).toBeUndefined();
    expect(replaceTemplateTag('fields.title', context)).toBeUndefined();
  });

  test('resolves every non-special tag to an empty string without an entry file path', () => {
    const context = createSubContext({ type: 'preview_path', content: { title: 'Hello' } });

    expect(replaceTemplateTag('dirname', context)).toBe('');
    expect(replaceTemplateTag('title', context)).toBe('');
    expect(replaceTemplateTag('title', { ...context, type: 'media_folder' })).toBe('');
  });

  test('ignores the file path tags in a slug', () => {
    const context = createSubContext({
      entryFilePath: 'content/posts/sub/my-post.md',
      content: { dirname: 'field-dir' },
    });

    expect(replaceTemplateTag('dirname', context)).toBe('field-dir');
    expect(replaceTemplateTag('filename', context)).toBeUndefined();
  });

  test('returns field values, with or without the `fields.` prefix', () => {
    const context = createSubContext({
      content: { title: 'Hello', 'author.name': 'Jane', count: 3, draft: false },
    });

    expect(replaceTemplateTag('title', context)).toBe('Hello');
    expect(replaceTemplateTag('fields.title', context)).toBe('Hello');
    expect(replaceTemplateTag('author.name', context)).toBe('Jane');
    expect(replaceTemplateTag('fields.author.name', context)).toBe('Jane');
    expect(replaceTemplateTag('count', context)).toBe(3);
    expect(replaceTemplateTag('draft', context)).toBe(false);
    expect(replaceTemplateTag('missing', context)).toBeUndefined();
  });
});

describe('replaceTemplatePlaceholder()', () => {
  test('slugifies a field value for a slug', () => {
    const context = createContext({ content: { title: 'Hello World!' } });

    expect(replaceTemplatePlaceholder('title', context)).toBe('hello-world');
    expect(replaceTemplatePlaceholder('fields.title', context)).toBe('hello-world');
  });

  test('slugifies with the locale and without truncating the value', () => {
    cmsConfig.current = /** @type {any} */ ({ slug: { clean_accents: true, maxlength: 5 } });

    const context = createContext({ locale: 'de', content: { title: 'Grüße aus München' } });

    // The `de` locale turns `ü` into `ue` rather than `u`, and the length is limited later by
    // `fillTemplate()`, not here
    expect(replaceTemplatePlaceholder('title', context)).toBe('gruesse-aus-muenchen');
  });

  test('returns the value as is for a preview path or a media folder path', () => {
    const content = { title: 'Hello World' };
    const entryFilePath = 'content/posts/sub/my-post.md';

    expect(
      replaceTemplatePlaceholder('title', createContext({ type: 'preview_path', content })),
    ).toBe('');
    expect(
      replaceTemplatePlaceholder(
        'title',
        createContext({ type: 'preview_path', content, entryFilePath }),
      ),
    ).toBe('Hello World');
    expect(
      replaceTemplatePlaceholder(
        'dirname',
        createContext({ type: 'media_folder', content, entryFilePath }),
      ),
    ).toBe('sub');
  });

  test('converts a non-string value to a string', () => {
    const context = createContext({ content: { count: 42, draft: false } });

    expect(replaceTemplatePlaceholder('count', context)).toBe('42');
    expect(replaceTemplatePlaceholder('draft', context)).toBe('false');
  });

  test('removes path traversal segments before slugifying', () => {
    const content = { path: '../../etc/./passwd' };

    expect(replaceTemplatePlaceholder('path', createContext({ content }))).toBe('etc-passwd');
    expect(
      replaceTemplatePlaceholder(
        'path',
        createContext({ type: 'preview_path', content, entryFilePath: 'content/posts/a.md' }),
      ),
    ).toBe('etc/passwd');
  });

  test('falls back to a random ID for an unresolvable tag', () => {
    expect(replaceTemplatePlaceholder('missing', createContext())).toMatch(SHORT_ID_REGEX);
  });

  test('falls back to a random ID for an unresolvable tag in a media folder path', () => {
    const context = createContext({
      type: 'media_folder',
      content: { title: 'Hello' },
      entryFilePath: 'content/posts/a.md',
    });

    expect(replaceTemplatePlaceholder('title', context)).toMatch(SHORT_ID_REGEX);
  });

  test('reuses the random fallback ID from the cache, per locale and placeholder', () => {
    /** @type {Map<string, string>} */
    const randomValues = new Map();
    const context = createContext({ randomValues });
    const id = replaceTemplatePlaceholder('missing', context);

    expect(replaceTemplatePlaceholder('missing', context)).toBe(id);
    expect(randomValues.get('en:fallback:missing')).toBe(id);
    expect(replaceTemplatePlaceholder('other', context)).not.toBe(id);
    expect(
      replaceTemplatePlaceholder('missing', createContext({ randomValues, locale: 'ja' })),
    ).not.toBe(id);
  });

  test('throws for an unresolvable tag in a preview path', () => {
    const context = createContext({ type: 'preview_path', entryFilePath: 'content/posts/a.md' });

    expect(() => replaceTemplatePlaceholder('missing', context)).toThrow(
      'Unresolvable template tag in preview path: missing',
    );
  });

  describe('with a custom transformation for a missing value', () => {
    beforeEach(() => {
      customStringTransformationRegistry.clear();
      customStringTransformationRegistry.set('fallback', (value, { args: [fallback] }) =>
        value === undefined ? fallback : value,
      );
      customStringTransformationRegistry.set('nothing', () => '');
    });

    test('lets the transformation give the value, like `default`', () => {
      expect(replaceTemplatePlaceholder("missing | fallback('Untitled')", createContext())).toBe(
        'untitled',
      );
      expect(
        replaceTemplatePlaceholder(
          "missing | fallback('drafts/new')",
          createContext({ type: 'preview_path', entryFilePath: 'content/posts/a.md' }),
        ),
      ).toBe('drafts/new');
    });

    test('falls back to a random ID if the transformation gives nothing', () => {
      expect(replaceTemplatePlaceholder('missing | nothing', createContext())).toMatch(
        SHORT_ID_REGEX,
      );
      expect(() =>
        replaceTemplatePlaceholder(
          'missing | nothing',
          createContext({ type: 'preview_path', entryFilePath: 'content/posts/a.md' }),
        ),
      ).toThrow('Unresolvable template tag in preview path: missing');
    });

    test('keeps an empty `default` result as is, even with a custom transformation', () => {
      expect(
        replaceTemplatePlaceholder(
          "missing | nothing | default('{{empty}}')",
          createContext({
            type: 'preview_path',
            content: { empty: '' },
            entryFilePath: 'content/posts/a.md',
          }),
        ),
      ).toBe('');
    });

    test('falls back to a random ID for a transformation that is not registered', () => {
      expect(replaceTemplatePlaceholder("missing | unknown('a')", createContext())).toMatch(
        SHORT_ID_REGEX,
      );
    });
  });

  test('falls back to a random ID for a value that slugifies to nothing', () => {
    /** @type {Map<string, string>} */
    const randomValues = new Map();
    const context = createContext({ randomValues, content: { title: '', symbols: '!!!' } });
    const id = replaceTemplatePlaceholder('title', context);

    expect(id).toMatch(SHORT_ID_REGEX);
    expect(replaceTemplatePlaceholder('title', context)).toBe(id);
    expect(replaceTemplatePlaceholder('symbols', context)).toMatch(SHORT_ID_REGEX);
  });

  test('returns an empty value as is in a preview path', () => {
    const context = createContext({
      type: 'preview_path',
      content: { title: '' },
      entryFilePath: 'content/posts/a.md',
    });

    expect(replaceTemplatePlaceholder('title', context)).toBe('');
  });

  test('applies transformations, passing the field configuration and the locale', () => {
    const fieldConfig = { name: 'title', widget: 'string' };

    vi.mocked(getField).mockReturnValue(/** @type {any} */ (fieldConfig));

    const context = createContext({
      type: 'preview_path',
      locale: 'ja',
      content: { title: 'hello world' },
      entryFilePath: 'content/posts/a.md',
    });

    expect(replaceTemplatePlaceholder('fields.title | upper', context)).toBe('HELLO WORLD');
    expect(replaceTemplatePlaceholder('title | truncate(5)', context)).toBe('hello…');
    expect(getField).toHaveBeenCalledWith({
      collectionName: 'posts',
      keyPath: 'title',
      valueMap: {},
      isIndexFile: false,
    });
  });

  test('looks up no field configuration without transformations', () => {
    replaceTemplatePlaceholder('title', createContext({ content: { title: 'Hi' } }));

    expect(getField).not.toHaveBeenCalled();
  });

  test('formats a date with the `date` transformation and the field configuration', () => {
    vi.mocked(getField).mockReturnValue(
      /** @type {any} */ ({ name: 'date', widget: 'datetime', picker_utc: true }),
    );

    const context = createContext({
      type: 'preview_path',
      content: { date: '2026-01-02T23:30:00Z' },
      entryFilePath: 'content/posts/a.md',
    });

    expect(replaceTemplatePlaceholder("date | date('YYYY/MM/DD')", context)).toBe('2026/01/02');
  });

  test('uses the `default` transformation for an undefined or empty value', () => {
    const context = createContext({ content: { title: '', subtitle: 'Sub Title' } });

    expect(replaceTemplatePlaceholder("missing | default('Untitled')", context)).toBe('untitled');
    expect(replaceTemplatePlaceholder("title | default('Untitled')", context)).toBe('untitled');
    expect(replaceTemplatePlaceholder("subtitle | default('Untitled')", context)).toBe('sub-title');
  });

  test('uses the `default` transformation for an unresolvable tag in a preview path', () => {
    const context = createContext({ type: 'preview_path', entryFilePath: 'content/posts/a.md' });

    expect(replaceTemplatePlaceholder("missing | default('none')", context)).toBe('none');
  });

  test('resolves a nested template in the `default` transformation', () => {
    const context = createContext({ content: { title: '', backup: 'Backup Title' } });

    expect(replaceTemplatePlaceholder("title | default('{{backup}}')", context)).toBe(
      'backup-title',
    );
    expect(replaceTemplatePlaceholder("title | default('{{fields.backup}}')", context)).toBe(
      'backup-title',
    );
    expect(replaceTemplatePlaceholder("missing | default('{{backup}}')", context)).toBe(
      'backup-title',
    );
  });

  test('resolves a nested template to a random ID when its tag is missing too', () => {
    const context = createContext({ content: { title: '' } });

    expect(replaceTemplatePlaceholder("title | default('{{missing}}')", context)).toMatch(
      SHORT_ID_REGEX,
    );
  });

  test('resolves nested templates in the `ternary` transformation', () => {
    const content = { draft: true, published: false, a: 'Alpha', b: 'Beta' };
    const context = createContext({ content });

    expect(replaceTemplatePlaceholder("draft | ternary('{{a}}', '{{b}}')", context)).toBe('alpha');
    expect(replaceTemplatePlaceholder("published | ternary('{{a}}', '{{b}}')", context)).toBe(
      'beta',
    );
    expect(replaceTemplatePlaceholder("draft | ternary('Yes', 'No')", context)).toBe('yes');
  });

  test('resolves every template in the `default` transformation', () => {
    const context = createContext({ content: { title: '', a: 'A', b: 'B' } });

    expect(replaceTemplatePlaceholder("title | default('{{a}}-{{b}}')", context)).toBe('a-b');
    expect(replaceTemplatePlaceholder("missing | default('prefix-{{a}}')", context)).toBe(
      'prefix-a',
    );
  });

  test('falls back to a random ID when the templates in `default` resolve to nothing', () => {
    /** @type {Map<string, string>} */
    const randomValues = new Map();
    const placeholder = "title | default('{{a}}-{{b}}')";
    const context = createContext({ randomValues, content: { title: '' } });
    const id = replaceTemplatePlaceholder(placeholder, context);

    expect(id).toMatch(SHORT_ID_REGEX);
    expect(replaceTemplatePlaceholder(placeholder, context)).toBe(id);
    expect(randomValues.get(`en:fallback:${placeholder}`)).toBe(id);
  });

  test('ignores a complex nested `default` template when the value is there', () => {
    const context = createContext({ content: { title: 'Hello', a: 'A', b: 'B' } });

    expect(replaceTemplatePlaceholder("title | default('{{a}}-{{b}}')", context)).toBe('hello');
  });

  test('resolves several templates in the `default` transformation in a preview path', () => {
    const context = createContext({
      type: 'preview_path',
      content: { title: '', a: 'A', b: 'B' },
      entryFilePath: 'content/posts/a.md',
    });

    expect(replaceTemplatePlaceholder("title | default('{{a}}-{{b}}')", context)).toBe('A-B');
  });

  test('resolves every template in the `ternary` transformation', () => {
    const content = { draft: true, published: false, a: 'A', b: 'B' };

    const previewContext = createContext({
      type: 'preview_path',
      content,
      entryFilePath: 'content/posts/a.md',
    });

    expect(replaceTemplatePlaceholder("draft | ternary('{{a}}-{{b}}', 'No')", previewContext)).toBe(
      'A-B',
    );
    expect(
      replaceTemplatePlaceholder("published | ternary('Yes', '{{b}} {{a}}')", previewContext),
    ).toBe('B A');
    expect(
      replaceTemplatePlaceholder(
        "draft | ternary('{{a}}-{{b}}', 'No')",
        createContext({ content }),
      ),
    ).toBe('a-b');
  });

  test('applies `default` after a `ternary` with templates', () => {
    const context = createContext({ content: { draft: '' } });

    expect(
      replaceTemplatePlaceholder("draft | ternary('{{a}}-{{b}}', 'x') | default('y')", context),
    ).toBe('x');
  });
});
