import { describe, expect, it } from 'vitest';
import { siteConfig } from '$lib/services/config';
import { fillSlugTemplate } from '$lib/services/contents/slug';

describe('Test fillSlugTemplate()', () => {
  /** @type {Collection} */
  const collection = {
    name: 'posts',
    _i18n: undefined,
    slug_length: 50,
  };

  siteConfig.set({
    media_folder: 'static/images/uploads',
    collections: [collection],
  });

  it('short slug', () => {
    const title =
      // cspell:disable-next-line
      'Lorem ipsum dolor sit amet, consectetur';

    expect(fillSlugTemplate('{{title}}', { collection, content: { title } })).toEqual(
      // cspell:disable-next-line
      'lorem-ipsum-dolor-sit-amet-consectetur',
    );
  });

  it('long slug', () => {
    const title =
      // cspell:disable-next-line
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nam pulvinar scelerisque';

    expect(fillSlugTemplate('{{title}}', { collection, content: { title } })).toEqual(
      // cspell:disable-next-line
      'lorem-ipsum-dolor-sit-amet-consectetur-adipiscing',
    );
  });
});
