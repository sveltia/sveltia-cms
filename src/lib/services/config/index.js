import { getHash } from '@sveltia/utils/crypto';
import { isObject, toRaw } from '@sveltia/utils/object';
import { compare, isURL, stripSlashes } from '@sveltia/utils/string';
import merge from 'deepmerge';
import { _ } from 'svelte-i18n';
import { get, writable } from 'svelte/store';
import YAML from 'yaml';
import { prefs } from '$lib/services/user/prefs';
import { getI18nConfig } from '$lib/services/contents/i18n';
import { allEntryFolders } from '$lib/services/contents';
import { fetchSiteConfig } from '$lib/services/config/loader';
import { allBackendServices } from '$lib/services/backends';
import { allAssetFolders } from '$lib/services/assets';

/**
 * @import { Writable } from 'svelte/store';
 * @import { SiteConfig } from '$lib/types/public'
 * @import {
 * CollectionAssetFolder,
 * CollectionEntryFolder,
 * InternalSiteConfig,
 * } from '$lib/types/private';
 */

const { DEV, VITE_SITE_URL } = import.meta.env;

/**
 * The local live site URL. Local development can be done by loading a CMS config file from a
 * separate dev server. By default, this assumes a local SvelteKit site is running on port 5174
 * along with Sveltia CMS on port 5173. The site URL can be specified with the `VITE_SITE_URL`
 * environment variable. For example, run `VITE_SITE_URL=http://localhost:3000 pnpm dev` for
 * Next.js. You probably need to define the `Access-Control-Allow-Origin: *` HTTP response header
 * with the dev server’s middleware, or loading the CMS config file may fail due to a CORS error.
 */
export const devSiteURL = DEV ? VITE_SITE_URL || 'http://localhost:5174' : undefined;
/**
 * @type {Partial<SiteConfig>}
 */
export const rawSiteConfig = {};
/**
 * @type {Writable<InternalSiteConfig | undefined>}
 */
export const siteConfig = writable();
/**
 * @type {Writable<string | undefined>}
 */
export const siteConfigVersion = writable();
/**
 * @type {Writable<{ message: string } | undefined>}
 */
export const siteConfigError = writable();

/**
 * Validate the site configuration file.
 * @param {SiteConfig} config Raw config object.
 * @throws {Error} If there is an error in the config.
 * @see https://decapcms.org/docs/configuration-options/
 * @todo Add more validations.
 */
const validate = (config) => {
  if (!config.collections?.length) {
    throw new Error(get(_)('config.error.no_collection'));
  }

  if (!config.backend) {
    throw new Error(get(_)('config.error.missing_backend'));
  }

  if (!config.backend.name) {
    throw new Error(get(_)('config.error.missing_backend_name'));
  }

  if (!(config.backend.name in allBackendServices)) {
    throw new Error(
      get(_)('config.error.unsupported_backend', { values: { name: config.backend.name } }),
    );
  }

  if (['github', 'gitlab'].includes(config.backend.name)) {
    if (config.backend.repo === undefined) {
      throw new Error(get(_)('config.error.missing_repository'));
    }

    if (typeof config.backend.repo !== 'string' || !/(.+)\/([^/]+)$/.test(config.backend.repo)) {
      throw new Error(get(_)('config.error.invalid_repository'));
    }
  }

  if (config.backend.auth_type === 'implicit') {
    throw new Error(get(_)('config.error.oauth_implicit_flow'));
  }

  if (config.backend.auth_type === 'pkce' && !config.backend.app_id) {
    throw new Error(get(_)('config.error.oauth_no_app_id'));
  }

  if (config.media_folder === undefined) {
    throw new Error(get(_)('config.error.missing_media_folder'));
  }

  if (typeof config.media_folder !== 'string') {
    throw new Error(get(_)('config.error.invalid_media_folder'));
  }

  if (config.public_folder !== undefined) {
    if (typeof config.public_folder !== 'string') {
      throw new Error(get(_)('config.error.invalid_public_folder'));
    }

    if (/^\.{1,2}\//.test(config.public_folder)) {
      throw new Error(get(_)('config.error.public_folder_relative_path'));
    }

    if (/^https?:/.test(config.public_folder)) {
      throw new Error(get(_)('config.error.public_folder_absolute_url'));
    }
  }
};

