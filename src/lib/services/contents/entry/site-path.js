import { getPreviewPath } from '$lib/services/contents/entry';

/**
 * Get the given entry’s site-relative path on the live site, based on the `preview_path` option.
 * Unlike {@link getPreviewPath}, the result always has a leading slash, as Hugo and Zola resolve an
 * alias relative to the current page without one.
 * @param {Parameters<typeof getPreviewPath>[0]} args Arguments.
 * @returns {string | undefined} Path, or `undefined` if it cannot be determined.
 */
export const getSitePath = (args) => {
  const path = getPreviewPath(args);

  return path === undefined ? undefined : `/${path.replace(/^\//, '')}`;
};
