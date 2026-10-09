import { describe, expect, test } from 'vitest';

import {
  canOmitLocalePlaceholder,
  fillLocalePlaceholder,
  getLocaleFolderPattern,
  hasLocalePlaceholder,
  isValidLocaleFolderPath,
  LOCALE_PLACEHOLDER,
  omitLocalePlaceholder,
  stripLocaleFolderPath,
} from '$lib/services/contents/i18n/placeholder';

describe('Test hasLocalePlaceholder()', () => {
  test('detects the placeholder anywhere in the path', () => {
    expect(hasLocalePlaceholder('content/{{locale}}/posts')).toBe(true);
    expect(hasLocalePlaceholder('{{locale}}/posts')).toBe(true);
    expect(hasLocalePlaceholder('content/{{locale}}')).toBe(true);
    expect(hasLocalePlaceholder(LOCALE_PLACEHOLDER)).toBe(true);
    expect(hasLocalePlaceholder('data/home.{{locale}}.json')).toBe(true);
  });

  test('returns false without the placeholder', () => {
    expect(hasLocalePlaceholder('content/posts')).toBe(false);
    expect(hasLocalePlaceholder('content/{{slug}}')).toBe(false);
    expect(hasLocalePlaceholder('')).toBe(false);
  });
});

describe('Test isValidLocaleFolderPath()', () => {
  test('accepts a single placeholder as a whole folder name', () => {
    expect(isValidLocaleFolderPath('content/{{locale}}/posts')).toBe(true);
    expect(isValidLocaleFolderPath('{{locale}}/posts')).toBe(true);
    expect(isValidLocaleFolderPath('content/{{locale}}')).toBe(true);
    expect(isValidLocaleFolderPath('{{locale}}')).toBe(true);
  });

  test('rejects a placeholder that shares a folder name with other characters', () => {
    expect(isValidLocaleFolderPath('content-{{locale}}/posts')).toBe(false);
    expect(isValidLocaleFolderPath('content/{{locale}}-site/posts')).toBe(false);
    expect(isValidLocaleFolderPath('content/{{locale}}.d/posts')).toBe(false);
  });

  test('rejects more than one placeholder', () => {
    expect(isValidLocaleFolderPath('{{locale}}/content/{{locale}}/posts')).toBe(false);
  });

  test('rejects a path without the placeholder', () => {
    expect(isValidLocaleFolderPath('content/posts')).toBe(false);
  });
});

describe('Test fillLocalePlaceholder()', () => {
  test('replaces the placeholder with the locale', () => {
    expect(fillLocalePlaceholder({ path: 'content/{{locale}}/posts', locale: 'en' })).toBe(
      'content/en/posts',
    );
    expect(fillLocalePlaceholder({ path: '{{locale}}/posts', locale: 'fr' })).toBe('fr/posts');
    expect(fillLocalePlaceholder({ path: 'content/{{locale}}', locale: 'de' })).toBe('content/de');
    expect(fillLocalePlaceholder({ path: '{{locale}}', locale: 'de' })).toBe('de');
  });

  test('replaces every occurrence of the placeholder', () => {
    expect(
      fillLocalePlaceholder({ path: 'content/{{locale}}/{{locale}}.yaml', locale: 'ja' }),
    ).toBe('content/ja/ja.yaml');
  });

  test('leaves a path without the placeholder as is', () => {
    expect(fillLocalePlaceholder({ path: 'content/posts', locale: 'en' })).toBe('content/posts');
  });

  test('drops the placeholder folder when the locale is omitted', () => {
    const omitLocale = true;

    expect(
      fillLocalePlaceholder({ path: 'content/{{locale}}/posts', locale: 'en', omitLocale }),
    ).toBe('content/posts');
    expect(fillLocalePlaceholder({ path: '{{locale}}/posts', locale: 'en', omitLocale })).toBe(
      'posts',
    );
    expect(fillLocalePlaceholder({ path: 'content/{{locale}}', locale: 'en', omitLocale })).toBe(
      'content',
    );
    expect(fillLocalePlaceholder({ path: '{{locale}}', locale: 'en', omitLocale })).toBe('');
  });

  test('drops the placeholder from a file name when the locale is omitted', () => {
    const omitLocale = true;

    expect(
      fillLocalePlaceholder({ path: 'data/home.{{locale}}.json', locale: 'en', omitLocale }),
    ).toBe('data/home.json');
    // Only the first occurrence is dropped; any other is filled in
    expect(
      fillLocalePlaceholder({ path: '{{locale}}/{{locale}}.yaml', locale: 'en', omitLocale }),
    ).toBe('en.yaml');
  });

  test('fills in the placeholder it can’t drop when the locale is omitted', () => {
    const omitLocale = true;

    expect(fillLocalePlaceholder({ path: 'i18n/{{locale}}.yaml', locale: 'en', omitLocale })).toBe(
      'i18n/en.yaml',
    );
    expect(
      fillLocalePlaceholder({ path: 'data/settings_{{locale}}.json', locale: 'en', omitLocale }),
    ).toBe('data/settings_en.json');
    expect(
      fillLocalePlaceholder({ path: 'settings-{{locale}}.json', locale: 'en', omitLocale }),
    ).toBe('settings-en.json');
  });
});

