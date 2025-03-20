import { dependencies } from '$lib/services/app';

/**
 * Get the UNPKG CDN URL for the given dependency.
 * @param {string} name Dependency name.
 * @returns {string} URL.
 */
export const getUnpkgURL = (name) => {
  const url = `https://unpkg.com/${encodeURIComponent(name)}`;
  const version = /** @type {Record<string, string>} */ (dependencies)[name]?.replace(/^\D/, '');

  return version ? `${url}@${encodeURIComponent(version)}` : url;
};
