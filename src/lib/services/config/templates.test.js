import { describe, expect, test } from 'vitest';

import {
  normalizeConfigTemplates,
  normalizeEditorComponentTemplates,
  normalizeFieldTemplates,
} from './templates';

describe('normalizeFieldTemplates()', () => {
  test('normalizes the template options of each field type', () => {
    /** @type {any[]} */
    const fields = [
      { name: 'id', widget: 'compute', value: '{{ fields.slug }}-{{ index }}' },
      { name: 'date', widget: 'datetime', default: '{{ now }}' },
      { name: 'lang', widget: 'hidden', default: '{{ locale }}' },
      { name: 'tags', widget: 'list', summary: '{{ fields.name|upper }}', fields: [] },
      { name: 'author', widget: 'object', summary: '{{ fields.name }}', fields: [] },
      {
        name: 'related',
        widget: 'relation',
        value_field: '{{ slug }}',
        display_fields: ['{{ title }}', 'date'],
        search_fields: '{{ title }}',
        filters: [{ field: 'author', values: ['{{ fields.author }}', 1] }],
      },
      { name: 'cover', widget: 'image', media_folder: '{{ media_folder }}/{{ slug }}' },
    ];

    normalizeFieldTemplates(fields);

    expect(fields).toEqual([
      { name: 'id', widget: 'compute', value: '{{fields.slug}}-{{index}}' },
      { name: 'date', widget: 'datetime', default: '{{now}}' },
      { name: 'lang', widget: 'hidden', default: '{{locale}}' },
      { name: 'tags', widget: 'list', summary: '{{fields.name | upper}}', fields: [] },
      { name: 'author', widget: 'object', summary: '{{fields.name}}', fields: [] },
      {
        name: 'related',
        widget: 'relation',
        value_field: '{{slug}}',
        display_fields: ['{{title}}', 'date'],
        search_fields: '{{title}}',
        filters: [{ field: 'author', values: ['{{fields.author}}', 1] }],
      },
      { name: 'cover', widget: 'image', media_folder: '{{media_folder}}/{{slug}}' },
    ]);
  });

  test('leaves the content options as they are', () => {
    /** @type {any[]} */
    const fields = [
      { name: 'title', default: '{{ title }}', hint: '{{ hint }}' },
      { name: 'body', widget: 'code', default: '{{ page.url }}' },
      { name: 'value', widget: 'string', value: '{{ x }}' },
      { name: 'filtered', widget: 'string', filters: [{ values: ['{{ x }}'] }] },
    ];

    const copy = structuredClone(fields);

    normalizeFieldTemplates(fields);

    expect(fields).toEqual(copy);
  });

  test('normalizes the subfields and the variable types', () => {
    /** @type {any[]} */
    const fields = [
      {
        name: 'blocks',
        widget: 'list',
        types: [
          {
            name: 'a',
            summary: '{{ fields.x }}',
            fields: [{ name: 'x', widget: 'hidden', default: '{{ uuid }}' }],
          },
        ],
      },
      {
        name: 'items',
        widget: 'list',
        field: { name: 'item', widget: 'object', summary: '{{ fields.x }}', fields: [] },
      },
    ];

    normalizeFieldTemplates(fields);

    expect(fields[0].types[0].summary).toBe('{{fields.x}}');
    expect(fields[0].types[0].fields[0].default).toBe('{{uuid}}');
    expect(fields[1].field.summary).toBe('{{fields.x}}');
  });

  test('normalizes the filename template of the media libraries', () => {
    /** @type {any[]} */
    const fields = [
      {
        name: 'image',
        widget: 'image',
        media_libraries: { default: { config: { filename_template: '{{ filename }}' } } },
      },
      {
        name: 'file',
        widget: 'file',
        media_library: { config: { filename_template: '{{ uuid_short }}' } },
      },
    ];

    normalizeFieldTemplates(fields);

    expect(fields[0].media_libraries.default.config.filename_template).toBe('{{filename}}');
    expect(fields[1].media_library.config.filename_template).toBe('{{uuid_short}}');
  });

  test('ignores invalid values', () => {
    /** @type {any[]} */
    const fields = [null, 'title', { name: 'list', widget: 'list', summary: 1 }];

    expect(() => normalizeFieldTemplates(fields)).not.toThrow();
    expect(() => normalizeFieldTemplates(undefined)).not.toThrow();
    expect(fields[2].summary).toBe(1);
  });
});

