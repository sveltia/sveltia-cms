import { stripSlashes } from '@sveltia/utils/string';

import { hasTemplateTags } from '$lib/services/common/template/tags';
import { cmsConfig } from '$lib/services/config/state';

/**
 * Names of the folders the CMS itself is usually served from, e.g. `static/admin/index.html` along
 * with its `config.yml`. With a media folder at the root of the public folder, such as `static` or
 * `public`, those files are listed as assets, and replacing the admin page would hand the next
 * user’s sign-in to whoever wrote it. So the files in such a folder are read-only in the Asset
 * Library, and no asset change made through the CMS can touch them. Deployment configuration such
 * as `_redirects` can be edited as an entry of a file collection, so it isn’t ruled out here.
 */
const CMS_FOLDER_NAMES = ['admin', 'cms'];
/**
 * Folders a site is usually served from: the repository root, as with Jekyll, and the public
 * folders of most frameworks, e.g. `static` for Hugo and SvelteKit or `public` for Astro and
 * Next.js.
 */
const SITE_ROOT_FOLDERS = ['', 'static', 'public'];
/**
 * Normalize the given path for a case-insensitive comparison.
 * @param {string} path Path.
 * @returns {string} Normalized path.
 */
const normalizePath = (path) => stripSlashes(path).normalize().toLowerCase();

/**
 * Check whether the given folder name is one the CMS itself is usually served from.
 * @param {string} name Folder name.
 * @returns {boolean} Result.
 */
export const isCmsFolderName = (name) => CMS_FOLDER_NAMES.includes(normalizePath(name));

/**
 * Get the folder the site is served from, as told by the global `media_folder` and
 * `public_folder` options: `static` for `static/images` published at `/images`, for example.
 * @param {unknown} mediaFolder `media_folder` option.
 * @param {unknown} publicFolder `public_folder` option.
 * @returns {string | undefined} Folder path, or `undefined` if it can’t be told.
 */
const getConfiguredSiteRootFolder = (mediaFolder, publicFolder) => {
  if (typeof mediaFolder !== 'string' || typeof publicFolder !== 'string') {
    return undefined;
  }

  const media = stripSlashes(mediaFolder).replace(/^\.(?:\/|$)/, '');
  const pub = stripSlashes(publicFolder);

  // A relative or framework-specific public folder, like `../images` or `@assets/images`, isn’t a
  // URL path
  if (hasTemplateTags(media) || hasTemplateTags(pub) || /^[.@]/.test(pub)) {
    return undefined;
  }

  if (!pub || media === pub) {
    return pub ? '' : media;
  }

  return media.endsWith(`/${pub}`) ? media.slice(0, -pub.length - 1) : undefined;
};

/**
 * Get the folder of the admin page the CMS is running on, from its URL path: `admin` for `/admin/`,
 * `/admin` or `/admin/index.html`. The site may be served below a base path, like a GitHub Pages
 * project site at `/repo/`, so each trailing part of the folder path is returned as well:
 * `repo/dashboard` and `dashboard` for `/repo/dashboard/`.
 * @param {string} pathname URL path of the page.
 * @returns {string[]} Folder paths. Empty if the page is at the root or the path can’t be read.
 */
const getAdminPageFolders = (pathname) => {
  const segments = pathname.split('/').filter(Boolean);

  // A last segment with a dot is the page file itself
  if (segments.at(-1)?.includes('.')) {
    segments.pop();
  }

  try {
    const decoded = segments.map(decodeURIComponent);

    return decoded.map((_segment, index) => decoded.slice(index).join('/'));
  } catch {
    return [];
  }
};

/**
 * Cache of {@link getCmsFolderPaths}, which is called for every asset path checked, keyed by the
 * global folder options and the URL path of the page it depends on.
 * @type {{ key: string, paths: string[] } | undefined}
 */
let cmsFolderPathsCache;

/**
 * Get the folders the CMS itself may be served from: an `admin` or `cms` folder, or the folder of
 * the current admin page, at the top of the repository or right below a folder the site is served
 * from. The same name deeper down, like a Hugo page bundle `content/posts/cms`, is just a folder.
 * @returns {string[]} Normalized folder paths.
 */
const getCmsFolderPaths = () => {
  const { media_folder: mediaFolder, public_folder: publicFolder } = cmsConfig.current ?? {};
  const pathname = globalThis.location?.pathname ?? '';
  const key = JSON.stringify([mediaFolder, publicFolder, pathname]);

  if (cmsFolderPathsCache?.key !== key) {
    const siteRootFolder = getConfiguredSiteRootFolder(mediaFolder, publicFolder);

    const roots =
      siteRootFolder === undefined ? SITE_ROOT_FOLDERS : [...SITE_ROOT_FOLDERS, siteRootFolder];

    const names = [...CMS_FOLDER_NAMES, ...getAdminPageFolders(pathname)];

    cmsFolderPathsCache = {
      key,
      paths: roots.flatMap((root) => names.map((name) => normalizePath(`${root}/${name}`))),
    };
  }

  return cmsFolderPathsCache.paths;
};

/**
 * Check whether the given folder is, or is below, a folder the CMS itself may be served from.
 * @param {string} dirPath Folder path. An empty string for the root.
 * @returns {boolean} Result.
 */
export const isCmsFolderPath = (dirPath) => {
  const path = normalizePath(dirPath);

  return getCmsFolderPaths().some((folder) => path === folder || path.startsWith(`${folder}/`));
};

/**
 * Regular expression matching the name of a file that would take over the CMS if replaced: the
 * admin page and its configuration file.
 */
const CMS_FILE_NAME_REGEX = /^(?:index\.html|config\.(?:ya?ml|toml|json))$/;

/**
 * Check whether the given file is the admin page or its configuration file in a folder named like
 * one the CMS is served from, at any depth. The site root can’t always be told from the
 * configuration, so these files are refused wherever such a folder is, while other files in a
 * folder like `content/posts/cms` are left editable.
 * @param {string} dirPath Folder path.
 * @param {string} fileName File name.
 * @returns {boolean} Result.
 */
const isCmsFile = (dirPath, fileName) => {
  if (!CMS_FILE_NAME_REGEX.test(normalizePath(fileName))) {
    return false;
  }

  const names = [
    ...CMS_FOLDER_NAMES,
    ...getAdminPageFolders(globalThis.location?.pathname ?? '')
      .slice(-1)
      .map(normalizePath),
  ];

  return normalizePath(dirPath)
    .split('/')
    .some((segment) => names.includes(segment));
};

/**
 * Check whether the given file is below a folder the CMS itself may be served from, or is the admin
 * page or its configuration file in a folder named like one.
 * @param {string} path File path.
 * @returns {boolean} Result.
 */
export const isInCmsFolder = (path) => {
  const index = path.lastIndexOf('/');
  const dirPath = path.slice(0, Math.max(index, 0));

  return isCmsFolderPath(dirPath) || isCmsFile(dirPath, path.slice(index + 1));
};

/**
 * Make sure none of the given files is below a folder the CMS itself may be served from, or is the
 * admin page or its configuration file in a folder named like one. The Asset Library doesn’t offer
 * to change those files, so this is only a safeguard.
 * @param {string[]} paths File paths.
 * @throws {Error} When one of them is.
 */
export const assertOutsideCmsFolders = (paths) => {
  if (paths.some(isInCmsFolder)) {
    throw new Error('Cannot change a file in a folder the CMS is served from');
  }
};
