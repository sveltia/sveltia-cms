/* eslint-disable camelcase */

import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * @import { ConfigParserCollectors } from '$lib/types/private';
 */

// Mock svelte-i18n
/** @type {Record<string, string>} */
const mockI18nStrings = {};

vi.mock('svelte-i18n', () => ({
  _: {
    subscribe: vi.fn((fn) => {
      fn(
        /**
         * I18n callback.
         * @param {string} key Message key.
         * @param {object & { values?: Record<string, string> }} [options] Options.
         * @returns {string} Translated string.
         */
        (key, options) => {
          let message = mockI18nStrings[key] || key;

          if (options?.values) {
            Object.entries(options.values).forEach(([k, v]) => {
              message = message.replace(`{${k}}`, v);
            });
          }

          return message;
        },
      );

      return () => {};
    }),
  },
  locale: {
    subscribe: vi.fn((fn) => {
      fn('en');

      return () => {};
    }),
  },
}));

const mockGetStore = vi.fn();

vi.mock('svelte/store', () => ({
  get: mockGetStore,
}));

/**
 * Create a fresh collectors object for testing.
 * @returns {ConfigParserCollectors} Collectors instance.
 */
function createCollectors() {
  return {
    errors: new Set(),
    warnings: new Set(),
    mediaFields: new Set(),
    relationFields: new Set(),
  };
}

