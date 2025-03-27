<script>
  import { Button, Icon } from '@sveltia/ui';
  import { getPathInfo } from '@sveltia/utils/file';
  import { _, locale as appLocale } from 'svelte-i18n';
  import { formatSize } from '$lib/services/utils/file';
  import Image from '$lib/components/common/image.svelte';

  /**
   * @typedef {object} Props
   * @property {File[]} [files] File list.
   * @property {boolean} [removable] Whether to show the Remove button on each row.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    files = $bindable([]),
    removable = true,
    /* eslint-enable prefer-const */
  } = $props();
</script>

<div role="list" class="files">
  {#each files as file, index}
    {@const { name, type, size } = file}
    {@const { extension = '' } = getPathInfo(name)}
    <div role="listitem" class="file">
      {#if type.startsWith('image/')}
        <Image src={URL.createObjectURL(file)} variant="icon" checkerboard={true} />
      {:else}
        <span role="none" class="image">
          <Icon name="draft" />
        </span>
      {/if}
      <div role="none" class="meta">
        <div role="none" class="name">{name.normalize()}</div>
        <div role="none" class="size">
          {$appLocale ? formatSize(size) : ''}
          ·
          {$_(`file_type_labels.${extension}`, { default: extension.toUpperCase() })}
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

    .image {
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

    .meta {
      flex: auto;
      display: flex;
      flex-direction: column;
      gap: 4px;
      text-align: left;

      .size {
        font-size: var(--sui-font-size-small);
        color: var(--sui-secondary-foreground-color);
      }
    }
  }
</style>
