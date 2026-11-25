import { addMessages, init } from '@sveltia/i18n';
import { beforeAll, describe, expect, test } from 'vitest';

import appStrings from '$lib/locales/en-US.yaml';
import {
  hasRemovedSlugEditorTag,
  isReportedRemovedOption,
  REMOVED_BACKEND_OPTIONS,
  REMOVED_COLLECTION_OPTIONS,
  REMOVED_I18N_OPTIONS,
  REMOVED_I18N_STRUCTURE,
} from '$lib/services/config/parser/removed';
import { addMessage, checkUnsupportedOptions } from '$lib/services/config/parser/utils/validator';
import { createCollectors } from '$lib/test/config-parser';

const MIGRATION_LINK =
  /\. See the migration guide for details: \S*https:\/\/sveltiacms\.app\/docs\/migration\/earlier-versions>\S*$/;

beforeAll(() => {
  // Use the real English strings, so the tests check the messages a user sees
  addMessages('en-US', appStrings);
  init({ fallbackLocale: 'en-US', initialLocale: 'en-US' });
});

describe('REMOVED_I18N_STRUCTURE', () => {
  test('is the structure removed in Sveltia CMS 5.0', () => {
    expect(REMOVED_I18N_STRUCTURE).toBe('multiple_folders_i18n_root');
  });
});

describe('isReportedRemovedOption', () => {
  test.each([
    ['automatic_deployments', '/backend', true],
    ['automatic_deployments', '', false],
    ['save_all_locales', '/i18n', true],
    ['omit_default_locale_from_filename', '/collections/1/files/0/i18n', true],
    ['save_all_locales', '/collections/1', false],
    ['slug_length', '/collections/2', true],
    ['yaml_quote', '/collections/2', true],
    ['slug_length', '/slug', false],
    ['bogus', '/backend', false],
    ['structure', '/i18n', false],
    ['toString', '/backend', false],
  ])('%s in %j → %s', (name, instancePath, expected) => {
    expect(isReportedRemovedOption(name, instancePath)).toBe(expected);
  });
});

describe('removed options', () => {
  test.each([
    [
      REMOVED_BACKEND_OPTIONS,
      { automatic_deployments: false },
      'The `automatic_deployments` backend option was removed in Sveltia CMS 5.0. ' +
        'Use the `skip_ci` option instead.',
    ],
    [
      REMOVED_I18N_OPTIONS,
      { save_all_locales: false },
      'The `save_all_locales` i18n option was removed in Sveltia CMS 5.0. ' +
        'Use the `initial_locales` option instead.',
    ],
    [
      REMOVED_I18N_OPTIONS,
      { omit_default_locale_from_filename: true },
      'The `omit_default_locale_from_filename` i18n option was removed in Sveltia CMS 5.0. ' +
        'Use the `omit_default_locale_from_file_path` option instead.',
    ],
    [
      REMOVED_I18N_OPTIONS,
      { structure: 'multiple_folders_i18n_root' },
      'The `multiple_folders_i18n_root` i18n structure was removed in Sveltia CMS 5.0. ' +
        'Use the `multiple_root_folders` structure instead',
    ],
    [
      REMOVED_COLLECTION_OPTIONS,
      { slug_length: 0 },
      'The `slug_length` collection option was removed in Sveltia CMS 5.0. ' +
        'Use the `maxlength` option in the global `slug` options instead.',
    ],
    [
      REMOVED_COLLECTION_OPTIONS,
      { yaml_quote: false },
      'The `yaml_quote` collection option was removed in Sveltia CMS 5.0. ' +
        'Use the `quote` option in the global `output.yaml` options instead.',
    ],
  ])('reports %j as an error with the migration guide link', (options, config, expected) => {
    const collectors = createCollectors();

    checkUnsupportedOptions({
      UNSUPPORTED_OPTIONS: options,
      config,
      context: { cmsConfig: /** @type {any} */ ({}) },
      collectors,
    });

    const [message] = [...collectors.errors];

    expect(collectors.errors.size).toBe(1);
    expect(collectors.warnings.size).toBe(0);
    expect(message).toContain(expected);
    expect(message).toMatch(MIGRATION_LINK);
  });

  test('leaves the supported options and structures alone', () => {
    const collectors = createCollectors();

    checkUnsupportedOptions({
      UNSUPPORTED_OPTIONS: REMOVED_I18N_OPTIONS,
      config: { structure: 'multiple_root_folders', initial_locales: 'all' },
      context: { cmsConfig: /** @type {any} */ ({}) },
      collectors,
    });

    expect(collectors.errors.size).toBe(0);
  });

  test('names the collection it was found in', () => {
    const collectors = createCollectors();

    checkUnsupportedOptions({
      UNSUPPORTED_OPTIONS: REMOVED_COLLECTION_OPTIONS,
      config: { yaml_quote: true },
      context: {
        cmsConfig: /** @type {any} */ ({}),
        collection: /** @type {any} */ ({ name: 'posts', label: 'Posts' }),
      },
      collectors,
    });

    expect([...collectors.errors][0]).toMatch(/^\S*Posts\S* collection: The `yaml_quote`/);
  });

  test('shows the slug template tags with plain braces', () => {
    const collectors = createCollectors();

    addMessage({ strKey: 'removed_slug_editor_tag', extraStrKey: 'migration_link', collectors });

    const [message] = [...collectors.errors];

    expect(message).toContain(
      'The `{{fields._slug}}` and `{{fields._slug | localize}}` slug template tags were removed ' +
        'in Sveltia CMS 5.0.',
    );
    expect(message).toContain(
      "`slug: '{{fields._slug}}'` is equivalent to `slug: { editable: true }`",
    );
    expect(message).not.toContain('\\{');
    expect(message).toMatch(MIGRATION_LINK);
  });
});

describe('hasRemovedSlugEditorTag', () => {
  test.each([
    '{{fields._slug}}',
    '{{fields._slug | localize}}',
    '{{_slug}}',
    '{{ fields._slug | lower }}',
    '{{year}}-{{fields._slug}}',
  ])('finds the tag in %s', (template) => {
    expect(hasRemovedSlugEditorTag(template)).toBe(true);
  });

  test.each([
    undefined,
    null,
    { editable: true },
    '',
    '{{slug}}',
    '{{title}}',
    '{{fields.slug}}',
    '{{fields._slugs}}',
    '_slug',
  ])('doesn’t find the tag in %o', (template) => {
    expect(hasRemovedSlugEditorTag(template)).toBe(false);
  });
});
