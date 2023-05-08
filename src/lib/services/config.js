import { writable } from 'svelte/store';
import YAML from 'yaml';
import { allAssetPaths } from '$lib/services/assets';
import { allContentPaths, getCollection, selectedCollection } from '$lib/services/contents';
import { isObject } from '$lib/services/utils/misc';
import { stripSlashes } from '$lib/services/utils/strings';

export const siteConfig = writable();

const { DEV, VITE_CONFIG_PORT } = import.meta.env;

/**
 * Validate the site configuration file.
 * @param {object} config Config object.
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
 */
export const fetchSiteConfig = async () => {
  const { href = '/admin/config.yml' } =
    document.querySelector('link[type="text/yaml"][rel="cms-config-url"]') || {};

  let response;
  let config;

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
    siteConfig.set({ error: error.message });

    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.error(error);
    }
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

  const { media_folder: mediaFolder, public_folder: publicFolder, collections } = config;
  const _mediaFolder = stripSlashes(mediaFolder);

  selectedCollection.set(getCollection(collections[0].name));

  allContentPaths.set([
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
      .map(({ name: collectionName, files }) =>
        files.map(
          ({
            name: fileName,
            file,
            extension,
            format,
            frontmatter_delimiter: frontmatterDelimiter,
          }) => ({
            collectionName,
            fileName,
            file,
            extension,
            format,
            frontmatterDelimiter,
          }),
        ),
      )
      .flat(1),
  ]);

  allAssetPaths.set(
    [
      {
        collectionName: null,
        internalPath: _mediaFolder,
        publicPath: publicFolder || `/${_mediaFolder}`,
      },
      ...collections
        .filter((c) => c.media_folder?.startsWith('/') && c.public_folder)
        .map((c) => ({
          collectionName: c.name,
          internalPath: stripSlashes(c.media_folder),
          publicPath: c.public_folder,
        })),
    ].sort((a, b) => a.internalPath.localeCompare(b.internalPath)),
  );
});
