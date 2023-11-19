<script>
  import { Button, Icon } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';
  import Image from '$lib/components/common/image.svelte';
  import { formatSize } from '$lib/services/utils/files';

  /**
   * @type {File[]}
   */
  export let files = [];
</script>

<div role="none" class="files">
  {#each files as file, index}
    {@const { name, type, size } = file}
    {@const [, extension = ''] = name.match(/\.([^.]+)$/) ?? []}
    <div role="none" class="file">
      {#if type.startsWith('image/')}
        <Image src={URL.createObjectURL(file)} variant="icon" checkerboard={true} />
      {:else}
        <span role="none" class="image">
          <Icon name="draft" />
        </span>
      {/if}
      <div role="none" class="meta">
        <div role="none" class="name">{name}</div>
        <div role="none" class="size">
          {formatSize(size)}
          ·
          {$_(`file_type_labels.${extension}`, { default: extension.toUpperCase() })}
        </div>
      </div>
      <Button
        variant="ghost"
        iconic
        aria-label={$_('remove')}
        on:click={(event) => {
          event.stopPropagation();
          files.splice(index, 1);
          files = files;
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
    padding: 16px 0 0;
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

      .size {
        font-size: var(--sui-font-size-small);
        color: var(--sui-secondary-foreground-color);
      }
    }
  }
</style>
