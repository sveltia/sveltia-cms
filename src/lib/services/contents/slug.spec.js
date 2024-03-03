import { describe, expect, test } from 'vitest';
import { siteConfig } from '$lib/services/config';
import { defaultI18nConfig } from '$lib/services/contents/i18n';
import { fillSlugTemplate } from '$lib/services/contents/slug';

describe('Test fillSlugTemplate()', () => {
  /** @type {Collection} */
  const collection = {
    name: 'posts',
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
});
