import { flatten } from 'flat';
import { describe, expect, test } from 'vitest';
import { siteConfig } from '$lib/services/config';
import { getOptions } from '$lib/services/contents/widgets/relation/helper';

describe('Test getOptions()', () => {
  const locale = '_default';
  /** @type {LocalizedEntry} */
  const localizedEntryProps = { slug: '', path: '', sha: '', content: {} };

  /** @type {Entry[]} */
  const memberEntries = [
    {
      id: '',
      sha: '',
      slug: 'melvin-lucas',
      subPath: 'melvin-lucas',
      locales: {
        _default: {
          ...localizedEntryProps,
          content: flatten({
            slug: 'member-melvin-lucas',
            name: {
              first: 'Melvin',
              last: 'Lucas',
            },
            twitterHandle: 'MelvinLucas',
            followerCount: 123,
          }),
        },
      },
    },
    {
      id: '',
      sha: '',
      slug: 'elsie-mcbride',
      subPath: 'elsie-mcbride',
      locales: {
        _default: {
          ...localizedEntryProps,
          content: flatten({
            slug: 'member-elsie-mcbride',
            name: {
              first: 'Elsie',
              last: 'Mcbride',
            },
            twitterHandle: 'ElsieMcbride',
            followerCount: 234,
          }),
        },
      },
    },
    {
      id: '',
      sha: '',
      slug: 'maxine-field',
      subPath: 'maxine-field',
      locales: {
        _default: {
          ...localizedEntryProps,
          content: flatten({
            slug: 'member-maxine-field',
            name: {
              first: 'Maxine',
              last: 'Field',
            },
            twitterHandle: 'MaxineField',
            followerCount: 345,
          }),
        },
      },
    },
  ];

  siteConfig.set({
    backend: { name: 'github' },
    media_folder: 'static/assets/uploads',
    public_folder: '/assets/uploads',
    collections: [
      { name: 'authors', fields: [] },
      { name: 'pages', fields: [] },
      { name: 'relation_files', fields: [] },
    ],
  });

  // https://decapcms.org/docs/widgets/#relation
  // Referencing an entry collection example
  // String templates example
  test('nested fields', () => {
    const config = {
      name: 'author',
      label: 'Author',
      widget: 'relation',
      collection: 'authors',
      value_field: 'name.first',
      display_fields: ['twitterHandle', 'followerCount'],
      search_fields: ['name.first', 'twitterHandle'],
    };

    const entries = memberEntries;

    expect(getOptions(locale, config, entries)).toEqual([
      {
        label: 'ElsieMcbride 234',
        value: 'Elsie',
        searchValue: 'Elsie ElsieMcbride',
      },
      {
        label: 'MaxineField 345',
        value: 'Maxine',
        searchValue: 'Maxine MaxineField',
      },
      {
        label: 'MelvinLucas 123',
        value: 'Melvin',
        searchValue: 'Melvin MelvinLucas',
      },
    ]);

    expect(
      getOptions(
        locale,
        {
          ...config,
          value_field: '{{slug}}',
          display_fields: ['{{name.first}} {{name.last}} (@{{twitterHandle}})'],
        },
        entries,
      ),
    ).toEqual([
      {
        label: 'Elsie Mcbride (@ElsieMcbride)',
        value: 'elsie-mcbride',
        searchValue: 'Elsie ElsieMcbride',
      },
      {
        label: 'Maxine Field (@MaxineField)',
        value: 'maxine-field',
        searchValue: 'Maxine MaxineField',
      },
      {
        label: 'Melvin Lucas (@MelvinLucas)',
        value: 'melvin-lucas',
        searchValue: 'Melvin MelvinLucas',
      },
    ]);

    // In-field slug
    expect(
      getOptions(
        locale,
        {
          ...config,
          value_field: '{{fields.slug}}',
          display_fields: ['{{name.first}} {{name.last}} (@{{twitterHandle}})'],
        },
        entries,
      ),
    ).toEqual([
      {
        label: 'Elsie Mcbride (@ElsieMcbride)',
        value: 'member-elsie-mcbride',
        searchValue: 'Elsie ElsieMcbride',
      },
      {
        label: 'Maxine Field (@MaxineField)',
        value: 'member-maxine-field',
        searchValue: 'Maxine MaxineField',
      },
      {
        label: 'Melvin Lucas (@MelvinLucas)',
        value: 'member-melvin-lucas',
        searchValue: 'Melvin MelvinLucas',
      },
    ]);
  });

  // Referencing a file collection list field example
  // https://decapcms.org/docs/widgets/#relation
  test('nested fields with wildcard matching, file collection', () => {
    const config = {
      label: 'City',
      name: 'city',
      widget: 'relation',
      collection: 'relation_files',
      file: 'cities',
      search_fields: ['cities.*.name'],
      display_fields: ['cities.*.name'],
      value_field: 'cities.*.id',
    };

    /** @type {Entry[]} */
    const entries = [
      {
        id: '',
        sha: 'e5498c0c3d4592aaa18905e58bdf1cafa5b659c6',
        slug: 'cities',
        subPath: 'cities',
        locales: {
          _default: {
            ...localizedEntryProps,
            content: flatten({
              cities: [
                { id: 'YYZ', name: 'Toronto' },
                { id: 'YVR', name: 'Vancouver' },
                { id: 'YYC', name: 'Calgary' },
              ],
            }),
            path: 'src/lib/data/pages/cities.json',
            sha: 'e5498c0c3d4592aaa18905e58bdf1cafa5b659c6',
          },
        },
      },
    ];

    expect(getOptions(locale, config, entries)).toEqual([
      { value: 'YYC', label: 'Calgary', searchValue: 'Calgary' },
      { value: 'YYZ', label: 'Toronto', searchValue: 'Toronto' },
      { value: 'YVR', label: 'Vancouver', searchValue: 'Vancouver' },
    ]);

    expect(
      getOptions(
        locale,
        {
          ...config,
          search_fields: ['cities.*.name', 'cities.*.id'],
          display_fields: ['{{cities.*.name}} ({{cities.*.id}})'],
        },
        entries,
      ),
    ).toEqual([
      { value: 'YYC', label: 'Calgary (YYC)', searchValue: 'Calgary YYC' },
      { value: 'YYZ', label: 'Toronto (YYZ)', searchValue: 'Toronto YYZ' },
      { value: 'YVR', label: 'Vancouver (YVR)', searchValue: 'Vancouver YVR' },
    ]);
  });

  // https://github.com/sveltia/sveltia-cms/issues/13
  test('nested fields with wildcard matching, entry collection', () => {
    const config = {
      name: 'section',
      label: 'Section',
      widget: 'relation',
      collection: 'pages',
      value_field: 'sections.*.id',
      display_fields: ['sections.*.name'],
      search_fields: ['sections.*.name'],
    };

    /** @type {Entry[]} */
    const entries = [
      {
        id: '',
        sha: '',
        slug: 'about',
        subPath: 'about',
        locales: {
          _default: {
            ...localizedEntryProps,
            content: flatten({
              route: '/about',
              sections: [
                { id: 'team', name: 'Team' },
                { id: 'contact', name: 'Contact' },
              ],
            }),
          },
        },
      },
      {
        id: '',
        sha: '',
        slug: 'projects',
        subPath: 'projects',
        locales: {
          _default: {
            ...localizedEntryProps,
            content: flatten({
              route: '/projects',
              sections: [
                { id: 'overview', name: 'Overview' },
                { id: 'members', name: 'Members' },
              ],
            }),
          },
        },
      },
    ];

    expect(getOptions(locale, config, entries)).toEqual([
      { label: 'Contact', value: 'contact', searchValue: 'Contact' },
      { label: 'Members', value: 'members', searchValue: 'Members' },
      { label: 'Overview', value: 'overview', searchValue: 'Overview' },
      { label: 'Team', value: 'team', searchValue: 'Team' },
    ]);

    expect(
      getOptions(locale, { ...config, display_fields: ['route', 'sections.*.name'] }, entries),
    ).toEqual([
      { label: '/about Contact', value: 'contact', searchValue: 'Contact' },
      { label: '/about Team', value: 'team', searchValue: 'Team' },
      { label: '/projects Members', value: 'members', searchValue: 'Members' },
      { label: '/projects Overview', value: 'overview', searchValue: 'Overview' },
    ]);

    expect(
      getOptions(
        locale,
        { ...config, display_fields: ['{{route}}: {{sections.*.name}} ({{sections.*.id}})'] },
        entries,
      ),
    ).toEqual([
      { label: '/about: Contact (contact)', value: 'contact', searchValue: 'Contact' },
      { label: '/about: Team (team)', value: 'team', searchValue: 'Team' },
      { label: '/projects: Members (members)', value: 'members', searchValue: 'Members' },
      { label: '/projects: Overview (overview)', value: 'overview', searchValue: 'Overview' },
    ]);

    // Value field variant
    expect(
      getOptions(
        locale,
        {
          ...config,
          display_fields: ['{{route}} {{sections.*.id}}'],
          value_field: '{{route}}#{{sections.*.id}}',
        },
        entries,
      ),
    ).toEqual([
      { label: '/about contact', value: '/about#contact', searchValue: 'Contact' },
      { label: '/about team', value: '/about#team', searchValue: 'Team' },
      { label: '/projects members', value: '/projects#members', searchValue: 'Members' },
      { label: '/projects overview', value: '/projects#overview', searchValue: 'Overview' },
    ]);

    // Invalid
    expect(
      getOptions(locale, { ...config, display_fields: ['sections.*.label'] }, entries),
    ).toEqual([
      { label: '{{sections.*.label}}', value: 'team', searchValue: 'Team' },
      { label: '{{sections.*.label}}', value: 'contact', searchValue: 'Contact' },
      { label: '{{sections.*.label}}', value: 'overview', searchValue: 'Overview' },
      { label: '{{sections.*.label}}', value: 'members', searchValue: 'Members' },
    ]);
  });

  // https://github.com/sveltia/sveltia-cms/issues/106
  test('default locale fallback', () => {
    const config = {
      name: 'author',
      label: 'Author',
      widget: 'relation',
      collection: 'authors',
      value_field: 'name.first',
      display_fields: ['twitterHandle', 'followerCount'],
      search_fields: ['name.first', 'twitterHandle'],
    };

    const entries = memberEntries;

    expect(getOptions('en', config, entries)).toEqual([
      { label: 'ElsieMcbride 234', value: 'Elsie', searchValue: 'Elsie ElsieMcbride' },
      { label: 'MaxineField 345', value: 'Maxine', searchValue: 'Maxine MaxineField' },
      { label: 'MelvinLucas 123', value: 'Melvin', searchValue: 'Melvin MelvinLucas' },
    ]);
  });

  test('entry filters', () => {
    const config = {
      name: 'posts',
      label: 'Posts',
      widget: 'relation',
      collection: 'posts',
      value_field: '{{slug}}',
      display_fields: ['title'],
      search_fields: ['title', 'category'],
    };

    /** @type {Entry[]} */
    const entries = [
      {
        id: '',
        sha: '',
        slug: 'ragdoll',
        subPath: 'ragdoll',
        locales: {
          en: {
            ...localizedEntryProps,
            content: { category: 'cats', draft: true, title: 'Ragdoll' },
          },
        },
      },
      {
        id: '',
        sha: '',
        slug: 'persian',
        subPath: 'persian',
        locales: {
          en: {
            ...localizedEntryProps,
            content: { category: 'cats', draft: false, title: 'Persian' },
          },
        },
      },
      {
        id: '',
        sha: '',
        slug: 'bulldog',
        subPath: 'bulldog',
        locales: {
          en: {
            ...localizedEntryProps,
            content: { category: 'dogs', draft: true, title: 'Bulldog' },
          },
        },
      },
      {
        id: '',
        sha: '',
        slug: 'poodle',
        subPath: 'poodle',
        locales: {
          en: {
            ...localizedEntryProps,
            content: { category: 'dogs', draft: false, title: 'Poodle' },
          },
        },
      },
    ];

    expect(getOptions('en', config, entries)).toEqual([
      { label: 'Bulldog', value: 'bulldog', searchValue: 'Bulldog dogs' },
      { label: 'Persian', value: 'persian', searchValue: 'Persian cats' },
      { label: 'Poodle', value: 'poodle', searchValue: 'Poodle dogs' },
      { label: 'Ragdoll', value: 'ragdoll', searchValue: 'Ragdoll cats' },
    ]);

    expect(
      getOptions(
        'en',
        {
          ...config,
          filters: [{ field: 'draft', values: [true] }],
        },
        entries,
      ),
    ).toEqual([
      { label: 'Bulldog', value: 'bulldog', searchValue: 'Bulldog dogs' },
      { label: 'Ragdoll', value: 'ragdoll', searchValue: 'Ragdoll cats' },
    ]);

    expect(
      getOptions(
        'en',
        {
          ...config,
          filters: [
            { field: 'draft', values: [true] },
            { field: 'category', values: ['cats'] },
          ],
        },
        entries,
      ),
    ).toEqual([{ label: 'Ragdoll', value: 'ragdoll', searchValue: 'Ragdoll cats' }]);

    expect(
      getOptions(
        'en',
        {
          ...config,
          filters: [
            { field: 'draft', values: [false] },
            { field: 'category', values: ['cats', 'dogs'] },
          ],
        },
        entries,
      ),
    ).toEqual([
      { label: 'Persian', value: 'persian', searchValue: 'Persian cats' },
      { label: 'Poodle', value: 'poodle', searchValue: 'Poodle dogs' },
    ]);
  });
});
