import { writable } from 'svelte/store';
import YAML from 'yaml';
import { allAssetPaths } from '$lib/services/assets';
import { allContentPaths, getCollection, selectedCollection } from '$lib/services/contents';
import { isObject } from '$lib/services/utils/misc';
import { stripSlashes } from '$lib/services/utils/strings';

/**
 * @type {import('svelte/store').Writable<SiteConfig?>}
 */
export const siteConfig = writable();

const { DEV, VITE_CONFIG_PORT } = import.meta.env;

/**
 * Validate the site configuration file.
 * @param {SiteConfig} config Config object.
 * @throws {Error} If there is an error in the config.
 * @see https://decapcms.org/docs/configuration-options/
 * @todo Add more validations.
 */
const validate = (config) => {
  if (!isObject(config)) {
    throw new Error('parse_failed');
  }

  if (!config.collections?.length) {
    throw new Error('no_collection');
  }

  if (!config.backend?.repo) {
    throw new Error('no_backend');
  }

  if (!config.media_folder) {
    throw new Error('no_media_folder');
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
    ) || {};

  /**
   * @type {Response}
   */
  let response = undefined;
  /**
   * @type {SiteConfig}
   */
  let config = undefined;

  try {
    try {
      response = await fetch(href);
    } catch {
      throw new Error('fetch_failed');
    }

    if (!response.ok) {
      throw new Error('fetch_failed');
    }

    try {
      config = YAML.parse(await response.text());
    } catch {
      throw new Error('parse_failed');
    }

    validate(config);

    // Set the site URL for development. See also `/src/app.svelte`
    if (DEV && !config.site_url) {
      config.site_url = `http://localhost:${VITE_CONFIG_PORT || 5174}`;
    }

    siteConfig.set(config);
  } catch (error) {
    siteConfig.set({ error: /** @type {string} */ (error.message) });

    // eslint-disable-next-line no-console
    console.error(error);
  }
};

siteConfig.subscribe((config) => {
  if (DEV) {
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

  const _allContentPaths = [
    ...collections
      .filter(({ folder }) => !!folder)
      .map(
        ({
          name: collectionName,
          folder,
          extension,
          format,
          frontmatter_delimiter: frontmatterDelimiter,
        }) => ({
          collectionName,
          folder,
          extension,
          format,
          frontmatterDelimiter,
        }),
      ),
    ...collections
      .filter(({ files }) => !!files)
      .map(
        ({
          name: collectionName,
          files,
          extension,
          format,
          frontmatter_delimiter: frontmatterDelimiter,
        }) =>
          files.map(({ name: fileName, file }) => ({
            collectionName,
            fileName,
            file,
            extension,
            format,
            frontmatterDelimiter,
          })),
      )
      .flat(1),
  ];

  const globalMediaFolder = stripSlashes(_globalMediaFolder);

  const globalPublicFolder = _globalPublicFolder
    ? `/${stripSlashes(_globalPublicFolder)}`
    : `/${globalMediaFolder}`;

  const globalAssetPath = {
    collectionName: null,
    internalPath: globalMediaFolder,
    publicPath: globalPublicFolder,
    entryRelative: false,
  };

  /**
   * Folder Collections Media and Public Folder.
   * @see https://decapcms.org/docs/beta-features/#folder-collections-media-and-public-folder
   */
  const collectionAssetPaths = collections.map((collection) => {
    const {
      name: collectionName,
      // e.g. `content/posts`
      folder: collectionFolder,
      // e.g. `{{slug}}/index`
      path: entryPath,
    } = collection;

    if (!entryPath) {
      return null;
    }

    let {
      // relative path, e.g. `` (an empty string), `./` (same as an empty string),
      // `{{media_folder}}/posts`, etc. or absolute path, e.g. `/static/images/posts`, etc.
      media_folder: mediaFolder = '',
      // same as `media_folder`
      public_folder: publicFolder = '',
    } = collection;

    const entryRelative = !(
      mediaFolder &&
      (mediaFolder.startsWith('/') || mediaFolder.includes('{{media_folder}}'))
    );

    mediaFolder = mediaFolder.replace('{{media_folder}}', globalMediaFolder);
    publicFolder = publicFolder.replace('{{public_folder}}', globalPublicFolder);

    return {
      collectionName,
      internalPath: stripSlashes(entryRelative ? collectionFolder : mediaFolder),
      publicPath: publicFolder,
      entryRelative,
    };
  });

  const _allAssetPaths = [
    globalAssetPath,
    ...collectionAssetPaths
      .filter(Boolean)
      .sort((a, b) => a.internalPath.localeCompare(b.internalPath)),
  ];

  allContentPaths.set(_allContentPaths);
  allAssetPaths.set(_allAssetPaths);

  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.info('allContentPaths', _allContentPaths);
    // eslint-disable-next-line no-console
    console.info('allAssetPaths', _allAssetPaths);
  }
});
