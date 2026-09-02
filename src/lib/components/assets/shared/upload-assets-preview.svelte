<script>
  import { _, locale as appLocale } from '@sveltia/i18n';
  import { Button, Icon, TruncatedText } from '@sveltia/ui';
  import { getPathInfo } from '@sveltia/utils/file';
  import { sleep } from '@sveltia/utils/misc';
  import { onDestroy } from 'svelte';

  import Image from '$lib/components/assets/shared/image.svelte';
  import { formatSize } from '$lib/services/utils/file';
  import { SUPPORTED_IMAGE_TYPES } from '$lib/services/utils/media/image';

  /**
   * @typedef {object} Props
   * @property {File[]} files File list.
   * @property {WeakMap<File, File>} [transformedFileMap] Mapping of transformed files and the
   * originals.
   * @property {boolean} [removable] Whether to show the Remove button on each row.
   * @property {boolean} [showThumbnail] Whether to show a thumbnail of each image file. Disable
   * this for files the browser cannot decode, which would only ever render as a broken image.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    files = $bindable([]),
    transformedFileMap = undefined,
    removable = true,
    showThumbnail = true,
    /* eslint-enable prefer-const */
  } = $props();

  /**
   * Thumbnail blob URLs, keyed by the file they were created from. A blob URL keeps the whole file
   * alive until it’s revoked, so each file gets exactly one URL, reused across renders and released
   * as soon as the file leaves the list or the component is destroyed. Creating the URL inline in
   * the markup instead would strand a copy of every previewed upload for the rest of the session.
   * @type {Map<File, string>}
   */
  // eslint-disable-next-line svelte/prefer-svelte-reactivity
  const thumbnailURLs = new Map();

  /**
   * Get the thumbnail blob URL for the given file, creating it on first use.
   * @param {File} file File.
   * @returns {string} Blob URL.
   */
  const getThumbnailURL = (file) => {
    let url = thumbnailURLs.get(file);

    if (url === undefined) {
      url = URL.createObjectURL(file);
      thumbnailURLs.set(file, url);
    }

    return url;
  };

  // Release the URLs of files the user has removed from the list. This runs after the render that
  // added any new files, so a file that is merely reordered keeps its URL — and its `<img>` doesn’t
  // reload.
  $effect(() => {
    const listedFiles = new Set(files);

    thumbnailURLs.forEach((url, file) => {
      if (!listedFiles.has(file)) {
        URL.revokeObjectURL(url);
        thumbnailURLs.delete(file);
      }
    });
  });

  onDestroy(() => {
    thumbnailURLs.forEach((url) => URL.revokeObjectURL(url));
    thumbnailURLs.clear();
  });
</script>

<div role="list" class="files">
  {#each files as file, index (`${file.name}-${index}`)}
    {#await sleep() then}
      {@const { name, type, size } = file}
      {@const originalFile = transformedFileMap?.get(file)}
      <div role="listitem" class="file">
        {#if showThumbnail && SUPPORTED_IMAGE_TYPES.includes(type)}
          <Image src={getThumbnailURL(file)} variant="icon" checkerboard={true} />
        {:else}
          <span role="none" class="image">
            <Icon name="draft" />
          </span>
        {/if}
        <div role="none" class="info">
          <div role="none" class="name">
            <TruncatedText>
              {name.normalize()}
            </TruncatedText>
          </div>
          <div role="none" class="meta">
            {#key appLocale.current}
              <bdi>
                {_(`file_type_labels.${file.type.split('/')[1]}`, {
                  default: getPathInfo(name).extension?.toUpperCase(),
                })}
              </bdi>
              ·
              <bdi>{formatSize(size)}</bdi>
            {/key}
            {#if originalFile && originalFile.type !== file.type}
              {_('file_meta_converted_from_x', {
                values: {
                  type: _(`file_type_labels.${originalFile.type.split('/')[1]}`, {
                    default: getPathInfo(originalFile.name).extension?.toUpperCase(),
                  }),
                },
              })}
            {/if}
          </div>
        </div>
        <Button
          variant="ghost"
          iconic
          aria-label={_('remove')}
          hidden={!removable || files.length === 1}
          onclick={(event) => {
            event.stopPropagation();
            files.splice(index, 1);
          }}
        >
          <Icon name="close" />
        </Button>
      </div>
    {/await}
  {/each}
</div>

<style>
  .files {
    display: flex;
    flex-direction: column;
    gap: 16px;
    margin: 0 8px;
  }

  .file {
    display: flex;
    align-items: center;
    gap: 16px;
    overflow: hidden;

    :global(.preview) {
      flex: none;
    }

    .image {
      flex: none;
      display: flex;
      justify-content: center;
      align-items: center;
      width: 40px;
      height: 40px;
      aspect-ratio: 1 / 1;
      object-fit: cover;
      border-radius: var(--sui-control-medium-border-radius);
      background-color: var(--sui-tertiary-background-color);
    }

    .info {
      flex: auto;
      display: flex;
      flex-direction: column;
      gap: 4px;
      overflow: hidden;
      text-align: start;

      .meta {
        font-size: var(--sui-font-size-small);
        color: var(--sui-secondary-foreground-color);
      }
    }
  }
</style>
