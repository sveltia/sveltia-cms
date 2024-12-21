import { getDateTimeParts } from '@sveltia/utils/datetime';
import { describe, expect, test } from 'vitest';
import { siteConfig } from '$lib/services/config';
import { fillSlugTemplate } from '$lib/services/contents/entry/slug';
import { defaultI18nConfig } from '$lib/services/contents/i18n';

describe('Test fillSlugTemplate()', () => {
  /** @type {Collection} */
  const collection = {
    name: 'posts',
    _type: 'entry',
    _file: {
      extension: 'md',
      format: 'yaml-frontmatter',
      basePath: 'content/posts',
    },
    _i18n: defaultI18nConfig,
    slug_length: 50,
  };

  siteConfig.set({
    backend: { name: 'github' },
    media_folder: 'static/images/uploads',
    collections: [collection],
  });

  test('short slug', () => {
    const title =
      // cspell:disable-next-line
      'Lorem ipsum dolor sit amet, consectetur';

    expect(fillSlugTemplate('{{title}}', { collection, content: { title } })).toEqual(
      // cspell:disable-next-line
      'lorem-ipsum-dolor-sit-amet-consectetur',
    );
  });

  test('long slug', () => {
    const title =
      // cspell:disable-next-line
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nam pulvinar scelerisque';

    expect(fillSlugTemplate('{{title}}', { collection, content: { title } })).toEqual(
      // cspell:disable-next-line
      'lorem-ipsum-dolor-sit-amet-consectetur-adipiscing',
    );
  });

  test('date/time', () => {
    const template = '{{year}}-{{month}}-{{day}}-{{hour}}-{{minute}}-{{second}}';
    const dateTimeParts = getDateTimeParts({ timeZone: 'UTC' });
    const { year, month, day, hour, minute, second } = dateTimeParts;
    const result = `${year}-${month}-${day}-${hour}-${minute}-${second}`;

    // The time zone should always be UTC, not local, with or without the `dateTimeParts` option
    expect(fillSlugTemplate(template, { collection, content: {} })).toEqual(result);
    expect(fillSlugTemplate(template, { collection, content: {}, dateTimeParts })).toEqual(result);
  });

  test('random ID fallback', () => {
    expect(fillSlugTemplate('{{title}}', { collection, content: {} })).toMatch(/[0-9a-f]{12}/);
    expect(fillSlugTemplate('{{name}}', { collection, content: {} })).toMatch(/[0-9a-f]{12}/);
  });

  test('apply filter', () => {
    expect(
      fillSlugTemplate("{{published | date('MMM D, YYYY')}}", {
        collection,
        content: { published: '2024-01-23' },
      }),
    ).toEqual('jan-23-2024');

    expect(
      fillSlugTemplate("{{name | default('world')}}", {
        collection,
        content: { name: 'hello' },
      }),
    ).toEqual('hello');

    expect(
      fillSlugTemplate("{{name | default('world')}}", {
        collection,
        content: { name: '' },
      }),
    ).toEqual('world');

    expect(
      fillSlugTemplate("{{draft | ternary('Draft', 'Public')}}", {
        collection,
        content: { draft: true },
      }),
    ).toEqual('draft');

    expect(
      fillSlugTemplate("{{draft | ternary('Draft', 'Public')}}", {
        collection,
        content: { draft: false },
      }),
    ).toEqual('public');

    expect(
      fillSlugTemplate('{{title | truncate(40)}}', {
        collection,
        content: {
          // cspell:disable-next-line
          title: 'lorem-ipsum-dolor-sit-amet-consectetur-adipiscing',
        },
      }),
    ).toEqual(
      // cspell:disable-next-line
      'lorem-ipsum-dolor-sit-amet-consectetur-a…',
    );
  });
});
