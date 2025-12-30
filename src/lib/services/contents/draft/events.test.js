import { fromJS, isMap } from 'immutable';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  callEventHooks,
  eventHookRegistry,
  SUPPORTED_EVENT_TYPES,
  UPDATABLE_EVENT_TYPES,
} from './events';

// Mock dependencies
vi.mock('svelte/store', () => ({
  get: vi.fn(),
}));

vi.mock('$lib/services/contents/entry/assets', () => ({
  getAssociatedAssets: vi.fn(),
}));

vi.mock('$lib/services/user', () => ({
  user: {},
}));

const { get } = await import('svelte/store');
const { getAssociatedAssets } = await import('$lib/services/contents/entry/assets');

/**
 * Tests use simplified test objects that don't match full type definitions.
 * Type errors are suppressed below as they are expected for unit test mocks.
 */
describe('events module', () => {
  describe('SUPPORTED_EVENT_TYPES', () => {
    it('should contain all expected event types', async () => {
      expect(SUPPORTED_EVENT_TYPES).toEqual([
        'preSave',
        'postSave',
        'prePublish',
        'postPublish',
        'preUnpublish',
        'postUnpublish',
      ]);
    });

    it('should have the correct length', async () => {
      expect(SUPPORTED_EVENT_TYPES).toHaveLength(6);
    });
  });

  describe('UPDATABLE_EVENT_TYPES', () => {
    it('should contain only preSave and prePublish', async () => {
      expect(UPDATABLE_EVENT_TYPES).toEqual(['preSave', 'prePublish']);
    });

    it('should only include preSave and prePublish', async () => {
      expect(UPDATABLE_EVENT_TYPES).toHaveLength(2);
      expect(UPDATABLE_EVENT_TYPES).toContain('preSave');
      expect(UPDATABLE_EVENT_TYPES).toContain('prePublish');
    });
  });

  describe('eventHookRegistry', () => {
    it('should be a Set', async () => {
      expect(eventHookRegistry).toBeInstanceOf(Set);
    });

    it('should start empty', async () => {
      expect(eventHookRegistry.size).toBe(0);
    });
  });

  describe('callEventHooks', () => {
    beforeEach(() => {
      // Clear the registry before each test
      eventHookRegistry.clear();

      // Mock user store
      vi.mocked(get).mockReturnValue({
        login: 'testuser',
        name: 'Test User',
      });

      // Mock getAssociatedAssets
      vi.mocked(getAssociatedAssets).mockReturnValue([]);
    });

    afterEach(() => {
      vi.clearAllMocks();
      eventHookRegistry.clear();
    });

    it('should call hooks with matching event type', async () => {
      const handler = vi.fn();
      const listener = /** @type {any} */ ({ name: 'preSave', handler });

      eventHookRegistry.add(listener);

      const draft = {
        collection: {
          _i18n: { defaultLocale: 'en' },
        },
        collectionFile: null,
        isNew: true,
        collectionName: 'posts',
        fileName: null,
      };

      const savingEntry = {
        slug: 'test-post',
        locales: {
          en: {
            content: { title: 'Test', body: 'Content' },
            path: 'posts/test-post.md',
          },
        },
      };

      // @ts-expect-error - test object simplified for mocking
      await callEventHooks({ type: 'preSave', draft, savingEntry });
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          author: {
            login: 'testuser',
            name: 'Test User',
          },
          entry: expect.any(Object),
        }),
      );
    });

    it('should not call hooks with non-matching event type', async () => {
      const handler = vi.fn();
      const listener = /** @type {any} */ ({ name: 'postSave', handler });

      eventHookRegistry.add(listener);

      const draft = {
        collection: {
          _i18n: { defaultLocale: 'en' },
        },
        collectionFile: null,
        isNew: true,
        collectionName: 'posts',
        fileName: null,
      };

      const savingEntry = {
        slug: 'test-post',
        locales: {
          en: {
            content: { title: 'Test' },
            path: 'posts/test-post.md',
          },
        },
      };

      // @ts-expect-error
      await callEventHooks({ type: 'preSave', draft, savingEntry });

      expect(handler).not.toHaveBeenCalled();
    });

    it('should call all hooks that match the event type', async () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      const handler3 = vi.fn();

      eventHookRegistry.add({ name: 'preSave', handler: handler1 });
      eventHookRegistry.add({ name: 'preSave', handler: handler2 });
      eventHookRegistry.add({ name: 'postSave', handler: handler3 });

      const draft = {
        collection: {
          _i18n: { defaultLocale: 'en' },
        },
        collectionFile: null,
        isNew: true,
        collectionName: 'posts',
        fileName: null,
      };

      const savingEntry = {
        slug: 'test-post',
        locales: {
          en: {
            content: { title: 'Test' },
            path: 'posts/test-post.md',
          },
        },
      };

      // @ts-expect-error
      await callEventHooks({ type: 'preSave', draft, savingEntry });

      expect(handler1).toHaveBeenCalledOnce();
      expect(handler2).toHaveBeenCalledOnce();
      expect(handler3).not.toHaveBeenCalled();
    });

    it('should use collectionFile i18n settings when available', async () => {
      const handler = vi.fn();

      eventHookRegistry.add({ name: 'preSave', handler });

      const draft = {
        collection: {
          _i18n: { defaultLocale: 'en' },
        },
        collectionFile: {
          _i18n: { defaultLocale: 'ja' },
        },
        isNew: true,
        collectionName: 'posts',
        fileName: 'index',
      };

      const savingEntry = {
        slug: 'test-post',
        locales: {
          ja: {
            content: { title: 'テスト' },
            path: 'posts/index.md',
          },
        },
      };

      // @ts-expect-error
      await callEventHooks({ type: 'preSave', draft, savingEntry });

      expect(handler).toHaveBeenCalledOnce();

      const callArgs = handler.mock.calls[0][0];
      const entryMap = callArgs.entry;

      // Verify entry has the expected structure
      expect(isMap(entryMap)).toBe(true);
      expect(entryMap.get('slug')).toBe('test-post');
      expect(entryMap.get('collection')).toBe('posts');
      expect(entryMap.get('newRecord')).toBe(true);
    });

    it('should handle multiple locales', async () => {
      const handler = vi.fn();

      eventHookRegistry.add({ name: 'preSave', handler });

      const draft = {
        collection: {
          _i18n: { defaultLocale: 'en' },
        },
        collectionFile: null,
        isNew: false,
        collectionName: 'posts',
        fileName: null,
      };

      const savingEntry = {
        slug: 'test-post',
        locales: {
          en: {
            content: { title: 'Test', body: 'Content' },
            path: 'posts/test-post.md',
          },
          ja: {
            content: { title: 'テスト', body: '内容' },
            path: 'posts/test-post.ja.md',
          },
          fr: {
            content: { title: 'Test', body: 'Contenu' },
            path: 'posts/test-post.fr.md',
          },
        },
      };

      // @ts-expect-error
      await callEventHooks({ type: 'preSave', draft, savingEntry });

      expect(handler).toHaveBeenCalledOnce();

      const callArgs = handler.mock.calls[0][0];
      const entryMap = callArgs.entry;
      const i18n = entryMap.get('i18n');

      expect(i18n.get('ja')).toBeDefined();
      expect(i18n.get('fr')).toBeDefined();
      expect(i18n.get('en')).toBeUndefined(); // en is the default locale
    });

    it('should include user information in handler arguments', async () => {
      const handler = vi.fn();

      eventHookRegistry.add({ name: 'preSave', handler });

      vi.mocked(get).mockReturnValue({
        login: 'john.doe',
        name: 'John Doe',
      });

      const draft = {
        collection: {
          _i18n: { defaultLocale: 'en' },
        },
        collectionFile: null,
        isNew: true,
        collectionName: 'posts',
        fileName: null,
      };

      const savingEntry = {
        slug: 'test-post',
        locales: {
          en: {
            content: { title: 'Test' },
            path: 'posts/test-post.md',
          },
        },
      };

      // @ts-expect-error - test object simplified for mocking
      await callEventHooks({ type: 'preSave', draft, savingEntry });

      const callArgs = handler.mock.calls[0][0];

      expect(callArgs.author).toEqual({
        login: 'john.doe',
        name: 'John Doe',
      });
    });

    it('should use default author values when user info is missing', async () => {
      const handler = vi.fn();

      eventHookRegistry.add({ name: 'preSave', handler });

      vi.mocked(get).mockReturnValue({});

      const draft = {
        collection: {
          _i18n: { defaultLocale: 'en' },
        },
        collectionFile: null,
        isNew: true,
        collectionName: 'posts',
        fileName: null,
      };

      const savingEntry = {
        slug: 'test-post',
        locales: {
          en: {
            content: { title: 'Test' },
            path: 'posts/test-post.md',
          },
        },
      };

      // @ts-expect-error
      await callEventHooks({ type: 'preSave', draft, savingEntry });

      const callArgs = handler.mock.calls[0][0];

      expect(callArgs.author).toEqual({
        login: '',
        name: '',
      });
    });

    it('should include associated assets in the entry', async () => {
      const handler = vi.fn();

      eventHookRegistry.add({ name: 'preSave', handler });

      const mockAssets = [
        {
          sha: 'abc123',
          file: new File(['content'], 'image.jpg'),
          size: 1024,
          blobURL: 'blob:http://localhost/123',
          name: 'image.jpg',
          path: '/images/image.jpg',
        },
        {
          sha: 'def456',
          file: new File(['content'], 'document.pdf'),
          size: 2048,
          blobURL: 'blob:http://localhost/456',
          name: 'document.pdf',
          path: '/documents/document.pdf',
        },
      ];

      // @ts-expect-error - test object simplified for mocking
      vi.mocked(getAssociatedAssets).mockReturnValue(mockAssets);

      const draft = {
        collection: {
          _i18n: { defaultLocale: 'en' },
        },
        collectionFile: null,
        isNew: true,
        collectionName: 'posts',
        fileName: null,
      };

      const savingEntry = {
        slug: 'test-post',
        locales: {
          en: {
            content: { title: 'Test' },
            path: 'posts/test-post.md',
          },
        },
      };

      // @ts-expect-error
      await callEventHooks({ type: 'preSave', draft, savingEntry });

      const callArgs = handler.mock.calls[0][0];
      const entryMap = callArgs.entry;
      const mediaFiles = entryMap.get('mediaFiles');

      expect(mediaFiles.size).toBe(2);

      const firstFile = mediaFiles.get(0);

      // firstFile is an Immutable.js Map
      expect(firstFile.get('id')).toBe('abc123');
      expect(firstFile.get('name')).toBe('image.jpg');
      expect(firstFile.get('path')).toBe('/images/image.jpg');
      expect(firstFile.get('file')).toBeInstanceOf(File);
      expect(firstFile.get('size')).toBe(1024);
      expect(firstFile.get('url')).toBe('blob:http://localhost/123');
      expect(firstFile.get('displayURL')).toBe('blob:http://localhost/123');
    });

    it('should create Immutable.js Map for entry object', async () => {
      const handler = vi.fn();

      eventHookRegistry.add({ name: 'preSave', handler });

      const draft = {
        collection: {
          _i18n: { defaultLocale: 'en' },
        },
        collectionFile: null,
        isNew: true,
        collectionName: 'posts',
        fileName: null,
      };

      const savingEntry = {
        slug: 'test-post',
        locales: {
          en: {
            content: { title: 'Test' },
            path: 'posts/test-post.md',
          },
        },
      };

      // @ts-expect-error
      await callEventHooks({ type: 'preSave', draft, savingEntry });

      const callArgs = handler.mock.calls[0][0];

      expect(isMap(callArgs.entry)).toBe(true);
    });

    it('should update entry content when preSave handler returns modified Immutable Map', async () => {
      const modifiedEntry = fromJS({
        data: { title: 'Modified Title', body: 'Modified Body' },
        i18n: {},
      });

      const handler = vi.fn().mockReturnValue(modifiedEntry);

      eventHookRegistry.add({ name: 'preSave', handler });

      const draft = {
        collection: {
          _i18n: { defaultLocale: 'en' },
        },
        collectionFile: null,
        isNew: true,
        collectionName: 'posts',
        fileName: null,
      };

      const savingEntry = {
        slug: 'test-post',
        locales: {
          en: {
            content: { title: 'Original Title', body: 'Original Body' },
            path: 'posts/test-post.md',
          },
        },
      };

      // @ts-expect-error
      await callEventHooks({ type: 'preSave', draft, savingEntry });

      // The content should be updated with flattened modified data
      expect(savingEntry.locales.en.content).toEqual({
        title: 'Modified Title',
        body: 'Modified Body',
      });
    });

    it('should update all locales when preSave handler modifies i18n data', async () => {
      const modifiedEntry = fromJS({
        data: { title: 'Modified Title' },
        i18n: {
          ja: { data: { title: 'モディファイド・タイトル' } },
          fr: { data: { title: 'Titre Modifié' } },
        },
      });

      const handler = vi.fn().mockReturnValue(modifiedEntry);

      eventHookRegistry.add({ name: 'preSave', handler });

      const draft = {
        collection: {
          _i18n: { defaultLocale: 'en' },
        },
        collectionFile: null,
        isNew: false,
        collectionName: 'posts',
        fileName: null,
      };

      const savingEntry = {
        slug: 'test-post',
        locales: {
          en: {
            content: { title: 'Original Title' },
            path: 'posts/test-post.md',
          },
          ja: {
            content: { title: '元のタイトル' },
            path: 'posts/test-post.ja.md',
          },
          fr: {
            content: { title: 'Titre Original' },
            path: 'posts/test-post.fr.md',
          },
        },
      };

      // @ts-expect-error
      await callEventHooks({ type: 'preSave', draft, savingEntry });

      expect(savingEntry.locales.en.content).toEqual({ title: 'Modified Title' });
      expect(savingEntry.locales.ja.content).toEqual({ title: 'モディファイド・タイトル' });
      expect(savingEntry.locales.fr.content).toEqual({ title: 'Titre Modifié' });
    });

    it('should handle simple object return from preSave handler', async () => {
      // Create an Immutable Map that converts to a plain object
      // (this simulates what happens when a hook returns a modified entry)
      const modifiedMap = fromJS({ title: 'Modified Title', body: 'Modified Body' });
      const handler = vi.fn().mockReturnValue(modifiedMap);

      eventHookRegistry.add({ name: 'preSave', handler });

      const draft = {
        collection: {
          _i18n: { defaultLocale: 'en' },
        },
        collectionFile: null,
        isNew: true,
        collectionName: 'posts',
        fileName: null,
      };

      const savingEntry = {
        slug: 'test-post',
        locales: {
          en: {
            content: { title: 'Original Title', body: 'Original Body' },
            path: 'posts/test-post.md',
          },
        },
      };

      // @ts-expect-error
      await callEventHooks({ type: 'preSave', draft, savingEntry });

      // When a simple object (not containing data/i18n) is returned as Map,
      // it should flatten and update the content
      expect(savingEntry.locales.en.content).toEqual({
        title: 'Modified Title',
        body: 'Modified Body',
      });
    });

    it('should not modify entry content for non-modifiable event types', async () => {
      const modifiedEntry = fromJS({
        data: { title: 'Modified Title' },
        i18n: {},
      });

      const handler = vi.fn().mockReturnValue(modifiedEntry);

      eventHookRegistry.add({ name: 'postSave', handler });

      const draft = {
        collection: {
          _i18n: { defaultLocale: 'en' },
        },
        collectionFile: null,
        isNew: false,
        collectionName: 'posts',
        fileName: null,
      };

      const savingEntry = {
        slug: 'test-post',
        locales: {
          en: {
            content: { title: 'Original Title' },
            path: 'posts/test-post.md',
          },
        },
      };

      const originalContent = { ...savingEntry.locales.en.content };

      // @ts-expect-error
      await callEventHooks({ type: 'postSave', draft, savingEntry });

      // Content should remain unchanged for postSave events (not in UPDATABLE_EVENT_TYPES)
      expect(savingEntry.locales.en.content).toEqual(originalContent);
    });

    it('should modify entry content for prePublish event', async () => {
      const modifiedEntry = fromJS({
        data: { title: 'Modified Title' },
        i18n: {},
      });

      const handler = vi.fn().mockReturnValue(modifiedEntry);

      eventHookRegistry.add({ name: 'prePublish', handler });

      const draft = {
        collection: {
          _i18n: { defaultLocale: 'en' },
        },
        collectionFile: null,
        isNew: false,
        collectionName: 'posts',
        fileName: null,
      };

      const savingEntry = {
        slug: 'test-post',
        locales: {
          en: {
            content: { title: 'Original Title' },
            path: 'posts/test-post.md',
          },
        },
      };

      // @ts-expect-error
      await callEventHooks({ type: 'prePublish', draft, savingEntry });

      // Content should be modified for prePublish events (in UPDATABLE_EVENT_TYPES)
      expect(savingEntry.locales.en.content).toEqual({ title: 'Modified Title' });
    });

    it('should not modify entry content for unmodifiable events like postPublish', async () => {
      const modifiedEntry = fromJS({
        data: { title: 'Modified Title' },
        i18n: {},
      });

      const handler = vi.fn().mockReturnValue(modifiedEntry);

      eventHookRegistry.add({ name: 'postPublish', handler });

      const draft = {
        collection: {
          _i18n: { defaultLocale: 'en' },
        },
        collectionFile: null,
        isNew: false,
        collectionName: 'posts',
        fileName: null,
      };

      const savingEntry = {
        slug: 'test-post',
        locales: {
          en: {
            content: { title: 'Original Title' },
            path: 'posts/test-post.md',
          },
        },
      };

      const originalContent = { ...savingEntry.locales.en.content };

      // @ts-expect-error
      await callEventHooks({ type: 'postPublish', draft, savingEntry });

      // Content should remain unchanged for postPublish events (not in UPDATABLE_EVENT_TYPES)
      expect(savingEntry.locales.en.content).toEqual(originalContent);
    });

    it('should include comprehensive entry metadata in handler', async () => {
      const handler = vi.fn();

      eventHookRegistry.add({ name: 'preSave', handler });

      const draft = {
        collection: {
          _i18n: { defaultLocale: 'en' },
        },
        collectionFile: null,
        isNew: false,
        collectionName: 'posts',
        fileName: null,
      };

      const savingEntry = {
        slug: 'test-post',
        locales: {
          en: {
            content: { title: 'Test', body: 'Content' },
            path: 'posts/test-post.md',
          },
        },
      };

      // @ts-expect-error
      await callEventHooks({ type: 'preSave', draft, savingEntry });

      const callArgs = handler.mock.calls[0][0];
      const entryMap = callArgs.entry;

      expect(entryMap.get('slug')).toBe('test-post');
      expect(entryMap.get('path')).toBe('posts/test-post.md');
      expect(entryMap.get('collection')).toBe('posts');
      expect(entryMap.get('newRecord')).toBe(false);

      // meta is also an Immutable.js Map
      const meta = entryMap.get('meta');

      expect(meta.get('path')).toBe('posts/test-post.md');
    });

    it('should handle nested and flattened content correctly', async () => {
      const handler = vi.fn();

      eventHookRegistry.add({ name: 'preSave', handler });

      const draft = {
        collection: {
          _i18n: { defaultLocale: 'en' },
        },
        collectionFile: null,
        isNew: true,
        collectionName: 'posts',
        fileName: null,
      };

      const savingEntry = {
        slug: 'test-post',
        locales: {
          en: {
            content: {
              title: 'Test',
              'author.name': 'John Doe',
              'author.email': 'john@example.com',
              'tags.0': 'svelte',
              'tags.1': 'cms',
            },
            path: 'posts/test-post.md',
          },
        },
      };

      // @ts-expect-error
      await callEventHooks({ type: 'preSave', draft, savingEntry });

      const callArgs = handler.mock.calls[0][0];
      const entryMap = callArgs.entry;
      const data = entryMap.get('data');

      // Data is an Immutable.js Map with unflattened structure
      expect(data.get('title')).toBe('Test');

      const author = data.get('author');

      expect(author.get('name')).toBe('John Doe');
      expect(author.get('email')).toBe('john@example.com');

      const tags = data.get('tags');

      expect(tags.get(0)).toBe('svelte');
      expect(tags.get(1)).toBe('cms');
    });

    it('should call getAssociatedAssets with correct parameters', async () => {
      const handler = vi.fn();

      eventHookRegistry.add({ name: 'preSave', handler });

      const draft = {
        collection: {
          _i18n: { defaultLocale: 'en' },
        },
        collectionFile: null,
        isNew: true,
        collectionName: 'blog-posts',
        fileName: null,
      };

      const savingEntry = {
        slug: 'test-post',
        locales: {
          en: {
            content: { title: 'Test' },
            path: 'posts/test-post.md',
          },
        },
      };

      // @ts-expect-error
      await callEventHooks({ type: 'preSave', draft, savingEntry });

      expect(getAssociatedAssets).toHaveBeenCalledWith({
        entry: savingEntry,
        collectionName: 'blog-posts',
        fileName: null,
      });
    });

    it('should handle preSave hook returning updated entry with data and i18n', async () => {
      const updatedData = { title: 'Updated Title', body: 'Updated content' };

      const updatedI18n = {
        ja: { data: { title: '更新されたタイトル', body: '更新されたコンテンツ' } },
      };

      const handler = vi.fn(async () =>
        // Return an Immutable.js Map with updated data
        fromJS({
          data: updatedData,
          i18n: updatedI18n,
        }),
      );

      // @ts-expect-error - test mock handler returns modified entry
      eventHookRegistry.add({ name: 'preSave', handler });

      const draft = {
        collection: {
          _i18n: { defaultLocale: 'en' },
        },
        collectionFile: null,
        isNew: false,
        collectionName: 'posts',
        fileName: null,
      };

      const savingEntry = {
        slug: 'test-post',
        locales: {
          en: {
            content: { title: 'Original Title', body: 'Original content' },
            path: 'posts/test-post.md',
          },
          ja: {
            content: { title: '元のタイトル', body: '元のコンテンツ' },
            path: 'posts/test-post.ja.md',
          },
        },
      };

      // @ts-expect-error
      await callEventHooks({ type: 'preSave', draft, savingEntry });

      // Verify the entry data was updated from the hook
      expect(savingEntry.locales.en.content).toEqual(expect.objectContaining(updatedData));
      expect(savingEntry.locales.ja.content).toBeDefined();
    });

    it('should handle preSave hook returning object with only data (no i18n)', async () => {
      const updatedData = { title: 'Updated Title', body: 'Updated content' };

      const handler = vi.fn(async () =>
        // Return an Immutable.js Map with only data property
        fromJS(updatedData),
      );

      // @ts-expect-error - test mock handler returns modified entry
      eventHookRegistry.add({ name: 'preSave', handler });

      const draft = {
        collection: {
          _i18n: { defaultLocale: 'en' },
        },
        collectionFile: null,
        isNew: false,
        collectionName: 'posts',
        fileName: null,
      };

      const savingEntry = {
        slug: 'test-post',
        locales: {
          en: {
            content: { title: 'Original Title', body: 'Original content' },
            path: 'posts/test-post.md',
          },
        },
      };

      // @ts-expect-error
      await callEventHooks({ type: 'preSave', draft, savingEntry });

      // Verify the entry data was updated
      expect(savingEntry.locales.en.content).toEqual(expect.objectContaining(updatedData));
    });

    it('should not update entry for postSave hook even if it returns data', async () => {
      const originalContent = { title: 'Original Title', body: 'Original content' };

      const handler = vi.fn(async () =>
        // postSave is not an UPDATABLE_EVENT_TYPE, so return should be ignored
        fromJS({
          data: { title: 'Updated Title', body: 'Updated content' },
        }),
      );

      // @ts-expect-error - test mock handler returns data for non-updatable event
      eventHookRegistry.add({ name: 'postSave', handler });

      const draft = {
        collection: {
          _i18n: { defaultLocale: 'en' },
        },
        collectionFile: null,
        isNew: false,
        collectionName: 'posts',
        fileName: null,
      };

      const savingEntry = {
        slug: 'test-post',
        locales: {
          en: {
            content: { ...originalContent },
            path: 'posts/test-post.md',
          },
        },
      };

      // @ts-expect-error
      await callEventHooks({ type: 'postSave', draft, savingEntry });

      // Entry should not be modified for non-updatable event types
      expect(savingEntry.locales.en.content).toEqual(originalContent);
    });

    it('should handle hook returning non-Map value for updatable events', async () => {
      const handler = vi.fn(
        async () =>
          // Return null instead of Immutable.js Map
          null,
      );

      // @ts-expect-error - test mock handler returns null
      eventHookRegistry.add({ name: 'preSave', handler });

      const draft = {
        collection: {
          _i18n: { defaultLocale: 'en' },
        },
        collectionFile: null,
        isNew: false,
        collectionName: 'posts',
        fileName: null,
      };

      const originalContent = { title: 'Original Title', body: 'Original content' };

      const savingEntry = {
        slug: 'test-post',
        locales: {
          en: {
            content: { ...originalContent },
            path: 'posts/test-post.md',
          },
        },
      };

      // @ts-expect-error
      await callEventHooks({ type: 'preSave', draft, savingEntry });

      // Entry should not be modified if hook returns non-Map
      expect(savingEntry.locales.en.content).toEqual(originalContent);
    });

    it('should handle prePublish hook returning updated entry', async () => {
      const updatedData = { title: 'Published Title' };

      const handler = vi.fn(async () =>
        fromJS({
          data: updatedData,
          i18n: {},
        }),
      );

      // @ts-expect-error - test mock handler returns modified entry
      eventHookRegistry.add({ name: 'prePublish', handler });

      const draft = {
        collection: {
          _i18n: { defaultLocale: 'en' },
        },
        collectionFile: null,
        isNew: false,
        collectionName: 'posts',
        fileName: null,
      };

      const savingEntry = {
        slug: 'test-post',
        locales: {
          en: {
            content: { title: 'Draft Title', body: 'Content' },
            path: 'posts/test-post.md',
          },
        },
      };

      // @ts-expect-error
      await callEventHooks({ type: 'prePublish', draft, savingEntry });

      expect(handler).toHaveBeenCalledOnce();
    });

    it('should handle partial i18n updates from hook', async () => {
      const handler = vi.fn(async () =>
        // Only provide i18n for ja locale
        fromJS({
          data: { title: 'Updated Title' },
          i18n: {
            ja: { data: { title: '更新されたタイトル' } },
            // fr is not provided, so it should be skipped
          },
        }),
      );

      // @ts-expect-error - test mock handler returns modified entry
      eventHookRegistry.add({ name: 'preSave', handler });

      const draft = {
        collection: {
          _i18n: { defaultLocale: 'en' },
        },
        collectionFile: null,
        isNew: false,
        collectionName: 'posts',
        fileName: null,
      };

      const savingEntry = {
        slug: 'test-post',
        locales: {
          en: {
            content: { title: 'Original Title' },
            path: 'posts/test-post.md',
          },
          ja: {
            content: { title: '元のタイトル' },
            path: 'posts/test-post.ja.md',
          },
          fr: {
            content: { title: 'Titre original' },
            path: 'posts/test-post.fr.md',
          },
        },
      };

      // @ts-expect-error
      await callEventHooks({ type: 'preSave', draft, savingEntry });

      expect(savingEntry.locales.en.content).toEqual({ title: 'Updated Title' });
      expect(savingEntry.locales.ja.content).toEqual({ title: '更新されたタイトル' });
      // fr should remain unchanged as the hook didn't provide an update
      expect(savingEntry.locales.fr.content).toEqual({ title: 'Titre original' });
    });
  });
});
