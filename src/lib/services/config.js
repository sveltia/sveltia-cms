import { writable } from 'svelte/store';
import YAML from 'yaml';
import { allAssetPaths } from '$lib/services/assets';
import { allContentPaths, selectedCollection } from '$lib/services/contents';
import { editorLeftPane, editorRightPane } from '$lib/services/contents/editor';
import { isObject } from '$lib/services/utils/misc';

export const siteConfig = writable();
export const defaultContentLocale = writable('default');

/**
 * Validate the site configuration file.
 *
 * @param {object} config Config object.
 * @throws {Error} If there is an error in the config.
 * @see https://www.netlifycms.org/docs/configuration-options/
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
    siteConfig.set(config);
  } catch ({ message }) {
    siteConfig.set({ error: message });
  }
};

siteConfig.subscribe((config) => {
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.info('siteConfig', config);
  }

  if (!config || config.error) {
    return;
  }

  const { media_folder: mediaFolder, public_folder: publicFolder, collections, i18n } = config;
  const _mediaFolder = mediaFolder.match(/^\/?(.+)\/?$/)[1];
  const _defaultContentLocale = i18n?.default_locale || i18n?.locales?.[0] || 'default';

  defaultContentLocale.set(_defaultContentLocale);
  selectedCollection.set(collections[0]);
  editorLeftPane.set({ mode: 'edit', locale: _defaultContentLocale });
  editorRightPane.set({ mode: 'preview', locale: _defaultContentLocale });

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
          internalPath: c.media_folder.match(/^\/?(.+)\/?$/)[1],
          publicPath: c.public_folder,
        })),
    ].sort((a, b) => a.internalPath.localeCompare(b.internalPath)),
  );
});
