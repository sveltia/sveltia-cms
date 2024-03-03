import { describe, expect, test } from 'vitest';
import { getOptions } from '$lib/components/contents/details/widgets/relation/helper';
import { siteConfig } from '$lib/services/config';

describe('Test getOptions()', () => {
  const locale = '_default';

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
  // Referencing a folder collection example
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

    /** @type {Entry[]} */
    const entries = [
      {
        id: '',
        sha: '',
        slug: 'melvin-lucas',
        collectionName: 'members',
        locales: {
          _default: {
            content: {
              slug: 'member-melvin-lucas',
              name: {
                first: 'Melvin',
                last: 'Lucas',
              },
              twitterHandle: 'MelvinLucas',
              followerCount: 123,
            },
          },
        },
      },
      {
        id: '',
        sha: '',
        slug: 'elsie-mcbride',
        collectionName: 'members',
        locales: {
          _default: {
            content: {
              slug: 'member-elsie-mcbride',
              name: {
                first: 'Elsie',
                last: 'Mcbride',
              },
              twitterHandle: 'ElsieMcbride',
              followerCount: 234,
            },
          },
        },
      },
      {
        id: '',
        sha: '',
        slug: 'maxine-field',
        collectionName: 'members',
        locales: {
          _default: {
            content: {
              slug: 'member-maxine-field',
              name: {
                first: 'Maxine',
                last: 'Field',
              },
              twitterHandle: 'MaxineField',
              followerCount: 345,
            },
          },
        },
      },
    ];

    expect(getOptions(locale, config, entries)).toEqual([
      { label: 'ElsieMcbride 234', value: 'Elsie' },
      { label: 'MaxineField 345', value: 'Maxine' },
      { label: 'MelvinLucas 123', value: 'Melvin' },
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
      { label: 'Elsie Mcbride (@ElsieMcbride)', value: 'elsie-mcbride' },
      { label: 'Maxine Field (@MaxineField)', value: 'maxine-field' },
      { label: 'Melvin Lucas (@MelvinLucas)', value: 'melvin-lucas' },
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
      { label: 'Elsie Mcbride (@ElsieMcbride)', value: 'member-elsie-mcbride' },
      { label: 'Maxine Field (@MaxineField)', value: 'member-maxine-field' },
      { label: 'Melvin Lucas (@MelvinLucas)', value: 'member-melvin-lucas' },
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
        slug: '',
        collectionName: 'relation_files',
        fileName: 'cities',
        locales: {
          _default: {
            content: {
              cities: [
                { id: 'YYZ', name: 'Toronto' },
                { id: 'YVR', name: 'Vancouver' },
                { id: 'YYC', name: 'Calgary' },
              ],
            },
            path: 'src/lib/data/pages/cities.json',
            sha: 'e5498c0c3d4592aaa18905e58bdf1cafa5b659c6',
          },
        },
      },
    ];

    expect(getOptions(locale, config, entries)).toEqual([
      { value: 'YYC', label: 'Calgary' },
      { value: 'YYZ', label: 'Toronto' },
      { value: 'YVR', label: 'Vancouver' },
    ]);

    expect(
      getOptions(
        locale,
        { ...config, display_fields: ['{{cities.*.name}} ({{cities.*.id}})'] },
        entries,
      ),
    ).toEqual([
      { value: 'YYC', label: 'Calgary (YYC)' },
      { value: 'YYZ', label: 'Toronto (YYZ)' },
      { value: 'YVR', label: 'Vancouver (YVR)' },
    ]);
  });

  // https://github.com/sveltia/sveltia-cms/issues/13
  test('nested fields with wildcard matching, folder collection', () => {
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
        slug: '',
        collectionName: 'pages',
        locales: {
          _default: {
            content: {
              route: '/about',
              sections: [
                { id: 'team', name: 'Team' },
                { id: 'contact', name: 'Contact' },
              ],
            },
          },
        },
      },
      {
        id: '',
        sha: '',
        slug: '',
        collectionName: 'pages',
        locales: {
          _default: {
            content: {
              route: '/projects',
              sections: [
                { id: 'overview', name: 'Overview' },
                { id: 'members', name: 'Members' },
              ],
            },
          },
        },
      },
    ];

    expect(getOptions(locale, config, entries)).toEqual([
      { label: 'Contact', value: 'contact' },
      { label: 'Members', value: 'members' },
      { label: 'Overview', value: 'overview' },
      { label: 'Team', value: 'team' },
    ]);

    expect(
      getOptions(locale, { ...config, display_fields: ['route', 'sections.*.name'] }, entries),
    ).toEqual([
      { label: '/about Contact', value: 'contact' },
      { label: '/about Team', value: 'team' },
      { label: '/projects Members', value: 'members' },
      { label: '/projects Overview', value: 'overview' },
    ]);

    expect(
      getOptions(
        locale,
        { ...config, display_fields: ['{{route}}: {{sections.*.name}} ({{sections.*.id}})'] },
        entries,
      ),
    ).toEqual([
      { label: '/about: Contact (contact)', value: 'contact' },
      { label: '/about: Team (team)', value: 'team' },
      { label: '/projects: Members (members)', value: 'members' },
      { label: '/projects: Overview (overview)', value: 'overview' },
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
      { label: '/about contact', value: '/about#contact' },
      { label: '/about team', value: '/about#team' },
      { label: '/projects members', value: '/projects#members' },
      { label: '/projects overview', value: '/projects#overview' },
    ]);

    // Invalid
    expect(
      getOptions(locale, { ...config, display_fields: ['sections.*.label'] }, entries),
    ).toEqual([
      {
        label: '{{sections.*.label}}',
        value: 'team',
      },
      {
        label: '{{sections.*.label}}',
        value: 'contact',
      },
      {
        label: '{{sections.*.label}}',
        value: 'overview',
      },
      {
        label: '{{sections.*.label}}',
        value: 'members',
      },
    ]);
  });
});
