// @ts-nocheck
import { describe, expect, it } from 'vitest';

import { normalizeContent, normalizeContentMap } from './normalize';

/**
 * Call {@link normalizeContent} with the default locale as the current locale.
 * @param {any[]} fields Field list.
 * @param {any} content Flattened entry content.
 * @returns {any} Normalized content.
 */
const normalize = (fields, content) =>
  normalizeContent({ fields, content, locale: '_default', defaultLocale: '_default' });

describe('contents/draft/create/normalize', () => {
  describe('normalizeContent', () => {
    it('should leave existing values alone', () => {
      const fields = [
        { name: 'title', widget: 'string' },
        { name: 'draft', widget: 'boolean', default: true },
      ];

      expect(normalize(fields, { title: 'Hello', draft: false })).toEqual({
        title: 'Hello',
        draft: false,
      });
    });

    it('should not overwrite an empty string with a default value', () => {
      const fields = [{ name: 'title', widget: 'string', default: 'Untitled' }];

      expect(normalize(fields, { title: '' })).toEqual({ title: '' });
    });

    it('should fill in a missing Boolean field with its default value', () => {
      // https://github.com/sveltia/sveltia-cms/issues/650
      const fields = [
        { name: 'title', widget: 'string' },
        { name: 'aBoolean', widget: 'boolean', required: false, default: true },
      ];

      expect(normalize(fields, { title: 'Hello' })).toEqual({
        title: 'Hello',
        aBoolean: true,
      });
    });

    it('should fill in a missing required field so the validator can catch it', () => {
      // https://github.com/sveltia/sveltia-cms/issues/395
      const fields = [
        { name: 'name', widget: 'string' },
        { name: 'chargeSpeed', widget: 'select', options: ['slow', 'fast'] },
      ];

      expect(normalize(fields, { name: 'EV Ultra 240S' })).toEqual({
        name: 'EV Ultra 240S',
        chargeSpeed: '',
      });
    });

    it('should fill in a missing List field with an empty array', () => {
      const fields = [{ name: 'tags', widget: 'list' }];

      expect(normalize(fields, {})).toEqual({ tags: [] });
    });

    it('should fill in a missing multi-value Select field with an empty array', () => {
      const fields = [{ name: 'features', widget: 'select', multiple: true, options: ['a', 'b'] }];

      expect(normalize(fields, {})).toEqual({ features: [] });
    });

    it('should not touch a simple List field that has items', () => {
      const fields = [{ name: 'tags', widget: 'list' }];
      const content = { 'tags.0': 'foo', 'tags.1': 'bar' };

      expect(normalize(fields, content)).toEqual({ 'tags.0': 'foo', 'tags.1': 'bar' });
    });

    it('should fill in a missing sub-field of an existing Object field', () => {
      const fields = [
        {
          name: 'author',
          widget: 'object',
          fields: [
            { name: 'name', widget: 'string' },
            { name: 'email', widget: 'string' },
          ],
        },
      ];

      expect(normalize(fields, { 'author.name': 'Me' })).toEqual({
        'author.name': 'Me',
        'author.email': '',
      });
    });

    it('should fill in a missing required Object field from its sub-fields', () => {
      const fields = [
        {
          name: 'author',
          widget: 'object',
          fields: [
            { name: 'name', widget: 'string' },
            { name: 'featured', widget: 'boolean', default: true },
          ],
        },
      ];

      expect(normalize(fields, {})).toEqual({
        'author.name': '',
        'author.featured': true,
      });
    });

    it('should fill in a missing optional Object field with null', () => {
      const fields = [
        {
          name: 'author',
          widget: 'object',
          required: false,
          fields: [{ name: 'name', widget: 'string' }],
        },
      ];

      expect(normalize(fields, {})).toEqual({ author: null });
    });

    it('should not fill in sub-fields of a collapsed optional Object field', () => {
      const fields = [
        {
          name: 'author',
          widget: 'object',
          required: false,
          fields: [{ name: 'name', widget: 'string' }],
        },
      ];

      expect(normalize(fields, { author: null })).toEqual({ author: null });
    });

    it('should fill in sub-fields of an Object field with variable types', () => {
      const fields = [
        {
          name: 'block',
          widget: 'object',
          types: [
            {
              name: 'text',
              fields: [
                { name: 'body', widget: 'string' },
                { name: 'align', widget: 'string' },
              ],
            },
            { name: 'image', fields: [{ name: 'src', widget: 'image' }] },
          ],
        },
      ];

      expect(normalize(fields, { 'block.type': 'text', 'block.body': 'Hi' })).toEqual({
        'block.type': 'text',
        'block.body': 'Hi',
        'block.align': '',
      });
    });

    it('should ignore an Object field with an unknown variable type', () => {
      const fields = [
        {
          name: 'block',
          widget: 'object',
          types: [{ name: 'text', fields: [{ name: 'body', widget: 'string' }] }],
        },
      ];

      expect(normalize(fields, { 'block.type': 'video' })).toEqual({ 'block.type': 'video' });
    });

    it('should fill in a missing sub-field in every existing List item', () => {
      const fields = [
        {
          name: 'colors',
          widget: 'list',
          fields: [
            { name: 'colorName', widget: 'string', required: false },
            { name: 'colorCode', widget: 'color' },
          ],
        },
      ];

      const content = {
        'colors.0.colorName': 'Black',
        'colors.1.colorName': 'White',
      };

      expect(normalize(fields, content)).toEqual({
        'colors.0.colorName': 'Black',
        'colors.1.colorName': 'White',
        'colors.0.colorCode': '',
        'colors.1.colorCode': '',
      });
    });

    it('should not touch an empty List field with sub-fields', () => {
      const fields = [
        {
          name: 'colors',
          widget: 'list',
          fields: [{ name: 'colorName', widget: 'string' }],
        },
      ];

      expect(normalize(fields, { colors: [] })).toEqual({ colors: [] });
    });

    it('should fill in a missing sub-field in a nested List item', () => {
      const fields = [
        {
          name: 'colors',
          widget: 'list',
          fields: [
            { name: 'colorName', widget: 'string' },
            {
              name: 'images',
              widget: 'list',
              fields: [
                { name: 'image', widget: 'image' },
                { name: 'alt', widget: 'string' },
              ],
            },
          ],
        },
      ];

      const content = {
        'colors.0.colorName': 'Black',
        'colors.0.images.0.image': '/black.jpg',
      };

      expect(normalize(fields, content)).toEqual({
        'colors.0.colorName': 'Black',
        'colors.0.images.0.image': '/black.jpg',
        'colors.0.images.0.alt': '',
      });
    });

    it('should fill in a missing sub-field of a single-subfield List item', () => {
      const fields = [
        {
          name: 'authors',
          widget: 'list',
          field: {
            name: 'author',
            widget: 'object',
            fields: [
              { name: 'name', widget: 'string' },
              { name: 'email', widget: 'string' },
            ],
          },
        },
      ];

      expect(normalize(fields, { 'authors.0.name': 'Me' })).toEqual({
        'authors.0.name': 'Me',
        'authors.0.email': '',
      });
    });

    it('should not touch a single-subfield List of scalars', () => {
      const fields = [
        { name: 'authors', widget: 'list', field: { name: 'author', widget: 'string' } },
      ];

      expect(normalize(fields, { 'authors.0': 'Me' })).toEqual({ 'authors.0': 'Me' });
    });

    it('should fill in sub-fields of List items with variable types', () => {
      const fields = [
        {
          name: 'blocks',
          widget: 'list',
          typeKey: 'kind',
          types: [
            {
              name: 'text',
              fields: [
                { name: 'body', widget: 'string' },
                { name: 'align', widget: 'string' },
              ],
            },
            { name: 'image', fields: [{ name: 'src', widget: 'image' }] },
          ],
        },
      ];

      const content = {
        'blocks.0.kind': 'text',
        'blocks.0.body': 'Hi',
        'blocks.1.kind': 'image',
        'blocks.1.src': '/a.jpg',
      };

      expect(normalize(fields, content)).toEqual({
        'blocks.0.kind': 'text',
        'blocks.0.body': 'Hi',
        'blocks.0.align': '',
        'blocks.1.kind': 'image',
        'blocks.1.src': '/a.jpg',
      });
    });

    it('should not touch an existing KeyValue field', () => {
      const fields = [{ name: 'meta', widget: 'keyvalue' }];

      expect(normalize(fields, { 'meta.foo': 'bar' })).toEqual({ 'meta.foo': 'bar' });
    });

    describe('type checks', () => {
      it('should stringify a non-string value stored in a string-like field', () => {
        const fields = [
          { name: 'title', widget: 'string' },
          { name: 'body', widget: 'text' },
          { name: 'intro', widget: 'markdown' },
          { name: 'outro', widget: 'richtext' },
          { name: 'date', widget: 'datetime' },
        ];

        const content = {
          title: 42,
          body: true,
          intro: 3.14,
          outro: null,
          date: 2024,
        };

        expect(normalize(fields, content)).toEqual({
          title: '42',
          body: 'true',
          intro: '3.14',
          outro: '',
          date: '2024',
        });
      });

      it('should discard an object stored in a string field', () => {
        const fields = [{ name: 'title', widget: 'string' }];

        // `flatten()` turns `{ title: { a: 1 } }` into this
        expect(normalize(fields, { 'title.a': 1 })).toEqual({ title: '' });
      });

      it('should discard an empty object or array stored in a string field', () => {
        const fields = [
          { name: 'title', widget: 'string' },
          { name: 'body', widget: 'text' },
        ];

        expect(normalize(fields, { title: {}, body: [] })).toEqual({ title: '', body: '' });
      });

      it('should keep the first item when a list is stored in a single-value field', () => {
        const fields = [
          { name: 'title', widget: 'string' },
          { name: 'category', widget: 'select', options: ['a', 'b'] },
        ];

        const content = {
          'title.0': 'First',
          'title.1': 'Second',
          'category.0': 'a',
        };

        expect(normalize(fields, content)).toEqual({ title: 'First', category: 'a' });
      });

      it('should keep a numeric value in a Select field', () => {
        const fields = [{ name: 'rating', widget: 'select', options: [1, 2, 3] }];

        expect(normalize(fields, { rating: 2 })).toEqual({ rating: 2 });
      });

      it('should coerce a boolean-like string in a Boolean field', () => {
        const fields = [
          { name: 'a', widget: 'boolean' },
          { name: 'b', widget: 'boolean' },
        ];

        expect(normalize(fields, { a: 'true', b: 'False' })).toEqual({ a: true, b: false });
      });

      it('should fall back to the default value for an unusable Boolean value', () => {
        const fields = [
          { name: 'draft', widget: 'boolean', default: true },
          { name: 'featured', widget: 'boolean' },
        ];

        expect(normalize(fields, { draft: 'yes', featured: 1 })).toEqual({
          draft: true,
          featured: false,
        });
      });

      it('should coerce a numeric string in a Number field', () => {
        const fields = [
          { name: 'count', widget: 'number' },
          { name: 'ratio', widget: 'number', value_type: 'float' },
        ];

        expect(normalize(fields, { count: ' 42 ', ratio: '3.14' })).toEqual({
          count: 42,
          ratio: 3.14,
        });
      });

      it('should keep a null value in a Number field', () => {
        const fields = [{ name: 'count', widget: 'number' }];

        expect(normalize(fields, { count: null })).toEqual({ count: null });
      });

      it('should fall back to the default value for an unusable Number value', () => {
        const fields = [
          { name: 'count', widget: 'number' },
          { name: 'total', widget: 'number' },
          { name: 'ratio', widget: 'number' },
        ];

        expect(normalize(fields, { count: 'many', total: '', ratio: true })).toEqual({
          count: null,
          total: null,
          ratio: null,
        });
      });

      it('should keep any primitive in a string-typed Number field', () => {
        const fields = [{ name: 'count', widget: 'number', value_type: 'int/string' }];

        expect(normalize(fields, { count: 'many' })).toEqual({ count: 'many' });
      });

      it('should turn a single value stored in a List field into the sole item', () => {
        // https://github.com/decaporg/decap-cms/issues/3524
        const fields = [
          { name: 'tags', widget: 'list' },
          { name: 'authors', widget: 'select', multiple: true, options: ['a', 'b'] },
        ];

        expect(normalize(fields, { tags: 'news', authors: 'a' })).toEqual({
          'tags.0': 'news',
          'authors.0': 'a',
        });
      });

      it('should discard a single value stored in a List field with sub-fields', () => {
        const fields = [
          { name: 'tags', widget: 'list', fields: [{ name: 'name', widget: 'string' }] },
        ];

        expect(normalize(fields, { tags: 'news' })).toEqual({ tags: [] });
      });

      it('should discard an object stored in a List field', () => {
        const fields = [{ name: 'tags', widget: 'list' }];

        expect(normalize(fields, { 'tags.name': 'news' })).toEqual({ tags: [] });
      });

      it('should discard a scalar list item where an object is expected', () => {
        // https://github.com/decaporg/decap-cms/issues/836
        const fields = [
          {
            name: 'tags',
            widget: 'list',
            fields: [
              { name: 'name', widget: 'string' },
              { name: 'slug', widget: 'string' },
            ],
          },
        ];

        const content = { 'tags.0': 'news', 'tags.1.name': 'sports' };

        expect(normalize(fields, content)).toEqual({
          'tags.0.name': '',
          'tags.0.slug': '',
          'tags.1.name': 'sports',
          'tags.1.slug': '',
        });
      });

      it('should drop a scalar stored alongside List items', () => {
        const fields = [{ name: 'tags', widget: 'list' }];

        expect(normalize(fields, { tags: 'news', 'tags.0': 'sports' })).toEqual({
          'tags.0': 'sports',
        });
      });

      it('should discard a scalar stored in an Object field', () => {
        const fields = [
          {
            name: 'author',
            widget: 'object',
            fields: [{ name: 'name', widget: 'string' }],
          },
        ];

        expect(normalize(fields, { author: 'Me' })).toEqual({ 'author.name': '' });
      });

      it('should drop a scalar stored alongside Object sub-values', () => {
        // `unflatten()` would otherwise let `author` win and throw `author.name` away
        const fields = [
          {
            name: 'author',
            widget: 'object',
            fields: [
              { name: 'name', widget: 'string' },
              { name: 'email', widget: 'string' },
            ],
          },
        ];

        const content = { author: 'Me', 'author.name': 'Me' };

        expect(normalize(fields, content)).toEqual({
          'author.name': 'Me',
          'author.email': '',
        });
      });

      it('should keep an empty array placeholder stored alongside List items', () => {
        // Unlike a scalar, `unflatten()` fills an empty array in from the child key paths
        const fields = [{ name: 'tags', widget: 'list' }];
        const content = { tags: [], 'tags.0': 'news' };

        expect(normalize(fields, content)).toEqual(content);
      });

      it('should keep the Code field’s empty object placeholder', () => {
        const fields = [{ name: 'snippet', widget: 'code' }];
        const content = { snippet: {}, 'snippet.code': 'a', 'snippet.lang': 'js' };

        expect(normalize(fields, content)).toEqual(content);
      });

      it('should not touch a Hidden field holding an arbitrary value', () => {
        const fields = [{ name: 'meta', widget: 'hidden' }];

        expect(normalize(fields, { 'meta.0.a': 1 })).toEqual({ 'meta.0.a': 1 });
      });

      it('should not touch a custom field type', () => {
        const fields = [{ name: 'chart', widget: 'my-custom-widget' }];

        expect(normalize(fields, { chart: 42 })).toEqual({ chart: 42 });
      });
    });

    describe('with `fillDefaults: false`', () => {
      /**
       * Call {@link normalizeContent} in shape-only mode, as rich text editor components do.
       * @param {any[]} fields Field list.
       * @param {any} content Flattened content.
       * @returns {any} Normalized content.
       */
      const reconcileOnly = (fields, content) =>
        normalizeContent({
          fields,
          content,
          locale: '_default',
          defaultLocale: '_default',
          fillDefaults: false,
        });

      it('should leave a missing field missing', () => {
        const fields = [
          { name: 'title', widget: 'string' },
          { name: 'draft', widget: 'boolean', default: true },
        ];

        expect(reconcileOnly(fields, { title: 'Hello' })).toEqual({ title: 'Hello' });
      });

      it('should not fill in missing sub-fields of an existing Object field', () => {
        const fields = [
          {
            name: 'author',
            widget: 'object',
            fields: [
              { name: 'name', widget: 'string' },
              { name: 'email', widget: 'string' },
            ],
          },
        ];

        expect(reconcileOnly(fields, { 'author.name': 'Me' })).toEqual({ 'author.name': 'Me' });
      });

      it('should still reconcile a value of the wrong shape', () => {
        const fields = [
          { name: 'tags', widget: 'list' },
          { name: 'title', widget: 'string' },
        ];

        expect(reconcileOnly(fields, { tags: 'news', title: 42 })).toEqual({
          'tags.0': 'news',
          title: '42',
        });
      });

      it('should discard an unusable value without replacing it', () => {
        const fields = [{ name: 'title', widget: 'string' }];

        expect(reconcileOnly(fields, { 'title.a': 1 })).toEqual({});
      });
    });

    it('should skip non-i18n fields in a non-default locale', () => {
      const fields = [
        { name: 'title', widget: 'string', i18n: true },
        { name: 'slug', widget: 'string' },
        { name: 'hidden', widget: 'string', i18n: 'none' },
      ];

      const content = normalizeContent({
        fields,
        content: {},
        locale: 'ja',
        defaultLocale: 'en',
      });

      expect(content).toEqual({ title: '' });
    });

    it('should copy a duplicate-i18n field from the default locale', () => {
      const fields = [
        {
          name: 'author',
          widget: 'object',
          i18n: 'duplicate',
          fields: [{ name: 'name', widget: 'string' }],
        },
      ];

      const content = normalizeContent({
        fields,
        content: {},
        locale: 'ja',
        defaultLocale: 'en',
        defaultLocaleContent: { 'author.name': 'Me' },
      });

      expect(content).toEqual({ 'author.name': 'Me' });
    });

    it('should fall back to the default value when the default locale has nothing to copy', () => {
      const fields = [{ name: 'draft', widget: 'boolean', i18n: 'duplicate', default: true }];

      const content = normalizeContent({
        fields,
        content: {},
        locale: 'ja',
        defaultLocale: 'en',
        defaultLocaleContent: {},
      });

      expect(content).toEqual({ draft: true });
    });
  });

  describe('normalizeContentMap', () => {
    it('should normalize the default locale first so duplicate fields can mirror it', () => {
      const fields = [
        { name: 'title', widget: 'string', i18n: true },
        { name: 'category', widget: 'string', i18n: 'duplicate', default: 'news' },
      ];

      const contentMap = {
        ja: { title: 'こんにちは' },
        en: { title: 'Hello', category: 'blog' },
      };

      expect(normalizeContentMap({ fields, contentMap, defaultLocale: 'en' })).toEqual({
        en: { title: 'Hello', category: 'blog' },
        ja: { title: 'こんにちは', category: 'blog' },
      });
    });

    it('should handle a missing default locale', () => {
      const fields = [{ name: 'title', widget: 'string', i18n: true }];
      const contentMap = { ja: {} };

      expect(normalizeContentMap({ fields, contentMap, defaultLocale: 'en' })).toEqual({
        ja: { title: '' },
      });
    });
  });
});
