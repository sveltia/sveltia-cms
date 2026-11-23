import { beforeEach, describe, expect, test, vi } from 'vitest';

import {
  checkArrayFileOptions,
  hasSlugTag,
} from '$lib/services/config/parser/collections/array-file';
import { addMessage } from '$lib/services/config/parser/utils/validator';

vi.mock('$lib/services/config/parser/utils/validator');

/** @type {any} */
const collectors = { errors: new Set(), warnings: new Set() };

/**
 * Run the check on an entry collection storing all the entries in one file.
 * @param {object} [options] Collection options to override.
 * @param {object} [siteOptions] Site-level options to add.
 * @returns {any} Context passed to the check.
 */
const check = (options = {}, siteOptions = {}) => {
  const context = /** @type {any} */ ({
    cmsConfig: { backend: { name: 'github' }, ...siteOptions },
    collection: { name: 'members', file: 'data/members.json', fields: [], ...options },
  });

  checkArrayFileOptions(context, collectors);

  return context;
};

describe('checkArrayFileOptions', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  test('adds no message for a valid collection', () => {
    check();
    check({ format: 'json' });
    expect(addMessage).not.toHaveBeenCalled();
  });

  test('returns early if the `file` option is not a string', () => {
    check({ file: 123, format: 'yaml', slug: '{{title}}' }, { publish_mode: 'editorial_workflow' });
    check({ file: undefined });
    expect(addMessage).not.toHaveBeenCalled();
  });

  test.each(['data/members.yaml', 'data/members', 'data/{{locale}}/members.json'])(
    'rejects an invalid file path: %s',
    (file) => {
      const context = check({ file });

      expect(addMessage).toHaveBeenCalledExactlyOnceWith({
        strKey: 'invalid_collection_data_file',
        values: { file },
        context,
        collectors,
      });
    },
  );

  test.each(['yaml', 'frontmatter', 'toml'])('rejects a format other than JSON: %s', (format) => {
    const context = check({ format });

    expect(addMessage).toHaveBeenCalledExactlyOnceWith({
      strKey: 'file_format_mismatch',
      values: { extension: 'json', format },
      context,
      collectors,
    });
  });

  test.each([
    'extension',
    'path',
    'slug',
    'slug_length',
    'nested',
    'meta',
    'index_file',
    'reorder',
  ])('rejects an unsupported option: %s', (prop) => {
    const context = check({ [prop]: undefined });

    expect(addMessage).toHaveBeenCalledExactlyOnceWith({
      strKey: 'unsupported_collection_data_file_option',
      values: { prop },
      context,
      collectors,
    });
  });

  test('rejects Editorial Workflow enabled at the site level', () => {
    const context = check({}, { publish_mode: 'editorial_workflow' });

    expect(addMessage).toHaveBeenCalledExactlyOnceWith({
      strKey: 'collection_data_file_workflow',
      context,
      collectors,
    });
  });

  test('rejects Editorial Workflow enabled at the collection level', () => {
    const context = check({ publish_mode: 'editorial_workflow' });

    expect(addMessage).toHaveBeenCalledExactlyOnceWith({
      strKey: 'collection_data_file_workflow',
      context,
      collectors,
    });
  });

  test('accepts a collection opting out of the site-level Editorial Workflow', () => {
    check({ publish_mode: 'simple' }, { publish_mode: 'editorial_workflow' });
    expect(addMessage).not.toHaveBeenCalled();
  });

  test('rejects Open Authoring', () => {
    const context = check({}, { backend: { name: 'github', open_authoring: true } });

    expect(addMessage).toHaveBeenCalledExactlyOnceWith({
      strKey: 'collection_data_file_workflow',
      context,
      collectors,
    });
  });

  test('accepts a configuration without a backend', () => {
    checkArrayFileOptions(
      /** @type {any} */ ({ cmsConfig: {}, collection: { name: 'members', file: 'a.json' } }),
      collectors,
    );
    expect(addMessage).not.toHaveBeenCalled();
  });

  test.each([
    ['preview_path', { preview_path: '/members/{{slug}}' }],
    ['preview_path', { preview_path: '/members/{{slug | upper}}' }],
    ['thumbnail', { thumbnail: '/images/{{slug}}.webp' }],
    ['thumbnail', { thumbnail: ['photo', '/images/{{slug}}.webp'] }],
  ])('rejects the slug tag in the `%s` option', (prop, options) => {
    const context = check(options);

    expect(addMessage).toHaveBeenCalledExactlyOnceWith({
      strKey: 'collection_data_file_slug_tag',
      values: { prop },
      context,
      collectors,
    });
  });

  test('accepts a field in the `preview_path` and `thumbnail` options', () => {
    check({ preview_path: '/members/{{fields.slug}}', thumbnail: '/images/{{id}}.webp' });
    check({ preview_path: '/members/{{id}}', thumbnail: ['photo', 'avatar'] });
    check({ thumbnail: false, preview_path: 1 });
    expect(addMessage).not.toHaveBeenCalled();
  });

  test('adds every applicable message', () => {
    check({ file: 'data/members.yml', format: 'yaml', slug: '{{title}}', reorder: true });
    expect(addMessage).toHaveBeenCalledTimes(4);
  });
});

describe('hasSlugTag', () => {
  test('finds the slug tag, with or without transformations', () => {
    expect(hasSlugTag('{{slug}}')).toBe(true);
    expect(hasSlugTag('{{locale}}/{{slug}}')).toBe(true);
    expect(hasSlugTag('/members/{{ slug | upper }}')).toBe(true);
  });

  test('ignores other tags', () => {
    expect(hasSlugTag('id')).toBe(false);
    expect(hasSlugTag('{{fields.slug}}')).toBe(false);
    expect(hasSlugTag('{{slug_name}}')).toBe(false);
  });
});