describe('Test omitLocalePlaceholder()', () => {
  test('drops a placeholder used as a whole path segment', () => {
    expect(omitLocalePlaceholder('content/{{locale}}/about.md')).toBe('content/about.md');
    expect(omitLocalePlaceholder('{{locale}}/about.md')).toBe('about.md');
    expect(omitLocalePlaceholder('content/{{locale}}')).toBe('content');
    expect(omitLocalePlaceholder('{{locale}}')).toBe('');
    expect(omitLocalePlaceholder('/{{locale}}/posts/{{slug}}')).toBe('/posts/{{slug}}');
    expect(omitLocalePlaceholder('/blog/{{locale}}/')).toBe('/blog/');
    expect(omitLocalePlaceholder('/blog/{{locale}}')).toBe('/blog');
    // A root slash is kept
    expect(omitLocalePlaceholder('/{{locale}}')).toBe('/');
    expect(omitLocalePlaceholder('https://{{locale}}')).toBeUndefined();
  });

  test('drops a placeholder used as a later dot-separated part of a segment', () => {
    expect(omitLocalePlaceholder('content/about.{{locale}}.md')).toBe('content/about.md');
    expect(omitLocalePlaceholder('about.{{locale}}.md')).toBe('about.md');
    expect(omitLocalePlaceholder('content/about.{{locale}}')).toBe('content/about');
    expect(omitLocalePlaceholder('content/about.{{locale}}/index.md')).toBe(
      'content/about/index.md',
    );
    expect(omitLocalePlaceholder('/posts/{{slug}}.{{locale}}.html')).toBe('/posts/{{slug}}.html');
  });

  test('drops a placeholder used as the first dot-separated part of a file name', () => {
    expect(omitLocalePlaceholder('data/{{locale}}.settings.json')).toBe('data/settings.json');
    expect(omitLocalePlaceholder('{{locale}}.about.md')).toBe('about.md');
    expect(omitLocalePlaceholder('/posts/{{locale}}.{{slug}}')).toBe('/posts/{{slug}}');
  });

  test('only drops the first occurrence', () => {
    expect(omitLocalePlaceholder('{{locale}}/about.{{locale}}.md')).toBe('about.{{locale}}.md');
  });

  test('returns undefined for a placeholder that can’t be dropped', () => {
    expect(omitLocalePlaceholder('i18n/{{locale}}.yaml')).toBeUndefined();
    expect(omitLocalePlaceholder('{{locale}}.md')).toBeUndefined();
    expect(omitLocalePlaceholder('data/settings_{{locale}}.json')).toBeUndefined();
    expect(omitLocalePlaceholder('settings-{{locale}}.json')).toBeUndefined();
    expect(omitLocalePlaceholder('data/.{{locale}}.json')).toBeUndefined();
    expect(omitLocalePlaceholder('data/{{locale}}..json')).toBeUndefined();
    expect(omitLocalePlaceholder('content-{{locale}}/about.md')).toBeUndefined();
    expect(omitLocalePlaceholder('content/{{locale}}-site/about.md')).toBeUndefined();
    expect(omitLocalePlaceholder('content/about.{{locale}}-x.md')).toBeUndefined();
    expect(omitLocalePlaceholder('/{{locale}}.html')).toBeUndefined();
    expect(omitLocalePlaceholder('/posts?lang={{locale}}')).toBeUndefined();
  });

  test('returns undefined for a path without the placeholder', () => {
    expect(omitLocalePlaceholder('content/about.md')).toBeUndefined();
  });
});