describe('normalizeConfigTemplates()', () => {
  test('normalizes the template options of the configuration', () => {
    /** @type {any} */
    const config = {
      backend: {
        name: 'github',
        commit_messages: { create: 'Create {{ collection }} {{ slug }}' },
      },
      media_folder: 'static/images',
      media_libraries: { default: { config: { filename_template: '{{ year }}-{{ filename }}' } } },
      i18n: { locales: ['en'], canonical_slug: { value: '{{ slug }}' } },
      collections: [
        {
          name: 'posts',
          folder: 'content/{{ locale }}/posts',
          slug: '{{ year }}-{{ title|lower }}',
          path: '{{ slug }}/index',
          summary: '{{ title }}',
          preview_path: '/posts/{{ slug }}',
          media_folder: '/static/{{ slug }}',
          public_folder: '/{{ slug }}',
          i18n: { canonical_slug: { value: '{{ fields.id }}' } },
          nested: { summary: '{{ title }}' },
          table_columns: ['title', '{{ locales }}', { field: '{{ dirname }}', label: 'Dir' }],
          summary_fields: ['{{ filename }}'],
          thumbnail: ['cover', '/images/{{ slug }}.webp'],
          view_filters: [
            { label: 'Past', field: 'date', lt: '{{ now }}' },
            { label: 'Today', field: 'date', pattern: '^{{ today }}' },
          ],
          view_groups: { groups: [{ label: 'Year', field: 'date', in: ['{{ now }}'] }] },
          fields: [{ name: 'lang', widget: 'hidden', default: '{{ locale }}' }],
          index_file: {
            summary: '{{ title }} ({{ locales }})',
            fields: [{ name: 'lang', widget: 'hidden', default: '{{ locale }}' }],
          },
        },
        {
          name: 'docs',
          file: 'data/{{ locale }}.json',
          slug: { template: '{{ title }}' },
          view_filters: { filters: [{ label: 'Now', field: 'date', gte: '{{ now }}' }] },
        },
        {
          name: 'pages',
          files: [
            {
              name: 'home',
              file: 'content/{{ locale }}/home.md',
              summary: 'Home ({{ locales }})',
              preview_path: '/{{ locale }}/',
              i18n: { canonical_slug: { value: '{{ fields.key }}' } },
              fields: [{ name: 'lang', widget: 'hidden', default: '{{ locale }}' }],
            },
          ],
        },
      ],
      singletons: [{ name: 'about', file: 'about.{{ locale }}.md', fields: [] }],
      asset_collections: [{ name: 'images', media_folder: 'images/{{ year }}' }],
    };

    expect(normalizeConfigTemplates(config)).toBe(config);
    expect(config).toEqual({
      backend: { name: 'github', commit_messages: { create: 'Create {{collection}} {{slug}}' } },
      media_folder: 'static/images',
      media_libraries: { default: { config: { filename_template: '{{year}}-{{filename}}' } } },
      i18n: { locales: ['en'], canonical_slug: { value: '{{slug}}' } },
      collections: [
        {
          name: 'posts',
          folder: 'content/{{locale}}/posts',
          slug: '{{year}}-{{title | lower}}',
          path: '{{slug}}/index',
          summary: '{{title}}',
          preview_path: '/posts/{{slug}}',
          media_folder: '/static/{{slug}}',
          public_folder: '/{{slug}}',
          i18n: { canonical_slug: { value: '{{fields.id}}' } },
          nested: { summary: '{{title}}' },
          table_columns: ['title', '{{locales}}', { field: '{{dirname}}', label: 'Dir' }],
          summary_fields: ['{{filename}}'],
          thumbnail: ['cover', '/images/{{slug}}.webp'],
          view_filters: [
            { label: 'Past', field: 'date', lt: '{{now}}' },
            { label: 'Today', field: 'date', pattern: '^{{today}}' },
          ],
          view_groups: { groups: [{ label: 'Year', field: 'date', in: ['{{now}}'] }] },
          fields: [{ name: 'lang', widget: 'hidden', default: '{{locale}}' }],
          index_file: {
            summary: '{{title}} ({{locales}})',
            fields: [{ name: 'lang', widget: 'hidden', default: '{{locale}}' }],
          },
        },
        {
          name: 'docs',
          file: 'data/{{locale}}.json',
          slug: { template: '{{title}}' },
          view_filters: { filters: [{ label: 'Now', field: 'date', gte: '{{now}}' }] },
        },
        {
          name: 'pages',
          files: [
            {
              name: 'home',
              file: 'content/{{locale}}/home.md',
              summary: 'Home ({{locales}})',
              preview_path: '/{{locale}}/',
              i18n: { canonical_slug: { value: '{{fields.key}}' } },
              fields: [{ name: 'lang', widget: 'hidden', default: '{{locale}}' }],
            },
          ],
        },
      ],
      singletons: [{ name: 'about', file: 'about.{{locale}}.md', fields: [] }],
      asset_collections: [{ name: 'images', media_folder: 'images/{{year}}' }],
    });
  });

  test('ignores invalid values', () => {
    /** @type {any} */
    const config = {
      backend: { name: 'github', commit_messages: 'x' },
      collections: [null, { name: 'posts', files: [null], view_groups: { groups: 'x' } }],
      singletons: [null],
      asset_collections: [null],
      media_libraries: null,
    };

    expect(() => normalizeConfigTemplates(config)).not.toThrow();
    expect(() => normalizeConfigTemplates(/** @type {any} */ ({}))).not.toThrow();
  });
});

describe('normalizeEditorComponentTemplates()', () => {
  test('normalizes the summary and the fields', () => {
    /** @type {any} */
    const definition = {
      id: 'youtube',
      summary: '{{ fields.id }}',
      fields: [{ name: 'key', widget: 'compute', value: '{{ fields.id|upper }}' }],
    };

    normalizeEditorComponentTemplates(definition);

    expect(definition.summary).toBe('{{fields.id}}');
    expect(definition.fields[0].value).toBe('{{fields.id | upper}}');
  });
});
