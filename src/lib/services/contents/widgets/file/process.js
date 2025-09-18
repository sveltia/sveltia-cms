import { getHash } from '@sveltia/utils/crypto';
import equal from 'fast-deep-equal';
import DOMPurify from 'isomorphic-dompurify';
import { get } from 'svelte/store';

import { allAssets } from '$lib/services/assets';
import { getAssetPublicURL } from '$lib/services/assets/info';
import { transformFile } from '$lib/services/integrations/media-libraries/default';
import { getGitHash } from '$lib/services/utils/file';

/**
 * @import { EntryDraft, SelectedResource } from '$lib/types/private';
 * @import { DefaultMediaLibraryConfig } from '$lib/types/public';
 */

/**
 * Get the blob URL of an unsaved file that matches the given file.
 * @param {object} args Arguments.
 * @param {EntryDraft} args.draft Entry draft containing the resource.
 * @param {File} args.file File to be searched.
 * @returns {Promise<string | undefined>} Blob URL.
 */
const getExistingBlobURL = async ({ draft, file }) => {
  const hash = await getHash(file);
  /** @type {string | undefined} */
  let foundURL = undefined;

  await Promise.all(
    Object.entries(draft.files ?? {}).map(async ([blobURL, f]) => {
      if (!foundURL && (await getHash(f.file)) === hash) {
        foundURL = blobURL;
      }
    }),
  );

  return foundURL;
};

/**
 * Process a selected resource.
 * @param {object} args Arguments.
 * @param {EntryDraft} args.draft Entry draft containing the resource.
 * @param {SelectedResource} args.resource Resource to be processed.
 * @param {DefaultMediaLibraryConfig} args.libraryConfig Configuration for the media library.
 * @returns {Promise<{ value: string | undefined, credit: string, oversizedFileName: string |
 * undefined }>} Processed resource value, credit, and file name if the file is oversized.
 */
export const processResource = async ({ draft, resource, libraryConfig }) => {
  const { transformations, max_file_size: maxSize } = libraryConfig ?? {};
  const { url, credit } = resource;
  let { asset, file } = resource;
  /** @type {string | undefined} */
  let value = '';
  /** @type {string | undefined} */
  let oversizedFileName = undefined;

  if (file) {
    const existingBlobURL = await getExistingBlobURL({ draft, file });

    if (existingBlobURL) {
      value = existingBlobURL;
    } else {
      if (transformations) {
        file = await transformFile(file, transformations);
      }

      const sha = await getGitHash(file);
      const { folder } = resource;
      const existingAsset = get(allAssets).find((a) => a.sha === sha && equal(a.folder, folder));

      if (existingAsset) {
        // If the selected file has already been uploaded, use the existing asset instead of
        // uploading the same file twice
        asset = existingAsset;
        file = undefined;
      } else if (file.size > /** @type {number} */ (maxSize)) {
        oversizedFileName = file.name;
        file = undefined;
      } else {
        // Set a temporary blob URL, which will be later replaced with the actual file path
        value = URL.createObjectURL(file);
        // Cache the file itself for later upload
        draft.files[value] = { file, folder };
      }
    }
  }

  if (asset) {
    if (!asset.unsaved) {
      value = getAssetPublicURL(asset, {
        pathOnly: true,
        allowSpecial: true,
        entry: draft.originalEntry,
      });
    } else if (asset.file) {
      value = await getExistingBlobURL({ draft, file: asset.file });
    }
  }

  if (url) {
    value = url;
  }

  return {
    value,
    credit: credit
      ? DOMPurify.sanitize(credit, { ALLOWED_TAGS: ['a'], ALLOWED_ATTR: ['href'] })
      : '',
    oversizedFileName,
  };
};
