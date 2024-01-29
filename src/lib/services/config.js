import { _ } from 'svelte-i18n';
import { get, writable } from 'svelte/store';
import YAML from 'yaml';
import { allAssetFolders } from '$lib/services/assets';
import { allBackendServices } from '$lib/services/backends';
import { allEntryFolders, getCollection, selectedCollection } from '$lib/services/contents';
import { prefs } from '$lib/services/prefs';
import { isObject } from '$lib/services/utils/misc';
import { stripSlashes } from '$lib/services/utils/strings';

/**
 * @type {import('svelte/store').Writable<SiteConfig | undefined>}
 */
export const siteConfig = writable();

const { DEV, VITE_SITE_URL } = import.meta.env;

/**
 * Validate the site configuration file.
 * @param {SiteConfig} config - Config object.
 * @throws {Error} If there is an error in the config.
 * @see https://decapcms.org/docs/configuration-options/
 * @todo Add more validations.
 */
const validate = (config) => {
  if (!isObject(config)) {
    throw new Error(get(_)('config.error.parse_failed'), {
      cause: new Error(get(_)('config.error.parse_failed_invalid_object')),
    });
  }

  if (!config.collections?.length) {
    throw new Error(get(_)('config.error.no_collection'));
  }

  if (!config.backend?.name) {
    throw new Error(get(_)('config.error.no_backend'));
  }

  if (!(config.backend.name in allBackendServices)) {
    throw new Error(
      get(_)('config.error.unsupported_backend', { values: { name: config.backend.name } }),
    );
  }

  if (!config.media_folder) {
    throw new Error(get(_)('config.error.no_media_folder'));
  }
};

/**
 * Fetch the configuration file and set the parsed result or any error.
 * @todo Normalize configuration object.
 */
export const fetchSiteConfig = async () => {
  const { href = './config.yml' } =
    /** @type {HTMLAnchorElement?} */ (
      document.querySelector('link[type="text/yaml"][rel="cms-config-url"]')
    ) ?? {};

  /**
   * @type {Response}
   */
  let response;
  /**
   * @type {SiteConfig}
   */
  let config;

  try {
    try {
      response = await fetch(href);
    } catch (/** @type {any} */ ex) {
      throw new Error(get(_)('config.error.fetch_failed'), { cause: ex });
    }

    const { ok, status } = response;

    if (!ok) {
      throw new Error(get(_)('config.error.fetch_failed'), {
        cause: new Error(get(_)('config.error.fetch_failed_not_ok', { values: { status } })),
      });
    }

    try {
      config = YAML.parse(await response.text());
    } catch (/** @type {any} */ ex) {
      throw new Error(get(_)('config.error.parse_failed'), { cause: ex });
    }

    validate(config);

    // Set the site URL for development. See also `/src/app.svelte`
    if (DEV && !config.site_url) {
      config.site_url = VITE_SITE_URL || 'http://localhost:5174';
    }

    siteConfig.set(config);
  } catch (/** @type {any} */ ex) {
    siteConfig.set({
      error: ex.name === 'Error' ? ex.message : get(_)('config.error.unexpected'),
    });

    // eslint-disable-next-line no-console
    console.error(ex, ex.cause);
  }
};

siteConfig.subscribe((config) => {
  if (get(prefs).devModeEnabled) {
    // eslint-disable-next-line no-console
    console.info('siteConfig', config);
  }

  if (!config || config.error) {
    return;
  }

  const {
    media_folder: _globalMediaFolder,
    public_folder: _globalPublicFolder,
    collections,
  } = config;

  selectedCollection.set(getCollection(collections[0].name));

  /** @type {CollectionEntryFolder[]} */
  const _allEntryFolders = [
    ...collections
      .filter(({ folder }) => !!folder)
      .map(
        ({
          name: collectionName,
          folder: folderPath,
          extension,
          format,
          frontmatter_delimiter: frontmatterDelimiter,
          yaml_quote: yamlQuote,
        }) => ({
          collectionName,
          folderPath,
          extension,
          format,
          frontmatterDelimiter,
          yamlQuote,
        }),
      )
      .sort((a, b) => a.folderPath.localeCompare(b.folderPath)),
    ...collections
      .filter(({ files }) => !!files)
      .map(
        ({
          name: collectionName,
          files,
          extension,
          format,
          frontmatter_delimiter: frontmatterDelimiter,
          yaml_quote: yamlQuote,
        }) =>
          files.map(({ name: fileName, file: filePath }) => ({
            collectionName,
            fileName,
            filePath,
            extension,
            format,
            frontmatterDelimiter,
            yamlQuote,
          })),
      )
      .flat(1)
      .sort((a, b) => a.filePath.localeCompare(b.filePath)),
  ];

  const globalMediaFolder = stripSlashes(_globalMediaFolder);

  // Some frameworks expect asset paths starting with `@`, like `@assets/images/...`. Remove an
  // extra leading slash in that case. A trailing slash should always be removed internally.
  const globalPublicFolder = _globalPublicFolder
    ? `/${stripSlashes(_globalPublicFolder)}`.replace(/^\/@/, '@')
    : `/${globalMediaFolder}`;

  /** @type {CollectionAssetFolder} */
  const globalAssetFolder = {
    collectionName: null,
    internalPath: globalMediaFolder,
    publicPath: globalPublicFolder,
    entryRelative: false,
  };

  /**
   * Folder Collections Media and Public Folder.
   * @type {CollectionAssetFolder[]}
   * @see https://decapcms.org/docs/beta-features/#folder-collections-media-and-public-folder
   */
  const collectionAssetFolders = collections.map((collection) => {
    const {
      name: collectionName,
      // e.g. `content/posts`
      folder: collectionFolder,
      // e.g. `{{slug}}/index`
      path: entryPath,
      // e.g. `` (an empty string), `{{public_folder}}`, etc. or absolute path
      public_folder: publicFolder,
    } = collection;

    let {
      // relative path, e.g. `` (an empty string), `./` (same as an empty string),
      // `{{media_folder}}/posts`, etc. or absolute path, e.g. `/static/images/posts`, etc.
      media_folder: mediaFolder,
    } = collection;

    if (mediaFolder === undefined) {
      if (entryPath === undefined) {
        return null;
      }

      // When specifying a `path` on a folder collection, `media_folder` defaults to an empty string
      mediaFolder = '';
    }

    mediaFolder = mediaFolder.replace('{{media_folder}}', globalMediaFolder);

    const entryRelative = !mediaFolder.startsWith('/');

    return {
      collectionName,
      internalPath: stripSlashes(entryRelative ? collectionFolder : mediaFolder),
      publicPath: (publicFolder ?? mediaFolder).replace('{{public_folder}}', globalPublicFolder),
      entryRelative,
    };
  });

  const _allAssetFolders = [
    globalAssetFolder,
    ...collectionAssetFolders
      .filter(Boolean)
      .sort((a, b) => a.internalPath.localeCompare(b.internalPath)),
  ];

  allEntryFolders.set(_allEntryFolders);
  allAssetFolders.set(_allAssetFolders);

  if (get(prefs).devModeEnabled) {
    // eslint-disable-next-line no-console
    console.info('allEntryFolders', _allEntryFolders);
    // eslint-disable-next-line no-console
    console.info('allAssetFolders', _allAssetFolders);
  }
});
