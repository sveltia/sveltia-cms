import { describe, expect, it } from 'vitest';
import { getOptions } from '$lib/components/contents/details/widgets/relation/helper';

describe('Test getOptions()', () => {
  const locale = 'default';

  // https://decapcms.org/docs/widgets/#relation
  // Referencing a folder collection example
  // String templates example
  it('nested fields', () => {
    // @ts-ignore
    const config = {
      name: 'author',
      label: 'Author',
      widget: 'relation',
      collection: 'authors',
      value_field: 'name.first',
      display_fields: ['twitterHandle', 'followerCount'],
      search_fields: ['name.first', 'twitterHandle'],
    };

    // @ts-ignore
    const entries = [
      {
        slug: 'melvin-lucas',
        locales: {
          default: {
            content: {
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
        slug: 'elsie-mcbride',
        locales: {
          default: {
            content: {
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
        slug: 'maxine-field',
        locales: {
          default: {
            content: {
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

    expect(
      getOptions(
        locale,
        config,
        // @ts-ignore
        entries,
      ),
    ).toEqual([
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
        // @ts-ignore
        entries,
      ),
    ).toEqual([
      { label: 'Elsie Mcbride (@ElsieMcbride)', value: 'elsie-mcbride' },
      { label: 'Maxine Field (@MaxineField)', value: 'maxine-field' },
      { label: 'Melvin Lucas (@MelvinLucas)', value: 'melvin-lucas' },
    ]);
  });

  // Referencing a file collection list field example
  // https://decapcms.org/docs/widgets/#relation
  it('nested fields with wildcard matching, file collection', () => {
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

    const entries = [
      {
        sha: 'e5498c0c3d4592aaa18905e58bdf1cafa5b659c6',
        collectionName: 'relation_files',
        fileName: 'cities',
        locales: {
          default: {
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

    expect(
      getOptions(
        locale,
        config,
        // @ts-ignore
        entries,
      ),
    ).toEqual([
      { value: 'YYC', label: 'Calgary' },
      { value: 'YYZ', label: 'Toronto' },
      { value: 'YVR', label: 'Vancouver' },
    ]);

    expect(
      getOptions(
        locale,
        { ...config, display_fields: ['{{cities.*.name}} ({{cities.*.id}})'] },
        // @ts-ignore
        entries,
      ),
    ).toEqual([
      { value: 'YYC', label: 'Calgary (YYC)' },
      { value: 'YYZ', label: 'Toronto (YYZ)' },
      { value: 'YVR', label: 'Vancouver (YVR)' },
    ]);
  });

  // https://github.com/sveltia/sveltia-cms/issues/13
  it('nested fields with wildcard matching, folder collection', () => {
    const config = {
      name: 'section',
      label: 'Section',
      widget: 'relation',
      collection: 'pages',
      value_field: 'sections.*.id',
      display_fields: ['sections.*.name'],
      search_fields: ['sections.*.name'],
    };

    const entries = [
      {
        locales: {
          default: {
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
        locales: {
          default: {
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

    expect(
      getOptions(
        locale,
        config,
        // @ts-ignore
        entries,
      ),
    ).toEqual([
      { label: 'Contact', value: 'contact' },
      { label: 'Members', value: 'members' },
      { label: 'Overview', value: 'overview' },
      { label: 'Team', value: 'team' },
    ]);

    expect(
      getOptions(
        locale,
        { ...config, display_fields: ['route', 'sections.*.name'] },
        // @ts-ignore
        entries,
      ),
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
        // @ts-ignore
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
        // @ts-ignore
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
      getOptions(
        locale,
        { ...config, display_fields: ['sections.*.label'] },
        // @ts-ignore
        entries,
      ),
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
