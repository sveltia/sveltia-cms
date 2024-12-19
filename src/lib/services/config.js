import { getHash } from '@sveltia/utils/crypto';
import { isObject } from '@sveltia/utils/object';
import { compare, stripSlashes } from '@sveltia/utils/string';
import merge from 'deepmerge';
import { _ } from 'svelte-i18n';
import { get, writable } from 'svelte/store';
import YAML from 'yaml';
import { prefs } from '$lib/services/prefs';
import { getI18nConfig } from '$lib/services/contents/i18n';
import { getCollection, selectedCollection } from '$lib/services/contents/collection';
import { allEntryFolders } from '$lib/services/contents';
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
 * @type {import('svelte/store').Writable<string | undefined>}
 */
export const siteConfigVersion = writable();
/**
 * @type {import('svelte/store').Writable<{ message: string } | undefined>}
 */
export const siteConfigError = writable();

/**
 * Fetch the YAML site configuration file and return it as JSON.
 * @param {object} [options] - Options.
 * @param {boolean} [options.ignoreError] - Whether to ignore a fetch error.
 * @returns {Promise<any>} Configuration. Can be an empty object if the `ignoreError` option is
 * `true` and the config file is missing.
 * @throws {Error} When fetching or parsing has failed.
 */
const fetchSiteConfig = async ({ ignoreError = false } = {}) => {
  const {
    // Depending on the server or framework configuration, the trailing slash may be removed from
    // the CMS `/admin/` URL. In that case, fetch the config file from a root-relative URL instead
    // of a regular relative URL to avoid 404 Not Found.
    href = window.location.pathname === '/admin' ? '/admin/config.yml' : './config.yml',
    type = 'application/yaml',
  } = /** @type {?HTMLLinkElement} */ (document.querySelector('link[rel="cms-config-url"]')) ?? {};

  /** @type {Response} */
  let response;

  try {
    response = await fetch(href);
  } catch (/** @type {any} */ ex) {
    throw new Error(get(_)('config.error.fetch_failed'), { cause: ex });
  }

  const { ok, status } = response;

  if (!ok) {
    if (ignoreError) {
      return {};
    }

    throw new Error(get(_)('config.error.fetch_failed'), {
      cause: new Error(get(_)('config.error.fetch_failed_not_ok', { values: { status } })),
    });
  }

  try {
    if (type === 'application/json') {
      return response.json();
    }

    return YAML.parse(await response.text(), { merge: true });
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

  if (typeof config.backend.repo !== 'string' || !/(.+)\/([^/]+)$/.test(config.backend.repo)) {
    throw new Error(get(_)('config.error.no_repository'));
  }

  if (config.backend.auth_type === 'implicit') {
    throw new Error(get(_)('config.error.oauth_implicit_flow'));
  }

  if (config.backend.auth_type === 'pkce' && !config.backend.app_id) {
    throw new Error(get(_)('config.error.oauth_no_app_id'));
  }

  if (typeof config.media_folder !== 'string') {
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

  try {
    // Not a config error but `getHash` below and some other features require a secure context
    if (!window.isSecureContext) {
      throw new Error(get(_)('config.error.no_secure_context'));
    }

    if (manualConfig && !isObject(manualConfig)) {
      throw new Error(get(_)('config.error.parse_failed'));
    }

    /** @type {any} */
    let tempConfig;

    if (manualConfig?.load_config_file === false) {
      tempConfig = manualConfig;
    } else if (Object.entries(manualConfig).length) {
      tempConfig = merge(await fetchSiteConfig({ ignoreError: true }), manualConfig);
    } else {
      tempConfig = await fetchSiteConfig();
    }

    validate(tempConfig);

    /** @type {SiteConfig} */
    const config = tempConfig;

    // Set the site URL for development and production if undefined. See also `/src/app.svelte`
    config.site_url ||= DEV ? siteURL : window.location.origin;

    // Handle root collection folder variants, particularly for VitePress
    config.collections.forEach((collection) => {
      if (collection.folder === '.' || collection.folder === '/') {
        collection.folder = '';
      }
    });

    siteConfig.set(config);
    siteConfigVersion.set(await getHash(YAML.stringify(config)));
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

  /** @type {CollectionEntryFolder[]} */
  const _allEntryFolders = [
    ...collections
      .filter(({ folder, hide, divider }) => typeof folder === 'string' && !hide && !divider)
      .map(({ name: collectionName, folder }) => ({
        collectionName,
        folderPath: stripSlashes(/** @type {string} */ (folder)),
      }))
      .sort((a, b) => compare(a.folderPath ?? '', b.folderPath ?? '')),
    ...collections
      .filter(({ files, hide, divider }) => Array.isArray(files) && !hide && !divider)
      .map((collection) => {
        const { name: collectionName, files } = collection;

        return (files ?? []).map((file) => {
          const path = stripSlashes(file.file);

          return {
            collectionName,
            fileName: file.name,
            filePathMap: path.includes('{{locale}}')
              ? Object.fromEntries(
                  getI18nConfig(collection, file).locales.map((locale) => [
                    locale,
                    path.replace('{{locale}}', locale),
                  ]),
                )
              : { _default: path },
          };
        });
      })
      .flat(1)
      .sort((a, b) => compare(Object.values(a.filePathMap)[0], Object.values(b.filePathMap)[0])),
  ];

  // Normalize the media folder: an empty string, `/` and `.` are all considered as the root folder
  const globalMediaFolder = stripSlashes(_globalMediaFolder).replace(/^\.$/, '');

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
      .filter(
        ({ hide, divider, media_folder: mediaFolder, path: entryPath }) =>
          // Show the asset folder if `media_folder` or `path` is defined, even if the collection is
          // hidden with the `hide` option
          (!hide || !!mediaFolder || !!entryPath) && !divider,
      )
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

          // When specifying a `path` on an entry collection, `media_folder` defaults to an empty
          // string
          mediaFolder = '';
        }

        mediaFolder = mediaFolder.replace('{{media_folder}}', globalMediaFolder);

        const entryRelative = !(
          mediaFolder.startsWith('/') || mediaFolder.startsWith(globalMediaFolder)
        );

        return {
          collectionName,
          internalPath: stripSlashes(entryRelative ? (collectionFolder ?? '') : mediaFolder),
          publicPath: `/${stripSlashes(
            (publicFolder ?? mediaFolder).replace('{{public_folder}}', globalPublicFolder),
          )}`,
          entryRelative,
        };
      })
      .filter(Boolean)
  ).sort((a, b) => compare(a.internalPath, b.internalPath));

  const _allAssetFolders = [globalAssetFolder, ...collectionAssetFolders];

  allEntryFolders.set(_allEntryFolders);
  allAssetFolders.set(_allAssetFolders);
  // `getCollection` depends on `allAssetFolders`
  selectedCollection.set(getCollection(collections[0].name));

  if (get(prefs).devModeEnabled) {
    // eslint-disable-next-line no-console
    console.info('allEntryFolders', _allEntryFolders);
    // eslint-disable-next-line no-console
    console.info('allAssetFolders', _allAssetFolders);
  }
});
