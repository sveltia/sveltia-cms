import { beforeEach, describe, expect, it, vi } from 'vitest';

import { cmsConfig } from '$lib/services/config';
import { allEntries } from '$lib/services/contents';
import { isCollectionIndexFile } from '$lib/services/contents/collection/entries/index-file';
import { getCollectionFilesByEntry } from '$lib/services/contents/collection/files';
import { getAssociatedCollections } from '$lib/services/contents/entry';
import { getField } from '$lib/services/contents/entry/fields';

import {
  collectLinkedAssets,
  createLinkedAsset,
  LINKED_FILES_SERVICE_ID,
  linkedAssets,
  linkedFilesService,
} from './linked';

vi.mock('@sveltia/i18n', () => ({
  _: vi.fn((/** @type {string} */ key) => `[${key}]`),
}));

vi.mock('$lib/services/config', () => ({
  cmsConfig: { current: undefined },
}));

vi.mock('$lib/services/contents', () => ({
  allEntries: { current: [] },
}));

vi.mock('$lib/services/contents/collection/entries/index-file', () => ({
  isCollectionIndexFile: vi.fn(() => false),
}));

vi.mock('$lib/services/contents/collection/files', () => ({
  getCollectionFilesByEntry: vi.fn(() => []),
}));

vi.mock('$lib/services/contents/entry', () => ({
  getAssociatedCollections: vi.fn(() => [{ name: 'posts' }]),
}));

vi.mock('$lib/services/contents/entry/fields', () => ({
  getField: vi.fn(),
}));

vi.mock('$lib/services/integrations/media-libraries/cloud', () => ({
  allCloudStorageServices: {
    aws_s3: {
      isEnabled: vi.fn(() => true),
      isAssetURL: vi.fn((/** @type {string} */ url) => url.startsWith('https://my-bucket.s3.')),
    },
    uploadcare: {
      isEnabled: vi.fn(() => false),
      isAssetURL: vi.fn((/** @type {string} */ url) => url.startsWith('https://ucarecdn.com/')),
    },
    custom: {},
  },
}));

/**
 * Create a test entry.
 * @param {Record<string, any>} content Flattened content.
 * @returns {any} Entry.
 */
const createEntry = (content) => ({ id: 'e', locales: { _default: { content } } });

/** Widgets by key path, used by the `getField` mock. */
const widgets = /** @type {Record<string, string | undefined>} */ ({
  title: 'string',
  hero: 'image',
  'docs.0': 'file',
  'docs.1': 'file',
  link: 'string',
  unknown: undefined,
});

