import { isObject } from '@sveltia/utils/object';
import { stripSlashes } from '@sveltia/utils/string';
import merge from 'deepmerge';
import { _ } from 'svelte-i18n';
import { get, writable } from 'svelte/store';
import YAML from 'yaml';
import { prefs } from '$lib/services/prefs';
import { allEntryFolders, getCollection, selectedCollection } from '$lib/services/contents';
import { allBackendServices } from '$lib/services/backends';
import { allAssetFolders } from '$lib/services/assets';

const { DEV, VITE_SITE_URL } = import.meta.env;

/**
 * The local live site URL. Local development can be done by loading a CMS config file from a
 * separate dev server. By default, this assumes a local SvelteKit site is running on port 5174
 * along with Sveltia CMS on port 5173. The site URL can be specified with the `VITE_SITE_URL`
 * environment variable. For example, run `VITE_SITE_URL=http://localhost:3000 pnpm dev` for
 * Next.js. You probably need to define the `Access-Control-Allow-Origin: *` HTTP response header
 * with the dev server’s middleware, or loading the CMS config file may fail due to a CORS error.
 */
export const siteURL = DEV ? VITE_SITE_URL || 'http://localhost:5174' : undefined;

/**
 * @type {import('svelte/store').Writable<SiteConfig | undefined>}
 */
export const siteConfig = writable();

/**
 * @type {import('svelte/store').Writable<{ message: string } | undefined>}
 */
export const siteConfigError = writable();

/**
 * Fetch the YAML site configuration file and return it as JSON.
 * @returns {Promise<SiteConfig>} Configuration.
 * @throws {Error} When fetching or parsing has failed.
 */
const fetchSiteConfig = async () => {
  const { href = './config.yml' } =
    /** @type {HTMLAnchorElement | undefined} */ (
      document.querySelector('link[type="text/yaml"][rel="cms-config-url"]')
    ) ?? {};

  /** @type {Response} */
  let response;

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
    return YAML.parse(await response.text());
  } catch (/** @type {any} */ ex) {
    throw new Error(get(_)('config.error.parse_failed'), { cause: ex });
  }
};

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

  if (typeof config.backend.repo !== 'string' || config.backend.repo.split('/').length !== 2) {
    throw new Error(get(_)('config.error.no_repository'));
  }

  if (config.backend.auth_type === 'implicit') {
    throw new Error(get(_)('config.error.oauth_implicit_flow'));
  }

  if (config.backend.auth_type === 'pkce' && !config.backend.app_id) {
    throw new Error(get(_)('config.error.oauth_no_app_id'));
  }

  if (!config.media_folder) {
    throw new Error(get(_)('config.error.no_media_folder'));
  }
};

/**
 * Initialize the site configuration state by loading the YAML file and optionally merge the object
 * with one specified with `CMS.init()`.
 * @param {any} [manualConfig] - Configuration specified with manual initialization.
 * @todo Normalize configuration object.
 */
export const initSiteConfig = async (manualConfig = {}) => {
  siteConfig.set(undefined);
  siteConfigError.set(undefined);

  /** @type {SiteConfig} */
  let config;

  try {
    if (manualConfig && !isObject(manualConfig)) {
      throw new Error(get(_)('config.error.parse_failed'));
    }

    if (manualConfig?.load_config_file === false) {
      config = manualConfig;
    } else {
      config = await fetchSiteConfig();

      if (Object.entries(manualConfig).length) {
        config = merge(config, manualConfig);
      }
    }

    validate(config);

    // Set the site URL for development. See also `/src/app.svelte`
    if (DEV && !config.site_url) {
      config.site_url = siteURL;
    }

    siteConfig.set(config);
  } catch (/** @type {any} */ ex) {
    siteConfigError.set({
      message: ex.name === 'Error' ? ex.message : get(_)('config.error.unexpected'),
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

  if (!config) {
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
          folderPath: stripSlashes(/** @type {string} */ (folderPath)),
          extension,
          format,
          frontmatterDelimiter,
          yamlQuote,
        }),
      )
      .sort((a, b) => (a.folderPath ?? '').localeCompare(b.folderPath ?? '')),
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
          (files ?? []).map(({ name: fileName, file: filePath }) => ({
            collectionName,
            fileName,
            filePath: stripSlashes(filePath),
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
    collectionName: undefined,
    internalPath: globalMediaFolder,
    publicPath: globalPublicFolder,
    entryRelative: false,
  };

  /**
   * Folder Collections Media and Public Folder.
   * @see https://decapcms.org/docs/collection-folder/#media-and-public-folder
   */
  const collectionAssetFolders = /** @type {CollectionAssetFolder[]} */ (
    collections
      .map((collection) => {
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

          // When specifying a `path` on a folder collection, `media_folder` defaults to an empty
          // string
          mediaFolder = '';
        }

        mediaFolder = mediaFolder.replace('{{media_folder}}', globalMediaFolder);

        const entryRelative = !mediaFolder.startsWith('/');

        return {
          collectionName,
          internalPath: stripSlashes(entryRelative ? collectionFolder ?? '' : mediaFolder),
          publicPath: (publicFolder ?? mediaFolder).replace(
            '{{public_folder}}',
            globalPublicFolder,
          ),
          entryRelative,
        };
      })
      .filter(Boolean)
  ).sort((a, b) => a.internalPath.localeCompare(b.internalPath));

  const _allAssetFolders = [globalAssetFolder, ...collectionAssetFolders];

  allEntryFolders.set(_allEntryFolders);
  allAssetFolders.set(_allAssetFolders);

  if (get(prefs).devModeEnabled) {
    // eslint-disable-next-line no-console
    console.info('allEntryFolders', _allEntryFolders);
    // eslint-disable-next-line no-console
    console.info('allAssetFolders', _allAssetFolders);
  }
});
