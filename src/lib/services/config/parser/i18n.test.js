import { beforeEach, describe, expect, test, vi } from 'vitest';

import { checkI18nOverrides, parseI18nConfig } from '$lib/services/config/parser/i18n';
import { addMessage } from '$lib/services/config/parser/utils/validator';

vi.mock('$lib/services/config/parser/utils/validator');

/** @type {any} */
const collectors = { errors: new Set(), warnings: new Set() };

/**
 * Assert the messages that were added, in order.
 * @param {object[]} messages Expected message properties.
 */
const expectMessages = (messages) => {
  expect(vi.mocked(addMessage).mock.calls.map(([args]) => args)).toEqual(
    messages.map((message) => expect.objectContaining({ collectors, ...message })),
  );
};

describe('parseI18nConfig', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  /**
   * Run the check with the given site-level `i18n` option.
   * @param {any} i18n The option value.
   * @returns {void}
   */
  const check = (i18n) => parseI18nConfig(/** @type {any} */ ({ i18n }), collectors);

  test('says nothing without i18n options, or with options of the wrong type', () => {
    check(undefined);
    check(true);
    check({ locales: 'en' });
    expect(addMessage).not.toHaveBeenCalled();
  });

  test('accepts locales that agree with each other', () => {
    check({ locales: ['en', 'fr'] });
    check({ locales: ['en', 'fr'], default_locale: 'fr' });
    check({ locales: ['en', 'fr'], default_locale: 'fr', initial_locales: ['en'] });
    check({ locales: ['en', 'fr'], initial_locales: 'all' });
    expect(addMessage).not.toHaveBeenCalled();
  });

  test('reports an empty locale list and nothing else about it', () => {
    check({ locales: [], default_locale: 'en' });
    expectMessages([{ strKey: 'i18n_no_locales' }]);
  });

  test('reports a default locale that is not listed', () => {
    check({ locales: ['en', 'fr'], default_locale: 'de' });
    expectMessages([{ strKey: 'i18n_invalid_default_locale', values: { locale: 'de' } }]);
  });

  test('reports each initial locale that is not listed', () => {
    check({ locales: ['en', 'fr'], initial_locales: ['en', 'de', 'es', 1] });
    expectMessages([
      { strKey: 'i18n_invalid_initial_locale', values: { locale: 'de' } },
      { strKey: 'i18n_invalid_initial_locale', values: { locale: 'es' } },
    ]);
  });

  test('leaves a default locale of the wrong type to the schema', () => {
    check({ locales: ['en'], default_locale: 1 });
    expect(addMessage).not.toHaveBeenCalled();
  });
});

describe('checkI18nOverrides', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  const siteI18n = { locales: ['en', 'fr'], default_locale: 'en' };

  /**
   * Run the check for a collection, or a file in it.
   * @param {object} args Arguments.
   * @param {any} [args.i18n] Site-level `i18n` option. Pass `null` to leave it out.
   * @param {any} [args.collectionI18n] Collection-level `i18n` option.
   * @param {any} [args.fileI18n] File-level `i18n` option. Makes the context a file context.
   * @param {boolean} [args.singleton] Whether the file is a singleton.
   * @returns {any} The context the check ran with.
   */
  const check = ({ i18n = siteI18n, collectionI18n, fileI18n, singleton = false } = {}) => {
    const collection = singleton
      ? { name: '_singletons', files: [] }
      : { name: 'posts', folder: 'content/posts', i18n: collectionI18n };

    const collectionFile =
      fileI18n === undefined
        ? undefined
        : { name: 'general', file: 'general.yaml', fields: [], i18n: fileI18n };

    const context = { cmsConfig: { i18n: i18n ?? undefined }, collection, collectionFile };

    checkI18nOverrides(/** @type {any} */ (context), collectors);

    return context;
  };

  test('says nothing when the option is not set', () => {
    check();
    check({ collectionI18n: false });
    check({ i18n: null });
    check({ collectionI18n: true, fileI18n: false });
    expect(addMessage).not.toHaveBeenCalled();
  });

  test('says nothing when the option builds on the site-level configuration', () => {
    check({ collectionI18n: true });
    check({ collectionI18n: { structure: 'multiple_files' } });
    check({ collectionI18n: true, fileI18n: true });
    check({ fileI18n: true, singleton: true });
    expect(addMessage).not.toHaveBeenCalled();
  });

  test('warns about a collection option with no site-level configuration', () => {
    const context = check({ i18n: null, collectionI18n: true });

    expectMessages([{ type: 'warning', strKey: 'i18n_not_configured', context }]);
  });

  test('warns about a file option with no collection option', () => {
    const context = check({ fileI18n: true });

    expectMessages([{ type: 'warning', strKey: 'i18n_not_configured', context }]);
  });

  test('warns about a singleton file option with no site-level configuration', () => {
    const context = check({ i18n: null, fileI18n: true, singleton: true });

    expectMessages([{ type: 'warning', strKey: 'i18n_not_configured', context }]);
  });

  test('leaves a file to its collection when the site-level configuration is missing', () => {
    check({ i18n: null, collectionI18n: true, fileI18n: true });
    expect(addMessage).not.toHaveBeenCalled();
  });

  test('checks the merged locales when the option overrides them', () => {
    const context = check({ collectionI18n: { locales: ['fr', 'de'] } });

    // The site-level default locale is not among the collection’s locales
    expectMessages([{ strKey: 'i18n_invalid_default_locale', values: { locale: 'en' }, context }]);
  });

  test('checks the merged locales when the option overrides the default locale', () => {
    const context = check({ collectionI18n: { default_locale: 'de' } });

    expectMessages([{ strKey: 'i18n_invalid_default_locale', values: { locale: 'de' }, context }]);
  });

  test('checks the merged locales when a file overrides the initial locales', () => {
    const context = check({ collectionI18n: true, fileI18n: { initial_locales: ['de'] } });

    expectMessages([{ strKey: 'i18n_invalid_initial_locale', values: { locale: 'de' }, context }]);
  });

  test('reports an empty override', () => {
    const context = check({ collectionI18n: { locales: [] } });

    expectMessages([{ strKey: 'i18n_no_locales', context }]);
  });

  test('does not repeat a site-level problem the option leaves alone', () => {
    check({ i18n: { locales: ['en'], default_locale: 'fr' }, collectionI18n: true });
    check({
      i18n: { locales: ['en'], default_locale: 'fr' },
      collectionI18n: { structure: 'multiple_files' },
    });

    expect(addMessage).not.toHaveBeenCalled();
  });
});
