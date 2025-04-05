import { dependencies } from '$lib/services/app';

/**
 * Get the UNPKG CDN URL for the given dependency.
 * @param {string} name Dependency name.
 * @returns {string} URL.
 */
export const getUnpkgURL = (name) => {
  const url = `https://unpkg.com/${name}`;
  const version = /** @type {Record<string, string>} */ (dependencies)[name]?.replace(/^\D/, '');

  return version ? `${url}@${version}` : url;
};

/**
 * Load an ES module of a third-party library from UNPKG.
 * @param {string} library Library name.
 * @param {string} path Absolute path of the module.
 * @returns {Promise<any>} Module.
 */
export const loadModule = async (library, path) =>
  import(/* @vite-ignore */ `${getUnpkgURL(library)}${path}`);
