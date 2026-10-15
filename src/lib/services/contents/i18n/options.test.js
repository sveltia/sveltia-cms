import { beforeEach, describe, expect, test, vi } from 'vitest';

import {
  getFieldLabel,
  getLocalizedOption,
  localizeDefaultValue,
} from '$lib/services/contents/i18n/options';

/**
 * @import { Field } from '$lib/types/public';
 */

const mockLocale = vi.hoisted(() => ({ current: /** @type {string | null} */ ('en-US') }));

vi.mock('@sveltia/i18n', () => ({ locale: mockLocale }));

beforeEach(() => {
  mockLocale.current = 'en-US';
});

describe('Test getLocalizedOption()', () => {
  const config = {
    name: 'categories',
    label: 'Categories',
    label_localized: { de: 'Kategorien', fr: 'Catégories', 'pt-BR': 'Categorias' },
  };

  test('returns the value for the content locale', () => {
    expect(getLocalizedOption({ config, option: 'label', locale: 'de' })).toBe('Kategorien');
    expect(getLocalizedOption({ config, option: 'label', locale: 'fr' })).toBe('Catégories');
  });

  test('falls back to the option itself without a localized value', () => {
    expect(getLocalizedOption({ config, option: 'label', locale: 'en' })).toBe('Categories');
    expect(getLocalizedOption({ config, option: 'hint', locale: 'de' })).toBeUndefined();
  });

  test('returns nothing without a configuration', () => {
    expect(
      getLocalizedOption({ config: undefined, option: 'label', locale: 'de' }),
    ).toBeUndefined();
  });

  test('ignores a localized value map that is not an object', () => {
    expect(
      getLocalizedOption({
        config: { name: 'title', label: 'Title', label_localized: 'Titel' },
        option: 'label',
        locale: 'de',
      }),
    ).toBe('Title');
  });

  test('falls back to the UI locale without a content locale', () => {
    mockLocale.current = 'fr';
    expect(getLocalizedOption({ config, option: 'label' })).toBe('Catégories');
    expect(getLocalizedOption({ config, option: 'label', locale: '_default' })).toBe('Catégories');
  });

  test('falls back to the UI locale where the content locale has no value', () => {
    mockLocale.current = 'de';
    expect(getLocalizedOption({ config, option: 'label', locale: 'ja' })).toBe('Kategorien');
  });

  test('prefers the content locale over the UI locale', () => {
    mockLocale.current = 'de';
    expect(getLocalizedOption({ config, option: 'label', locale: 'fr' })).toBe('Catégories');
  });

  test('matches the UI locale by language', () => {
    mockLocale.current = 'de-AT';
    expect(getLocalizedOption({ config, option: 'label' })).toBe('Kategorien');
    mockLocale.current = 'pt-PT';
    expect(getLocalizedOption({ config, option: 'label' })).toBe('Categorias');
    mockLocale.current = 'pt-BR';
    expect(getLocalizedOption({ config, option: 'label' })).toBe('Categorias');
  });

  test('prefers the bare language over another region', () => {
    mockLocale.current = 'en-CA';

    expect(
      getLocalizedOption({
        config: { name: 'color', label_localized: { 'en-GB': 'Colour', en: 'Color' } },
        option: 'label',
      }),
    ).toBe('Color');
  });

  test('doesn’t match a UI locale written in another script', () => {
    const chinese = {
      name: 'tags',
      label: 'Tags',
      label_localized: { 'zh-CN': '标签', zh: '标签' },
    };

    mockLocale.current = 'zh-TW';
    expect(getLocalizedOption({ config: chinese, option: 'label' })).toBe('Tags');
    mockLocale.current = 'zh-SG';
    expect(getLocalizedOption({ config: chinese, option: 'label' })).toBe('标签');
  });

  test('ignores an invalid locale code in the map', () => {
    mockLocale.current = 'de-AT';

    expect(
      getLocalizedOption({
        config: { name: 'x', label: 'X', label_localized: { '!!': 'Bad', de: 'Gut' } },
        option: 'label',
      }),
    ).toBe('Gut');
  });

  test('falls back to the option itself when the UI locale does not match', () => {
    mockLocale.current = 'ja';
    expect(getLocalizedOption({ config, option: 'label' })).toBe('Categories');
  });

  test('falls back to the option itself without a UI locale', () => {
    mockLocale.current = null;
    expect(getLocalizedOption({ config, option: 'label' })).toBe('Categories');
  });

  test('returns an empty localized value as is', () => {
    expect(
      getLocalizedOption({
        config: { name: 'title', hint: 'Hint', hint_localized: { de: '' } },
        option: 'hint',
        locale: 'de',
      }),
    ).toBe('');
  });
});

describe('Test getFieldLabel()', () => {
  test('returns the localized label', () => {
    expect(
      getFieldLabel({
        config: { name: 'title', label: 'Title', label_localized: { de: 'Titel' } },
        locale: 'de',
      }),
    ).toBe('Titel');
  });

  test('falls back to the label, then to the name', () => {
    expect(getFieldLabel({ config: { name: 'title', label: 'Title' }, locale: 'de' })).toBe(
      'Title',
    );
    expect(getFieldLabel({ config: { name: 'title', label: '' } })).toBe('title');
    expect(getFieldLabel({ config: { name: 'title', label_localized: { de: '' } } })).toBe('title');
    expect(getFieldLabel({ config: {} })).toBe('');
  });
});

describe('Test localizeDefaultValue()', () => {
  const fieldConfig = /** @type {Field} */ ({
    name: 'tags',
    widget: 'list',
    i18n: true,
    default: ['car repair'],
    default_localized: { de: ['autoreparatur'], fr: [] },
  });

  test('replaces the default value with the localized one', () => {
    expect(localizeDefaultValue({ fieldConfig, locale: 'de', defaultLocale: 'en' })).toEqual({
      name: 'tags',
      widget: 'list',
      i18n: true,
      default: ['autoreparatur'],
    });
    expect(localizeDefaultValue({ fieldConfig, locale: 'fr', defaultLocale: 'en' })).toHaveProperty(
      'default',
      [],
    );
  });

  test('keeps the default value without a localized one for the locale', () => {
    expect(localizeDefaultValue({ fieldConfig, locale: 'en', defaultLocale: 'en' })).toEqual({
      name: 'tags',
      widget: 'list',
      i18n: true,
      default: ['car repair'],
    });
  });

  test('does not match the UI locale', () => {
    mockLocale.current = 'de';

    expect(
      localizeDefaultValue({ fieldConfig, locale: '_default', defaultLocale: '_default' }),
    ).toHaveProperty('default', ['car repair']);
  });

  test('uses the default locale’s value for a duplicated field', () => {
    expect(
      localizeDefaultValue({
        fieldConfig: /** @type {Field} */ ({ ...fieldConfig, i18n: 'duplicate' }),
        locale: 'fr',
        defaultLocale: 'de',
      }),
    ).toHaveProperty('default', ['autoreparatur']);
  });

  test('returns the configuration as is without localized default values', () => {
    const config = /** @type {Field} */ ({ name: 'title', default: 'Untitled' });

    expect(localizeDefaultValue({ fieldConfig: config, locale: 'de', defaultLocale: 'en' })).toBe(
      config,
    );
    expect(
      localizeDefaultValue({
        fieldConfig: /** @type {Field} */ ({ ...config, default_localized: undefined }),
        locale: 'de',
        defaultLocale: 'en',
      }),
    ).toHaveProperty('default', 'Untitled');
  });
});
