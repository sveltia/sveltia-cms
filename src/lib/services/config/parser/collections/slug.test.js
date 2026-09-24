import { beforeEach, describe, expect, test, vi } from 'vitest';

import { warnDeprecation } from '$lib/services/config/deprecations';
import { checkSlugOptions } from '$lib/services/config/parser/collections/slug';
import { addMessage, checkRegex } from '$lib/services/config/parser/utils/validator';

vi.mock('$lib/services/config/parser/utils/validator');
vi.mock('$lib/services/config/deprecations');

/** @type {any} */
const collectors = { errors: new Set(), warnings: new Set() };
/**
 * Site configuration with i18n enabled.
 * @type {any}
 */
const i18nSite = { i18n: { structure: 'multiple_folders', locales: ['en', 'fr'] } };

/**
 * Run the check on a folder collection with the given options.
 * @param {object} [options] Collection options to override.
 * @param {any} [cmsConfig] Site configuration.
 * @returns {any} Context passed to the check.
 */
const check = (options = {}, cmsConfig = {}) => {
  /** @type {any} */
  const collection = { name: 'posts', folder: 'content/posts', ...options };
  const context = { cmsConfig, collection };

  checkSlugOptions({ collection, context, collectors });

  return context;
};

describe('checkSlugOptions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('says nothing without the slug option', () => {
    check();
    expect(addMessage).not.toHaveBeenCalled();
    expect(checkRegex).not.toHaveBeenCalled();
    expect(warnDeprecation).not.toHaveBeenCalled();
  });

  describe('legacy slug editor tags', () => {
    test('warns about the deprecated tags', () => {
      check({ slug: '{{fields._slug}}' });
      check({ slug: '{{fields._slug | localize}}' });
      check({ slug: { template: '{{fields._slug}}' } });
      expect(warnDeprecation).toHaveBeenCalledTimes(3);
      expect(warnDeprecation).toHaveBeenCalledWith('slug_editor_tag');
    });

    test('says nothing about other templates', () => {
      check({ slug: '{{title}}' });
      check({ slug: { editable: true } });
      expect(warnDeprecation).not.toHaveBeenCalled();
    });
  });

  describe('slashes', () => {
    test('reports a template string with a slash', () => {
      const context = check({ slug: '{{year}}/{{title}}' });

      expect(addMessage).toHaveBeenCalledExactlyOnceWith({
        strKey: 'invalid_slug_slash',
        values: { slug: '{{year}}/{{title}}' },
        context,
        collectors,
      });
    });

    test('reports a template property with a slash', () => {
      const context = check({ slug: { template: '{{year}}/{{title}}' } });

      expect(addMessage).toHaveBeenCalledExactlyOnceWith({
        strKey: 'invalid_slug_slash',
        values: { slug: '{{year}}/{{title}}' },
        context,
        collectors,
      });
    });
  });

  describe('pattern', () => {
    test('checks the regular expression', () => {
      const context = check({ slug: { pattern: ['^[a-z]+$', 'Lowercase letters only'] } });

      expect(checkRegex).toHaveBeenCalledExactlyOnceWith({
        option: 'pattern',
        pattern: '^[a-z]+$',
        context,
        collectors,
      });
    });

    test('leaves a pattern of the wrong type to the schema', () => {
      check({ slug: { pattern: '^[a-z]+$' } });
      expect(checkRegex).not.toHaveBeenCalled();
    });
  });

  describe('i18n', () => {
    test('says nothing when each locale has a file of its own', () => {
      check({ i18n: true, slug: { i18n: true } }, i18nSite);
      check(
        { i18n: true, slug: { i18n: true } },
        { i18n: { structure: 'multiple_files', locales: ['en', 'fr'] } },
      );
      check(
        { i18n: true, folder: 'content/{{locale}}/posts', slug: { i18n: true } },
        { i18n: { locales: ['en', 'fr'] } },
      );
      expect(addMessage).not.toHaveBeenCalled();
    });

    test('warns when the collection stores every locale in one file', () => {
      const context = check({ i18n: true, slug: { i18n: true } }, { i18n: { locales: ['en'] } });

      check(
        { i18n: true, slug: { i18n: true } },
        { i18n: { structure: 'single_file_default_root', locales: ['en', 'fr'] } },
      );

      expect(addMessage).toHaveBeenCalledTimes(2);
      expect(addMessage).toHaveBeenCalledWith({
        type: 'warning',
        strKey: 'slug_i18n_ineffective',
        context,
        collectors,
      });
    });

    test('warns when the collection has no i18n', () => {
      check({ slug: { i18n: true } }, i18nSite);
      check({ slug: { i18n: true } });
      expect(addMessage).toHaveBeenCalledTimes(2);
    });

    test('says nothing when the slug is not localized', () => {
      check({ slug: { i18n: 'duplicate' } });
      check({ slug: { i18n: false } });
      expect(addMessage).not.toHaveBeenCalled();
    });
  });
});
