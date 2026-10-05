import { beforeEach, describe, expect, test, vi } from 'vitest';

import { parseHiddenFieldConfig } from '$lib/services/config/parser/fields/hidden';
import { addMessage } from '$lib/services/config/parser/utils/validator';

vi.mock('$lib/services/config/parser/utils/validator');

/** @type {any} */
const collectors = { errors: new Set(), warnings: new Set() };
/** @type {any} */
const I18N = { locales: ['en', 'fr'] };

/**
 * Parse a Hidden field with the given default value in the given context.
 * @param {any} defaultValue The `default` option.
 * @param {object} [contextOverrides] Context to override the collection context with.
 * @returns {any} The context the check ran with.
 */
const check = (defaultValue, contextOverrides = {}) => {
  const context = {
    cmsConfig: {},
    collection: { name: 'posts', folder: 'content/posts', fields: [] },
    typedKeyPath: 'lang',
    ...contextOverrides,
  };

  parseHiddenFieldConfig({
    config: /** @type {any} */ ({ name: 'lang', widget: 'hidden', default: defaultValue }),
    context: /** @type {any} */ (context),
    collectors,
  });

  return context;
};

describe('parseHiddenFieldConfig', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  test('reports the locale tag in a collection without i18n', () => {
    const context = check('{{locale}}');

    expect(addMessage).toHaveBeenCalledExactlyOnceWith({
      strKey: 'hidden_field_locale_without_i18n',
      context,
      collectors,
    });
  });

  test('reports the locale tag with transformations or other text around it', () => {
    check('lang-{{locale | upper}}');
    expect(addMessage).toHaveBeenCalledOnce();
  });

  test('reports the locale tag in a collection that turns i18n off', () => {
    check('{{locale}}', {
      cmsConfig: { i18n: I18N },
      collection: { name: 'posts', folder: 'content/posts', fields: [], i18n: false },
    });
    expect(addMessage).toHaveBeenCalledOnce();
  });

  test('accepts the locale tag in a collection or file with i18n', () => {
    check('{{locale}}', {
      cmsConfig: { i18n: I18N },
      collection: { name: 'posts', folder: 'content/posts', fields: [], i18n: true },
    });
    check('{{locale}}', {
      cmsConfig: { i18n: I18N },
      collection: { name: 'pages', files: [], i18n: true },
      collectionFile: { name: 'home', file: 'home.md', fields: [], i18n: true },
    });
    expect(addMessage).not.toHaveBeenCalled();
  });

  test('accepts other tags and values', () => {
    check('{{uuid}}-{{datetime}}');
    check('locale');
    check(['{{locale}}']);
    check(undefined);
    expect(addMessage).not.toHaveBeenCalled();
  });

  test('leaves the field of an editor component alone', () => {
    check('{{locale}}', { collection: undefined, componentName: 'youtube' });
    expect(addMessage).not.toHaveBeenCalled();
  });
});