/**
 * Initialize the site configuration state by loading the YAML file and optionally merge the object
 * with one specified with `CMS.init()`.
 * @param {SiteConfig} [manualConfig] Raw configuration specified with manual initialization.
 * @todo Normalize configuration object.
 */
export const initSiteConfig = async (manualConfig) => {
  siteConfig.set(undefined);
  siteConfigError.set(undefined);

  try {
    // Not a config error but `getHash` below and some other features require a secure context
    if (!window.isSecureContext) {
      throw new Error(get(_)('config.error.no_secure_context'));
    }

    /** @type {any} */
    let rawConfig;

    if (manualConfig) {
      if (!isObject(manualConfig)) {
        throw new Error(get(_)('config.error.parse_failed'));
      }

      // Clone the object because it may contain proxified arrays, etc.
      rawConfig = toRaw(manualConfig);

      if (rawConfig.load_config_file !== false) {
        rawConfig = merge(await fetchSiteConfig(), rawConfig);
      }
    } else {
      rawConfig = await fetchSiteConfig();
    }

    // Store the raw config so it can be used in the parser and config viewer
    Object.assign(rawSiteConfig, rawConfig);

    validate(rawConfig);

    /** @type {InternalSiteConfig} */
    const config = structuredClone(rawConfig);

    // Set the site URL for development or production. See also `/src/lib/components/app.svelte`
    config._siteURL = config.site_url?.trim() || (DEV ? devSiteURL : window.location.origin);
    config._baseURL = isURL(config._siteURL) ? new URL(config._siteURL).origin : '';

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
      .map((collection) => {
        const { name: collectionName, folder } = collection;
        const folderPath = stripSlashes(/** @type {string} */ (folder));
        const { i18nEnabled, structure, allLocales } = getI18nConfig(collection);
        const i18nRootMultiFolder = i18nEnabled && structure === 'multiple_folders_i18n_root';

        return {
          collectionName,
          folderPath,
          folderPathMap: Object.fromEntries(
            allLocales.map((locale) => [
              locale,
              i18nRootMultiFolder ? `${locale}/${folderPath}` : folderPath,
            ]),
          ),
        };
      })
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
                  getI18nConfig(collection, file).allLocales.map((locale) => [
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
    hasTemplateTags: false,
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

        let publicPath = stripSlashes(
          (publicFolder ?? mediaFolder).replace('{{public_folder}}', globalPublicFolder).trim(),
        );

        // Prefix the public path with `/` unless it’s empty or starting with `.` (entry-relative
        // setting) or starting with `@` (framework-specific)
        publicPath = publicPath === '' || publicPath.match(/^[.@]/) ? publicPath : `/${publicPath}`;

        return {
          collectionName,
          internalPath: stripSlashes(entryRelative ? (collectionFolder ?? '') : mediaFolder),
          publicPath,
          entryRelative,
          hasTemplateTags: /{{.+?}}/.test(mediaFolder),
        };
      })
      .filter(Boolean)
  ).sort((a, b) => compare(a.internalPath, b.internalPath));

  const _allAssetFolders = [globalAssetFolder, ...collectionAssetFolders];

  // `getCollection` depends on `allAssetFolders`
  allEntryFolders.set(_allEntryFolders);
  allAssetFolders.set(_allAssetFolders);

  if (get(prefs).devModeEnabled) {
    // eslint-disable-next-line no-console
    console.info('allEntryFolders', _allEntryFolders);
    // eslint-disable-next-line no-console
    console.info('allAssetFolders', _allAssetFolders);
  }
});
