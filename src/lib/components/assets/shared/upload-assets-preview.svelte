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

<div class="files">
  {#each files as file, index}
    {@const { name, type, size } = file}
    {@const [, extension = ''] = name.match(/\.([^.]+)$/) || []}
    <div class="file">
      {#if type.startsWith('image/')}
        <Image src={URL.createObjectURL(file)} />
      {:else}
        <span class="image">
          <Icon name="draft" />
        </span>
      {/if}
      <div class="meta">
        <div class="name">{name}</div>
        <div class="size">
          {formatSize(size)}
          ·
          {$_(`file_type_labels.${extension}`, { default: extension.toUpperCase() })}
        </div>
      </div>
      <Button
        class="ghost iconic"
        on:click={(event) => {
          event.stopPropagation();
          files.splice(index, 1);
          files = files;
        }}
      >
        <Icon name="close" label={$_('remove')} />
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

    :global(img),
    .image {
      width: 48px;
      height: 48px;
      aspect-ratio: 1 / 1;
      object-fit: cover;
      border-radius: var(--control--medium--border-radius);
    }

    .image {
      display: flex;
      justify-content: center;
      align-items: center;
      background-color: var(--tertiary-background-color);
    }

    .meta {
      flex: auto;
      display: flex;
      flex-direction: column;
      gap: 4px;

      .size {
        font-size: var(--font-size--small);
        color: var(--secondary-foreground-color);
      }
    }
  }
</style>
