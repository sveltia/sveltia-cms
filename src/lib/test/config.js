import { allAssets } from '$lib/services/assets';
import { initCmsConfig } from '$lib/services/config';
import { allEntries } from '$lib/services/contents';
import { collectionCacheMap } from '$lib/services/contents/collection';
import { fieldConfigCacheMap } from '$lib/services/contents/entry/fields';

/**
 * @import {
 * Asset,
 * AssetKind,
 * Entry,
 * ExternalAsset,
 * FlattenedEntryContent,
 * InternalLocaleCode,
 * MediaLibraryService,
 * UnpublishedEntry,
 * } from '$lib/types/private';
 * @import { CmsConfig } from '$lib/types/public';
 */

/**
 * Load a site configuration into the app the way `CMS.init()` does, so the collections, entry
 * folders and asset folders are all set up from it. The `test-repo` backend needs no network.
 * @param {Partial<CmsConfig>} [config] Configuration. The `backend`, `media_folder` and
 * `collections` options have defaults: the collections are a `posts` entry collection with a
 * `title` field, which entries from {@link createMockEntry} belong to.
 * @returns {Promise<void>}
 * @throws {Error} If the configuration is invalid.
 */
export const initTestConfig = async (config = {}) => {
  // The app loads its configuration once, so the collections and fields it resolves are cached for
  // good. A test file loading another configuration has to start over
  collectionCacheMap.clear();
  fieldConfigCacheMap.clear();

  await initCmsConfig(
    /** @type {CmsConfig} */ ({
      load_config_file: false,
      backend: { name: 'test-repo' },
      media_folder: 'static/uploads',
      collections: [
        {
          name: 'posts',
          label: 'Posts',
          folder: 'content/posts',
          fields: [{ name: 'title', widget: 'string' }],
        },
      ],
      ...config,
    }),
  );
};

/**
 * Build an entry of an entry collection.
 * @param {object} args Arguments.
 * @param {string} args.slug Entry slug.
 * @param {string} [args.folder] Folder path of the collection, without the trailing slash.
 * @param {string} [args.extension] File extension.
 * @param {Record<InternalLocaleCode, FlattenedEntryContent>} [args.content] Flattened content in
 * each locale. Defaults to an empty default locale.
 * @param {Partial<UnpublishedEntry>} [args.entry] Any other entry property, including the
 * `workflow` of an unpublished entry.
 * @returns {Entry} Entry.
 */
export const createMockEntry = ({
  slug,
  folder = 'content/posts',
  extension = 'md',
  content = { _default: {} },
  entry = {},
}) => ({
  id: `${folder}/${slug}`,
  slug,
  subPath: slug,
  locales: Object.fromEntries(
    Object.entries(content).map(([locale, localizedContent]) => [
      locale,
      { slug, path: `${folder}/${slug}.${extension}`, content: localizedContent },
    ]),
  ),
  ...entry,
});

/**
 * Replace the entries loaded in the app.
 * @param {Entry[]} entries Entries.
 */
export const setEntries = (entries) => {
  allEntries.current = entries;
};

/**
 * Build an asset in the global asset folder, holding the given file.
 * @param {object} args Arguments.
 * @param {string} args.name File name, e.g. `photo.png`.
 * @param {string} [args.folderPath] Internal path of the asset folder.
 * @param {File | Blob} [args.file] File content. Defaults to an empty file of the kind the name
 * suggests.
 * @param {Partial<Asset>} [args.asset] Any other asset property.
 * @returns {Asset} Asset.
 */
export const createMockAsset = ({
  name,
  folderPath = 'static/uploads',
  file = undefined,
  asset = {},
}) => {
  const kind = /** @type {AssetKind} */ (
    { png: 'image', jpg: 'image', mp4: 'video', mp3: 'audio' }[name.split('.').pop() ?? ''] ??
      'document'
  );

  return {
    name,
    path: `${folderPath}/${name}`,
    sha: name,
    size: file?.size ?? 0,
    kind,
    file: file instanceof File ? file : undefined,
    folder: {
      collectionName: undefined,
      internalPath: folderPath,
      publicPath: `/${folderPath.replace(/^static\//, '')}`,
      entryRelative: false,
      hasTemplateTags: false,
    },
    ...asset,
  };
};

/**
 * Replace the assets loaded in the app.
 * @param {Asset[]} assets Assets.
 */
export const setAssets = (assets) => {
  allAssets.current = assets;
};

/**
 * Build a real, tiny PNG file, for a component that reads the image’s dimensions or shows it.
 * @param {object} [args] Arguments.
 * @param {string} [args.name] File name.
 * @param {number} [args.width] Width in pixels.
 * @param {number} [args.height] Height in pixels.
 * @returns {Promise<File>} File.
 */
export const createMockImageFile = async ({ name = 'photo.png', width = 4, height = 3 } = {}) => {
  const canvas = new OffscreenCanvas(width, height);

  // A context has to exist before the canvas can be encoded
  canvas.getContext('2d');

  return new File([await canvas.convertToBlob({ type: 'image/png' })], name, {
    type: 'image/png',
  });
};

/**
 * Build a cloud storage service that works without any network access or credentials.
 * @param {Partial<MediaLibraryService>} [service] Any service property to override or add, e.g.
 * `upload`, `delete`, `rename` and `replace` functions. None of the operations is supported by
 * default.
 * @returns {MediaLibraryService} Service.
 */
export const createMockCloudService = (service = {}) => ({
  serviceType: 'cloud_storage',
  serviceId: 'test_cloud',
  serviceLabel: 'Test Cloud',
  serviceURL: 'https://cloud.example.com/',
  showServiceLink: false,
  hotlinking: true,
  authType: 'none',
  ...service,
});

/**
 * Build an asset on a cloud storage service.
 * @param {object} args Arguments.
 * @param {string} args.fileName File name, e.g. `photo.png`.
 * @param {string} [args.folder] Folder path on the service, without the trailing slash.
 * @param {Partial<ExternalAsset>} [args.asset] Any other asset property.
 * @returns {ExternalAsset} Asset.
 */
export const createMockExternalAsset = ({ fileName, folder = 'images', asset = {} }) => {
  const id = `${folder}/${fileName}`;

  const kind = /** @type {AssetKind} */ (
    { png: 'image', jpg: 'image', mp4: 'video', mp3: 'audio' }[fileName.split('.').pop() ?? ''] ??
      'document'
  );

  return {
    id,
    description: id,
    previewURL: `https://cdn.example.com/${id}`,
    downloadURL: `https://cdn.example.com/${id}`,
    fileName,
    kind,
    ...asset,
  };
};
