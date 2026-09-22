<!--
  @component
  Subfolders of the folder being browsed in the asset picker, listed ahead of the assets as buttons
  that open them. A folder is opened rather than selected, so it isn’t an option in the list box of
  assets below.
-->
<script>
  import { _ } from '@sveltia/i18n';
  import { Button, Icon } from '@sveltia/ui';

  /**
   * @import { AssetSubfolder, ViewType } from '$lib/types/private';
   */

  /**
   * @typedef {object} Props
   * @property {AssetSubfolder[]} subfolders Subfolders.
   * @property {ViewType} [viewType] View type, which lays the folders out in a grid or a column.
   * @property {(subfolder: AssetSubfolder) => void} [onOpen] Called when a subfolder is opened.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    subfolders,
    viewType = 'grid',
    onOpen = undefined,
    /* eslint-enable prefer-const */
  } = $props();
</script>

<div role="list" class="subfolders {viewType}" aria-label={_('folders')}>
  {#each subfolders as subfolder (subfolder.path)}
    <div role="listitem">
      <Button
        variant="ghost"
        class="subfolder"
        label={subfolder.name}
        aria-description={_('folder')}
        onclick={() => {
          onOpen?.(subfolder);
        }}
      >
        {#snippet startIcon()}
          <Icon name="folder" />
        {/snippet}
      </Button>
    </div>
  {/each}
</div>

<style>
  .subfolders {
    display: grid;
    gap: 4px;
    margin-bottom: 8px;

    &.grid {
      grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    }

    /* The button fills the cell, but with `flex` rather than `width: 100%`, which would leave the
    margin it keeps for its focus ring sticking out of the cell, making the panel scroll sideways */

    [role='listitem'] {
      display: flex;
      min-width: 0;
    }

    :global {
      .subfolder {
        flex: auto;
        justify-content: flex-start;
        min-width: 0;
        height: 40px;

        .label {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
      }
    }
  }
</style>
