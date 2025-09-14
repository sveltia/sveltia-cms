<script>
  import { Button, Icon, TruncatedText } from '@sveltia/ui';
  import { getPathInfo } from '@sveltia/utils/file';
  import { sleep } from '@sveltia/utils/misc';
  import { _, locale as appLocale } from 'svelte-i18n';

  import Image from '$lib/components/assets/shared/image.svelte';
  import { formatSize } from '$lib/services/utils/file';
  import { SUPPORTED_IMAGE_TYPES } from '$lib/services/utils/media/image';

  /**
   * @typedef {object} Props
   * @property {File[]} files File list.
   * @property {WeakMap<File, File>} [transformedFileMap] Mapping of transformed files and the
   * originals.
   * @property {boolean} [removable] Whether to show the Remove button on each row.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    files = $bindable([]),
    transformedFileMap = undefined,
    removable = true,
    /* eslint-enable prefer-const */
  } = $props();
</script>

<div role="list" class="files">
  {#each files as file, index}
    {#await sleep() then}
      {@const { name, type, size } = file}
      {@const originalFile = transformedFileMap?.get(file)}
      <div role="listitem" class="file">
        {#if SUPPORTED_IMAGE_TYPES.includes(type)}
          <Image src={URL.createObjectURL(file)} variant="icon" checkerboard={true} />
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
            {#key $appLocale}
              {$_('file_meta', {
                values: {
                  type: $_(`file_type_labels.${file.type.split('/')[1]}`, {
                    default: getPathInfo(name).extension?.toUpperCase(),
                  }),
                  size: formatSize(size),
                },
              })}
            {/key}
            {#if originalFile && originalFile.type !== file.type}
              {$_('file_meta_converted_from_x', {
                values: {
                  type: $_(`file_type_labels.${originalFile.type.split('/')[1]}`, {
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
          aria-label={$_('remove')}
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

<style lang="scss">
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