describe('Field Collectors', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockGetStore.mockImplementation((store) => {
      // Handle the _ (i18n) store
      if (store && typeof store.subscribe === 'function') {
        let result;

        store.subscribe((/** @type {any} */ value) => {
          result = value;
        })();

        return result;
      }

      // Fallback for other stores
      return store;
    });
  });

  describe('Media field collection in nested structures', () => {
    it('should collect media fields at top level', async () => {
      const { parseFields } = await import('./index.js');
      const collectors = createCollectors();

      /** @type {any} */
      const context = {
        siteConfig: {},
        collection: { name: 'posts' },
        typedKeyPath: '',
      };

      /** @type {any} */
      const fields = [
        {
          name: 'cover_image',
          widget: 'image',
          media_folder: '/uploads/images',
        },
        {
          name: 'title',
          widget: 'string',
        },
      ];

      parseFields(fields, context, collectors);

      expect(collectors.mediaFields.size).toBe(1);

      const [mediaField] = [...collectors.mediaFields];

      expect(mediaField.context.typedKeyPath).toBe('cover_image');
    });

    it('should collect media fields in object field subfields', async () => {
      const { parseFields } = await import('./index.js');
      const collectors = createCollectors();

      /** @type {any} */
      const context = {
        siteConfig: {},
        collection: { name: 'posts' },
        typedKeyPath: '',
      };

      /** @type {any} */
      const fields = [
        {
          name: 'content',
          widget: 'object',
          fields: [
            {
              name: 'featured_image',
              widget: 'image',
              media_folder: '/uploads/featured',
            },
            {
              name: 'text',
              widget: 'text',
            },
          ],
        },
      ];

      parseFields(fields, context, collectors);

      expect(collectors.mediaFields.size).toBe(1);

      const [mediaField] = [...collectors.mediaFields];

      expect(mediaField.context.typedKeyPath).toBe('content.featured_image');
    });

    it('should collect media fields in nested object fields', async () => {
      const { parseFields } = await import('./index.js');
      const collectors = createCollectors();

      /** @type {any} */
      const context = {
        siteConfig: {},
        collection: { name: 'posts' },
        typedKeyPath: '',
      };

      /** @type {any} */
      const fields = [
        {
          name: 'meta',
          widget: 'object',
          fields: [
            {
              name: 'settings',
              widget: 'object',
              fields: [
                {
                  name: 'thumbnail',
                  widget: 'image',
                  media_folder: '/media/thumbnails',
                },
              ],
            },
          ],
        },
      ];

      parseFields(fields, context, collectors);

      expect(collectors.mediaFields.size).toBe(1);

      const [mediaField] = [...collectors.mediaFields];

      expect(mediaField.context.typedKeyPath).toBe('meta.settings.thumbnail');
    });

    it('should collect media fields in list field subfields', async () => {
      const { parseFields } = await import('./index.js');
      const collectors = createCollectors();

      /** @type {any} */
      const context = {
        siteConfig: {},
        collection: { name: 'posts' },
        typedKeyPath: '',
      };

      /** @type {any} */
      const fields = [
        {
          name: 'gallery',
          widget: 'list',
          fields: [
            {
              name: 'image',
              widget: 'image',
              media_folder: '/uploads/gallery',
            },
          ],
        },
      ];

      parseFields(fields, context, collectors);

      expect(collectors.mediaFields.size).toBe(1);

      const [mediaField] = [...collectors.mediaFields];

      expect(mediaField.context.typedKeyPath).toBe('gallery.*.image');
    });

    it('should collect media fields in list with single field', async () => {
      const { parseFields } = await import('./index.js');
      const collectors = createCollectors();

      /** @type {any} */
      const context = {
        siteConfig: {},
        collection: { name: 'posts' },
        typedKeyPath: '',
      };

      /** @type {any} */
      const fields = [
        {
          name: 'photos',
          widget: 'list',
          field: {
            name: 'photo',
            widget: 'image',
            media_folder: '/uploads/photos',
          },
        },
      ];

      parseFields(fields, context, collectors);

      expect(collectors.mediaFields.size).toBe(1);

      const [mediaField] = [...collectors.mediaFields];

      expect(mediaField.context.typedKeyPath).toBe('photos.*.photo');
    });

    it('should collect media fields in nested list and object structures', async () => {
      const { parseFields } = await import('./index.js');
      const collectors = createCollectors();

      /** @type {any} */
      const context = {
        siteConfig: {},
        collection: { name: 'posts' },
        typedKeyPath: '',
      };

      /** @type {any} */
      const fields = [
        {
          name: 'sections',
          widget: 'list',
          fields: [
            {
              name: 'details',
              widget: 'object',
              fields: [
                {
                  name: 'media',
                  widget: 'image',
                  media_folder: '/uploads/sections',
                },
              ],
            },
          ],
        },
      ];

      parseFields(fields, context, collectors);

      expect(collectors.mediaFields.size).toBe(1);
      expect(collectors.relationFields.size).toBe(0);

      const [mediaField] = [...collectors.mediaFields];

      expect(mediaField.context.typedKeyPath).toBe('sections.*.details.media');
    });

    it('should collect multiple media fields at different depths', async () => {
      const { parseFields } = await import('./index.js');
      const collectors = createCollectors();

      /** @type {any} */
      const context = {
        siteConfig: {},
        collection: { name: 'posts' },
        typedKeyPath: '',
      };

      /** @type {any} */
      const fields = [
        {
          name: 'hero_image',
          widget: 'image',
          media_folder: '/uploads/hero',
        },
        {
          name: 'content',
          widget: 'object',
          fields: [
            {
              name: 'image',
              widget: 'image',
              media_folder: '/uploads/content',
            },
          ],
        },
        {
          name: 'gallery',
          widget: 'list',
          fields: [
            {
              name: 'photo',
              widget: 'image',
              media_folder: '/uploads/gallery',
            },
          ],
        },
      ];

      parseFields(fields, context, collectors);

      expect(collectors.mediaFields.size).toBe(3);
      expect(collectors.relationFields.size).toBe(0);

      const typedKeyPaths = [...collectors.mediaFields].map((f) => f.context.typedKeyPath);

      expect(typedKeyPaths).toEqual(['hero_image', 'content.image', 'gallery.*.photo']);
    });
  });

  describe('Relation field collection in nested structures', () => {
    it('should collect relation fields at top level', async () => {
      const { parseFields } = await import('./index.js');
      const collectors = createCollectors();

      /** @type {any} */
      const context = {
        siteConfig: {},
        collection: { name: 'posts' },
        typedKeyPath: '',
      };

      /** @type {any} */
      const fields = [
        {
          name: 'author',
          widget: 'relation',
          collection: 'authors',
          search_fields: ['name'],
          value_field: 'id',
        },
      ];

      parseFields(fields, context, collectors);

      expect(collectors.relationFields.size).toBe(1);

      const [relationField] = [...collectors.relationFields];

      expect(relationField.context.typedKeyPath).toBe('author');
    });

    it('should collect relation fields in object field', async () => {
      const { parseFields } = await import('./index.js');
      const collectors = createCollectors();

      /** @type {any} */
      const context = {
        siteConfig: {},
        collection: { name: 'posts' },
        typedKeyPath: '',
      };

      /** @type {any} */
      const fields = [
        {
          name: 'meta',
          widget: 'object',
          fields: [
            {
              name: 'related_post',
              widget: 'relation',
              collection: 'posts',
              search_fields: ['title'],
              value_field: 'slug',
            },
          ],
        },
      ];

      parseFields(fields, context, collectors);

      expect(collectors.relationFields.size).toBe(1);

      const [relationField] = [...collectors.relationFields];

      expect(relationField.context.typedKeyPath).toBe('meta.related_post');
    });

    it('should collect relation fields in list field', async () => {
      const { parseFields } = await import('./index.js');
      const collectors = createCollectors();

      /** @type {any} */
      const context = {
        siteConfig: {},
        collection: { name: 'posts' },
        typedKeyPath: '',
      };

      /** @type {any} */
      const fields = [
        {
          name: 'team_members',
          widget: 'list',
          field: {
            name: 'member',
            widget: 'relation',
            collection: 'people',
            search_fields: ['name'],
            value_field: 'id',
          },
        },
      ];

      parseFields(fields, context, collectors);

      expect(collectors.relationFields.size).toBe(1);

      const [relationField] = [...collectors.relationFields];

      expect(relationField.context.typedKeyPath).toBe('team_members.*.member');
    });

    it('should collect relation fields in deeply nested structures', async () => {
      const { parseFields } = await import('./index.js');
      const collectors = createCollectors();

      /** @type {any} */
      const context = {
        siteConfig: {},
        collection: { name: 'posts' },
        typedKeyPath: '',
      };

      /** @type {any} */
      const fields = [
        {
          name: 'chapters',
          widget: 'list',
          fields: [
            {
              name: 'sections',
              widget: 'list',
              fields: [
                {
                  name: 'author_reference',
                  widget: 'relation',
                  collection: 'authors',
                  search_fields: ['name'],
                  value_field: 'id',
                },
              ],
            },
          ],
        },
      ];

      parseFields(fields, context, collectors);

      expect(collectors.mediaFields.size).toBe(0);
      expect(collectors.relationFields.size).toBe(1);

      const [relationField] = [...collectors.relationFields];

      expect(relationField.context.typedKeyPath).toBe('chapters.*.sections.*.author_reference');
    });
  });

  describe('Variable type fields with collectors', () => {
    it('should collect media fields in list with variable types', async () => {
      const { parseFields } = await import('./index.js');
      const collectors = createCollectors();

      /** @type {any} */
      const context = {
        siteConfig: {},
        collection: { name: 'posts' },
        typedKeyPath: '',
      };

      /** @type {any} */
      const fields = [
        {
          name: 'blocks',
          widget: 'list',
          types: [
            {
              name: 'image_block',
              fields: [
                {
                  name: 'image',
                  widget: 'image',
                  media_folder: '/uploads/blocks/image',
                },
              ],
            },
            {
              name: 'text_block',
              fields: [
                {
                  name: 'content',
                  widget: 'text',
                },
              ],
            },
          ],
        },
      ];

      parseFields(fields, context, collectors);

      expect(collectors.mediaFields.size).toBe(1);
      expect(collectors.relationFields.size).toBe(0);

      const [mediaField] = [...collectors.mediaFields];

      expect(mediaField.context.typedKeyPath).toBe('blocks.*<image_block>.image');
    });

    it('should collect relation fields in object with variable types', async () => {
      const { parseFields } = await import('./index.js');
      const collectors = createCollectors();

      /** @type {any} */
      const context = {
        siteConfig: {},
        collection: { name: 'pages' },
        typedKeyPath: '',
      };

      /** @type {any} */
      const fields = [
        {
          name: 'components',
          widget: 'object',
          types: [
            {
              name: 'featured_post',
              fields: [
                {
                  name: 'post_ref',
                  widget: 'relation',
                  collection: 'posts',
                  search_fields: ['title'],
                  value_field: 'slug',
                },
              ],
            },
            {
              name: 'text_section',
              fields: [
                {
                  name: 'title',
                  widget: 'string',
                },
              ],
            },
          ],
        },
      ];

      parseFields(fields, context, collectors);

      expect(collectors.mediaFields.size).toBe(0);
      expect(collectors.relationFields.size).toBe(1);

      const [relationField] = [...collectors.relationFields];

      expect(relationField.context.typedKeyPath).toBe('components<featured_post>.post_ref');
    });

    it('should collect fields from multiple variable types', async () => {
      const { parseFields } = await import('./index.js');
      const collectors = createCollectors();

      /** @type {any} */
      const context = {
        siteConfig: {},
        collection: { name: 'posts' },
        typedKeyPath: '',
      };

      /** @type {any} */
      const fields = [
        {
          name: 'content_blocks',
          widget: 'list',
          types: [
            {
              name: 'image_block',
              fields: [
                {
                  name: 'image',
                  widget: 'image',
                  media_folder: '/uploads/images',
                },
              ],
            },
            {
              name: 'related_posts',
              fields: [
                {
                  name: 'post',
                  widget: 'relation',
                  collection: 'posts',
                  search_fields: ['title'],
                  value_field: 'slug',
                },
              ],
            },
          ],
        },
      ];

      parseFields(fields, context, collectors);

      expect(collectors.mediaFields.size).toBe(1);
      expect(collectors.relationFields.size).toBe(1);

      const [mediaField] = [...collectors.mediaFields];
      const [relationField] = [...collectors.relationFields];

      expect(mediaField.context.typedKeyPath).toBe('content_blocks.*<image_block>.image');
      expect(relationField.context.typedKeyPath).toBe('content_blocks.*<related_posts>.post');
    });

    it('should handle complex nested variable type structures', async () => {
      const { parseFields } = await import('./index.js');
      const collectors = createCollectors();

      /** @type {any} */
      const context = {
        siteConfig: {},
        collection: { name: 'pages' },
        typedKeyPath: '',
      };

      /** @type {any} */
      const fields = [
        {
          name: 'sections',
          widget: 'list',
          types: [
            {
              name: 'hero',
              fields: [
                {
                  name: 'background_image',
                  widget: 'image',
                  media_folder: '/uploads/hero',
                },
                {
                  name: 'featured_article',
                  widget: 'relation',
                  collection: 'articles',
                  search_fields: ['title'],
                  value_field: 'slug',
                },
              ],
            },
            {
              name: 'gallery',
              fields: [
                {
                  name: 'images',
                  widget: 'list',
                  field: {
                    name: 'image',
                    widget: 'image',
                    media_folder: '/uploads/gallery',
                  },
                },
              ],
            },
          ],
        },
      ];

      parseFields(fields, context, collectors);

      expect(collectors.mediaFields.size).toBe(2);
      expect(collectors.relationFields.size).toBe(1);

      const mediatypedKeyPaths = [...collectors.mediaFields].map((f) => f.context.typedKeyPath);
      const [relationField] = [...collectors.relationFields];

      expect(mediatypedKeyPaths).toEqual([
        'sections.*<hero>.background_image',
        'sections.*<gallery>.images.*.image',
      ]);
      expect(relationField.context.typedKeyPath).toBe('sections.*<hero>.featured_article');
    });
  });
});
