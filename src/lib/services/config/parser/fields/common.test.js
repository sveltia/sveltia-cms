import { beforeEach, describe, expect, test, vi } from 'vitest';

import { checkCommonFieldOptions } from '$lib/services/config/parser/fields/common';
import { addMessage, checkRegex } from '$lib/services/config/parser/utils/validator';

vi.mock('$lib/services/config/parser/utils/validator');

/** @type {any} */
const context = { collection: { name: 'posts' }, typedKeyPath: 'title' };
/** @type {any} */
const collectors = { errors: new Set(), warnings: new Set() };

/**
 * Run the check on a field with the given options.
 * @param {object} options Field options.
 * @returns {void}
 */
const check = (options) =>
  checkCommonFieldOptions({
    config: /** @type {any} */ ({ name: 'title', widget: 'string', ...options }),
    context,
    collectors,
  });

/**
 * Assert that a range was reported.
 * @param {string} min Lower bound option name.
 * @param {string} max Upper bound option name.
 */
const expectRange = (min, max) => {
  expect(addMessage).toHaveBeenCalledExactlyOnceWith({
    strKey: 'invalid_range_options',
    values: { min, max },
    context,
    collectors,
  });
};

describe('checkCommonFieldOptions', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  test('says nothing without the options', () => {
    check({});
    expect(addMessage).not.toHaveBeenCalled();
    expect(checkRegex).not.toHaveBeenCalled();
  });

  test('checks the regular expression of a pattern', () => {
    check({ pattern: ['^\\d+$', 'Numbers only'] });

    expect(checkRegex).toHaveBeenCalledExactlyOnceWith({
      option: 'pattern',
      pattern: '^\\d+$',
      context,
      collectors,
    });
  });

  test('leaves a pattern of the wrong type to the schema', () => {
    check({ pattern: '^\\d+$' });
    expect(checkRegex).not.toHaveBeenCalled();
  });

  test('accepts ranges in the right order', () => {
    check({ min: 1, max: 5 });
    check({ min: 3, max: 3 });
    check({ minlength: 0, maxlength: 100 });
    check({ min: 5 });
    check({ maxlength: 5 });
    expect(addMessage).not.toHaveBeenCalled();
  });

  test('reports a minimum above the maximum', () => {
    check({ min: 5, max: 1 });
    expectRange('min', 'max');
  });

  test('reports a minimum length above the maximum length', () => {
    check({ minlength: 100, maxlength: 10 });
    expectRange('minlength', 'maxlength');
  });

  test('reports both ranges of one field', () => {
    check({ min: 5, max: 1, minlength: 100, maxlength: 10 });
    expect(addMessage).toHaveBeenCalledTimes(2);
  });

  test('leaves bounds of the wrong type to the schema', () => {
    check({ min: '5', max: 1 });
    check({ min: 5, max: null });
    expect(addMessage).not.toHaveBeenCalled();
  });
});

describe('checkCommonFieldOptions with localized default values', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  /**
   * Run the check on a field with the `default_localized` option in the given context.
   * @param {any} localizedDefault The `default_localized` option.
   * @param {any} ctx Context.
   * @returns {void}
   */
  const checkLocalized = (localizedDefault, ctx) =>
    checkCommonFieldOptions({
      config: /** @type {any} */ ({ name: 'title', default_localized: localizedDefault }),
      context: ctx,
      collectors,
    });

  const i18nContext = {
    cmsConfig: { i18n: { locales: ['en', 'de'], default_locale: 'en' } },
    collection: { name: 'posts', i18n: true },
    typedKeyPath: 'title',
  };

  test('says nothing about values for the collection’s locales', () => {
    checkLocalized({ en: 'Untitled', de: 'Ohne Titel' }, i18nContext);
    expect(addMessage).not.toHaveBeenCalled();
  });

  test('warns about a value for a locale the collection doesn’t have', () => {
    checkLocalized({ de: 'Ohne Titel', fr: 'Sans titre' }, i18nContext);

    expect(addMessage).toHaveBeenCalledExactlyOnceWith({
      type: 'warning',
      strKey: 'default_localized_unknown_locale',
      values: { locale: 'fr' },
      context: i18nContext,
      collectors,
    });
  });

  test('warns about the option without i18n', () => {
    const ctx = { ...i18nContext, collection: { name: 'posts' } };

    checkLocalized({ de: 'Ohne Titel' }, ctx);

    expect(addMessage).toHaveBeenCalledExactlyOnceWith({
      type: 'warning',
      strKey: 'default_localized_without_i18n',
      context: ctx,
      collectors,
    });
  });

  test('skips an editor component’s field and an option that isn’t an object', () => {
    checkLocalized({ de: 'Ohne Titel' }, { componentName: 'youtube', typedKeyPath: 'title' });
    checkLocalized('Ohne Titel', i18nContext);
    expect(addMessage).not.toHaveBeenCalled();
  });
});
