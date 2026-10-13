/* eslint-disable no-console */

import { getFileHandle } from '$lib/services/backends/fs/shared/handles';
import { writeFile } from '$lib/services/backends/fs/shared/save';
import { mapConcurrently } from '$lib/services/backends/git/shared/concurrency';

/**
 * Selector of the `<link>` element pointing to the seed manifest, a JSON file listing the files to
 * be copied to an empty test repository, e.g.
 * `<link rel="cms-seed-url" href="/seed/manifest.json">`. The files are fetched from paths relative
 * to the manifest.
 */
const SEED_LINK_SELECTOR = 'link[rel="cms-seed-url"]';
/**
 * Maximum number of seed files to download at the same time.
 */
const SEED_FETCH_CONCURRENCY = 6;

/**
 * Get the URL of the seed manifest from the `<link rel="cms-seed-url">` element on the page.
 * @returns {string | undefined} Absolute URL, or `undefined` if there is no such link.
 */
export const getSeedManifestURL = () =>
  /** @type {HTMLLinkElement | null} */ (document.querySelector(SEED_LINK_SELECTOR))?.href ||
  undefined;

/**
 * Check if the CMS runs as a demo: the test backend is used with a seed manifest, so the user
 * starts with sample content rather than an empty repository.
 * @param {string | undefined} backendName Name of the configured backend.
 * @returns {boolean} Whether the CMS runs as a demo.
 */
export const isDemoSite = (backendName) => backendName === 'test-repo' && !!getSeedManifestURL();

/**
 * Check if a path in the seed manifest can be written to the repository: a relative path without
 * empty, `.` or `..` segments, so a file can’t end up outside the repository.
 * @param {unknown} path Path.
 * @returns {path is string} Whether the path is valid.
 */
export const isValidSeedPath = (path) =>
  typeof path === 'string' &&
  path.split('/').every((segment) => !!segment && segment !== '.' && segment !== '..');

/**
 * Fetch the seed manifest and get the list of files in it.
 * @param {string} manifestURL Manifest URL.
 * @returns {Promise<string[]>} Valid file paths in the manifest.
 * @throws {Error} If the manifest can’t be fetched or its `files` property is not an array.
 */
export const fetchSeedManifest = async (manifestURL) => {
  const response = await fetch(manifestURL);

  if (!response.ok) {
    throw new Error(`Failed to fetch the seed manifest: ${response.status}`);
  }

  const { files } = await response.json();

  if (!Array.isArray(files)) {
    throw new Error('The seed manifest must have a `files` array');
  }

  // Drop duplicates, so a file isn’t downloaded and written twice
  return [...new Set(files)].filter((path) => {
    if (isValidSeedPath(path)) {
      return true;
    }

    console.warn(`Skipping an invalid path in the seed manifest: ${JSON.stringify(path)}`);

    return false;
  });
};

/**
 * Download a seed file.
 * @param {string} manifestURL Manifest URL, which the file path is relative to.
 * @param {string} path File path.
 * @returns {Promise<Blob | undefined>} File content, or `undefined` if it can’t be downloaded.
 */
export const fetchSeedFile = async (manifestURL, path) => {
  // Encode each segment, so a file name with `#`, `?` or `%` is fetched as is
  const url = new URL(path.split('/').map(encodeURIComponent).join('/'), manifestURL);

  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.blob();
  } catch (ex) {
    console.warn(`Failed to seed ${path}:`, ex);

    return undefined;
  }
};

/**
 * Write a seed file to the repository.
 * @param {FileSystemDirectoryHandle} repoDirHandle Handle of the repository’s root directory.
 * @param {string} path File path.
 * @param {Blob} blob File content.
 */
export const writeSeedFile = async (repoDirHandle, path, blob) => {
  try {
    await writeFile(await getFileHandle(repoDirHandle, path), blob);
  } catch (ex) {
    console.warn(`Failed to seed ${path}:`, ex);
  }
};

/**
 * Copy the files listed in the seed manifest to the test repository if the repository doesn’t exist
 * yet, e.g. on the first visit to a demo site. An existing repository is left untouched, so the
 * user’s changes survive a reload; deleting the repository, e.g. with the Erase All Data option,
 * makes the next sign-in seed it again. Errors are logged rather than thrown, so the user can still
 * sign in, with whatever files could be written.
 * @param {FileSystemDirectoryHandle} storageDirHandle Root directory of the origin private file
 * system (OPFS).
 * @param {string} repoDirName Name of the directory holding the test repository.
 */
export const seedTestRepository = async (storageDirHandle, repoDirName) => {
  const manifestURL = getSeedManifestURL();

  if (!manifestURL) {
    return;
  }

  try {
    await storageDirHandle.getDirectoryHandle(repoDirName);

    // The repository already exists
    return;
  } catch {
    // The repository doesn’t exist yet
  }

  try {
    const paths = await fetchSeedManifest(manifestURL);

    // Download everything before creating the repository, so an interrupted download, e.g. when the
    // tab is closed, doesn’t leave a partial repository that would never be seeded again
    const blobs = await mapConcurrently(paths, (path) => fetchSeedFile(manifestURL, path), {
      concurrency: SEED_FETCH_CONCURRENCY,
    });

    // Don’t create an empty repository if nothing could be downloaded, e.g. when the connection is
    // lost, so the next sign-in tries again
    if (!blobs.some(Boolean)) {
      return;
    }

    const repoDirHandle = await storageDirHandle.getDirectoryHandle(repoDirName, { create: true });

    await Promise.all(
      paths.map((path, index) => {
        const blob = blobs[index];

        return blob ? writeSeedFile(repoDirHandle, path, blob) : undefined;
      }),
    );
  } catch (ex) {
    console.warn('Failed to seed the test repository:', ex);
  }
};
