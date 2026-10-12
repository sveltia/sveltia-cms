/**
 * @import {
 * Asset,
 * AssetFolderInfo,
 * AssetKind,
 * DeployTarget,
 * Entry,
 * ExternalAsset,
 * FlattenedEntryContent,
 * InternalLocaleCode,
 * MediaLibraryService,
 * UnpublishedEntry,
 * } from '$lib/types/private';
 */

// Pure test data builders. This module imports nothing from the app, so a unit test that mocks
// the services can use it as well as a component test. `$lib/test/config` re-exports the builders
// along with the helpers that load data into the app

/**
 * Guess the kind of a file from its name.
 * @param {string} name File name.
 * @returns {AssetKind} Kind.
 */
const getKind = (name) =>
  /** @type {AssetKind} */ (
    { png: 'image', jpg: 'image', mp4: 'video', mp3: 'audio' }[name.split('.').pop() ?? ''] ??
      'document'
  );

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
 * Build an unpublished entry of an entry collection, on an editorial workflow branch named after
 * the collection and the slug, e.g. `cms/posts/hello`.
 * @param {object} [args] Arguments.
 * @param {string} [args.slug] Entry slug.
 * @param {string} [args.status] Workflow status.
 * @param {string} [args.collectionName] Collection name. The entry is stored in the
 * `content/<collectionName>` folder.
 * @param {Record<InternalLocaleCode, FlattenedEntryContent>} [args.content] Flattened content in
 * each locale. Defaults to an empty default locale.
 * @param {Record<string, any>} [args.pullRequest] Any other pull request property, merged into the
 * default `number` and `branch`.
 * @param {Record<string, any>} [args.workflow] Any other workflow property.
 * @param {Partial<UnpublishedEntry>} [args.entry] Any other entry property.
 * @returns {UnpublishedEntry} Entry.
 */
export const createMockWorkflowEntry = ({
  slug = 'hello',
  status = 'draft',
  collectionName = 'posts',
  content = undefined,
  pullRequest = {},
  workflow = {},
  entry = {},
} = {}) =>
  /** @type {UnpublishedEntry} */ (
    createMockEntry({
      slug,
      folder: `content/${collectionName}`,
      content,
      entry: /** @type {Partial<UnpublishedEntry>} */ ({
        ...entry,
        workflow: {
          status,
          collectionName,
          pullRequest: { number: 1, branch: `cms/${collectionName}/${slug}`, ...pullRequest },
          ...workflow,
        },
      }),
    })
  );

/**
 * Build the info of a global asset folder, which isn’t entry-relative and has no template tags.
 * @param {Partial<AssetFolderInfo>} [folder] Any folder property to override, e.g. `internalPath`,
 * `publicPath` or `collectionName`. An explicit `undefined` is kept.
 * @returns {AssetFolderInfo} Folder info.
 */
export const createMockAssetFolder = (folder = {}) => ({
  collectionName: undefined,
  internalPath: 'static/uploads',
  publicPath: '/uploads',
  entryRelative: false,
  hasTemplateTags: false,
  ...folder,
});

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
}) => ({
  name,
  path: `${folderPath}/${name}`,
  sha: name,
  size: file?.size ?? 0,
  kind: getKind(name),
  file: file instanceof File ? file : undefined,
  folder: createMockAssetFolder({
    internalPath: folderPath,
    publicPath: `/${folderPath.replace(/^static\//, '')}`,
  }),
  ...asset,
});

/**
 * URL of an image that loads without any network access: a transparent 1×1 PNG. A thumbnail or
 * preview test uses this rather than an `https:` URL, which fails to load — or loads something else
 * — on a runner with network access, upon which the image is replaced by a fallback icon.
 */
export const TEST_IMAGE_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

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

  return {
    id,
    description: id,
    previewURL: `https://cdn.example.com/${id}`,
    downloadURL: `https://cdn.example.com/${id}`,
    fileName,
    kind: getKind(fileName),
    ...asset,
  };
};

/**
 * Build the target of a deployment status lookup: the head commit of an unpublished entry’s
 * branch, waiting for a deploy preview.
 * @param {Partial<DeployTarget>} [target] Any target property to override.
 * @returns {DeployTarget} Target.
 */
export const createMockDeployTarget = (target = {}) => ({
  sha: 'abc123',
  branch: 'cms/posts/hello',
  kind: 'preview',
  ...target,
});