describe('Test canOmitLocalePlaceholder()', () => {
  test('tells whether the placeholder can be dropped', () => {
    expect(canOmitLocalePlaceholder('content/{{locale}}/about.md')).toBe(true);
    expect(canOmitLocalePlaceholder('content/about.{{locale}}.md')).toBe(true);
    expect(canOmitLocalePlaceholder('i18n/{{locale}}.yaml')).toBe(false);
    expect(canOmitLocalePlaceholder('content/about.md')).toBe(false);
  });
});

describe('Test getLocaleFolderPattern()', () => {
  const matcher = '(?<locale>en|fr)\\/';

  test('replaces the placeholder with the matcher', () => {
    expect(getLocaleFolderPattern('content/{{locale}}/posts', matcher)).toBe(
      'content/(?<locale>en|fr)\\/posts/',
    );
    expect(getLocaleFolderPattern('{{locale}}/posts', matcher)).toBe('(?<locale>en|fr)\\/posts/');
    expect(getLocaleFolderPattern('content/{{locale}}', matcher)).toBe(
      'content/(?<locale>en|fr)\\/',
    );
    expect(getLocaleFolderPattern('{{locale}}', matcher)).toBe('(?<locale>en|fr)\\/');
  });

  test('escapes the other folder names', () => {
    expect(getLocaleFolderPattern('src/(pages)/{{locale}}/docs', matcher)).toBe(
      'src/\\(pages\\)/(?<locale>en|fr)\\/docs/',
    );
  });

  test('produces a working regular expression', () => {
    const regex = new RegExp(`^${getLocaleFolderPattern('content/{{locale}}/posts', matcher)}`);

    expect('content/en/posts/hello.md'.match(regex)?.groups?.locale).toBe('en');
    expect('content/fr/posts/2026/hello.md'.match(regex)?.groups?.locale).toBe('fr');
    expect(regex.test('content/de/posts/hello.md')).toBe(false);
    expect(regex.test('content/posts/hello.md')).toBe(false);
    expect(regex.test('en/content/posts/hello.md')).toBe(false);
  });

  test('can make the locale folder optional', () => {
    const optionalMatcher = '(?:(?<locale>fr)\\/)?';

    const regex = new RegExp(
      `^${getLocaleFolderPattern('content/{{locale}}/posts', optionalMatcher)}`,
    );

    expect('content/fr/posts/hello.md'.match(regex)?.groups?.locale).toBe('fr');
    expect('content/posts/hello.md'.match(regex)?.groups?.locale).toBeUndefined();
    expect(regex.test('content/posts/hello.md')).toBe(true);
    expect(regex.test('content/en/posts/hello.md')).toBe(false);
  });
});

describe('Test stripLocaleFolderPath()', () => {
  test('strips the folder path with any locale folder', () => {
    expect(
      stripLocaleFolderPath('content/en/posts/2026/hello.md', 'content/{{locale}}/posts'),
    ).toBe('2026/hello.md');
    expect(stripLocaleFolderPath('content/pt-BR/posts/hello.md', 'content/{{locale}}/posts')).toBe(
      'hello.md',
    );
    expect(stripLocaleFolderPath('fr/posts/hello.md', '{{locale}}/posts')).toBe('hello.md');
    expect(stripLocaleFolderPath('content/de/hello.md', 'content/{{locale}}')).toBe('hello.md');
  });

  test('strips the folder path without a locale folder', () => {
    expect(stripLocaleFolderPath('content/posts/2026/hello.md', 'content/{{locale}}/posts')).toBe(
      '2026/hello.md',
    );
  });

  test('leaves a path outside the folder as is', () => {
    expect(stripLocaleFolderPath('content/en/pages/hello.md', 'content/{{locale}}/posts')).toBe(
      'content/en/pages/hello.md',
    );
    expect(
      stripLocaleFolderPath('other/content/en/posts/hello.md', 'content/{{locale}}/posts'),
    ).toBe('other/content/en/posts/hello.md');
  });
});