describe('assets/external/linked', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cmsConfig.current = undefined;
    vi.mocked(getField).mockImplementation(({ keyPath }) => {
      const widget = widgets[keyPath];

      return widget ? /** @type {any} */ ({ widget }) : undefined;
    });
  });

  describe('createLinkedAsset', () => {
    it('should derive the name and kind from the URL', () => {
      expect(createLinkedAsset('https://cdn.example.com/a/b/photo%201.jpg', false)).toEqual({
        id: 'https://cdn.example.com/a/b/photo%201.jpg',
        description: 'https://cdn.example.com/a/b/photo%201.jpg',
        previewURL: 'https://cdn.example.com/a/b/photo%201.jpg',
        downloadURL: 'https://cdn.example.com/a/b/photo%201.jpg',
        fileName: 'photo 1.jpg',
        kind: 'image',
      });
    });

    it('should treat a URL without an extension as an image when it comes from an Image field', () => {
      expect(createLinkedAsset('https://picsum.photos/200', true).kind).toBe('image');
      expect(createLinkedAsset('https://picsum.photos/200', false).kind).toBe('other');
      expect(createLinkedAsset('https://example.com/report.pdf', true).kind).toBe('document');
    });

    it('should fall back to the URL as the name', () => {
      expect(createLinkedAsset('https://example.com/', false).fileName).toBe(
        'https://example.com/',
      );
      expect(createLinkedAsset('https://example.com/%E0%A4%A', false).fileName).toBe(
        'https://example.com/%E0%A4%A',
      );
    });
  });

  describe('collectLinkedAssets', () => {
    it('should collect URLs from File/Image fields only, once each', () => {
      const entries = [
        createEntry({
          title: 'https://example.com/not-a-file',
          hero: 'https://cdn.example.com/hero.png',
          'docs.0': 'https://cdn.example.com/guide.pdf',
          'docs.1': '/uploads/local.pdf',
          link: 'https://example.com/page',
          unknown: 'https://example.com/unknown.png',
          count: 3,
        }),
        createEntry({ hero: 'https://cdn.example.com/hero.png' }),
      ];

      const assets = collectLinkedAssets(entries);

      expect(assets.map(({ id, kind }) => [id, kind])).toEqual([
        ['https://cdn.example.com/hero.png', 'image'],
        ['https://cdn.example.com/guide.pdf', 'document'],
      ]);
      // Non-URL values are skipped before the field lookup
      expect(getField).not.toHaveBeenCalledWith(expect.objectContaining({ keyPath: 'docs.1' }));
      expect(getField).not.toHaveBeenCalledWith(expect.objectContaining({ keyPath: 'count' }));
    });

    it('should look the field up in each collection file of a file collection', () => {
      vi.mocked(getCollectionFilesByEntry).mockReturnValue(
        /** @type {any} */ ([{ name: 'home' }, { name: 'about' }]),
      );
      vi.mocked(getField).mockImplementation(({ fileName }) =>
        fileName === 'about' ? /** @type {any} */ ({ widget: 'image' }) : undefined,
      );

      const assets = collectLinkedAssets([createEntry({ hero: 'https://cdn.example.com/a' })]);

      expect(assets).toHaveLength(1);
      expect(assets[0].kind).toBe('image');
      expect(getField).toHaveBeenCalledWith(expect.objectContaining({ fileName: 'home' }));
      expect(getField).toHaveBeenCalledWith(expect.objectContaining({ fileName: 'about' }));
      expect(isCollectionIndexFile).toHaveBeenCalled();
      expect(getAssociatedCollections).toHaveBeenCalled();
    });

    it('should skip files on an enabled cloud storage service, which has its own location', () => {
      const assets = collectLinkedAssets([
        createEntry({
          hero: 'https://my-bucket.s3.us-east-1.amazonaws.com/hero.png',
          // Uploadcare is not enabled, so its files are not listed elsewhere
          'docs.0': 'https://ucarecdn.com/uuid/guide.pdf',
        }),
      ]);

      expect(assets.map(({ id }) => id)).toEqual(['https://ucarecdn.com/uuid/guide.pdf']);
    });

    it('should skip URLs under the site’s base URL, which are repository assets', () => {
      cmsConfig.current = /** @type {any} */ ({ _baseURL: 'https://example.com' });

      const assets = collectLinkedAssets([
        createEntry({
          hero: 'https://example.com/uploads/hero.png',
          'docs.0': 'https://cdn.example.com/guide.pdf',
        }),
      ]);

      expect(assets.map(({ id }) => id)).toEqual(['https://cdn.example.com/guide.pdf']);
    });
  });

  describe('linkedFilesService', () => {
    it('should list the linked files of all the entries with a localized label', async () => {
      allEntries.current = [createEntry({ hero: 'https://cdn.example.com/hero.png' })];

      expect(linkedFilesService.serviceId).toBe(LINKED_FILES_SERVICE_ID);
      expect(linkedFilesService.serviceLabel).toBe('[linked_files]');
      expect(linkedFilesService.authType).toBe('none');
      expect(linkedFilesService.upload).toBeUndefined();
      expect(linkedFilesService.delete).toBeUndefined();
      expect(linkedAssets.current).toHaveLength(1);
      expect(await linkedFilesService.list?.({ apiKey: '' })).toEqual(linkedAssets.current);
    });
  });
});
