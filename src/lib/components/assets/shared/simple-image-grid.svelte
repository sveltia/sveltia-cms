<script>
  import { Listbox } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';

  export let viewType = 'grid';
  /**
   * The `id` attribute of the inner listbox.
   * @type {string}
   */
  export let gridId = undefined;
  /**
   * Whether to show the file name or title under the image while in grid view.
   */
  export let showTitle = false;
</script>

<div role="none" class="wrapper" class:show-title={showTitle}>
  <Listbox id={gridId} class={viewType} aria-label={$_('assets_dialog.available_images')} on:change>
    <slot />
  </Listbox>
</div>

<style lang="scss">
  .wrapper {
    display: contents;

    :global(.listbox) {
      gap: 4px;
      overflow-x: hidden;
      overflow-y: auto;
      border-width: 0;
      max-height: calc(100% - var(--sui-focus-ring-width) * 2);

      :global(.option) {
        :global(button) {
          border-radius: var(--sui-control-medium-border-radius);
          padding: 4px;
          width: 100%;
          height: auto;
          transition: none;

          :global(.preview) {
            flex: none;
            border-radius: var(--sui-control-medium-border-radius);
            aspect-ratio: 1 / 1;
            object-fit: contain;
          }
        }

        :global(button[aria-selected='true']) {
          outline-width: 4px;
          outline-style: solid;
          outline-color: var(--sui-primary-accent-color);

          :global(.icon) {
            display: none;
          }
        }
      }

      :global(.name) {
        display: -webkit-box;
        min-height: calc(var(--sui-font-size-default) * 2);
        -webkit-box-orient: vertical;
        -webkit-line-clamp: 2;
        overflow: hidden;
        white-space: normal;
        line-height: var(--sui-line-height-compact);
      }
    }

    :global(.listbox.grid) {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
      height: auto;

      :global(.option) {
        :global(button) {
          flex-direction: column;
          justify-content: flex-start;

          :global(.preview) {
            width: 100%;
            height: auto;
          }

          :global(.name) {
            flex: none;
            padding: 4px;
            width: 100%;
            min-height: calc(var(--sui-font-size-default) * 3);
            color: var(--sui-secondary-foreground-color);
          }
        }
      }
    }

    &:not(.wrapper.show-title) :global(.listbox.grid .option .name) {
      position: absolute;
      left: -99999px;
    }

    :global(.listbox.list) {
      :global(.option) {
        :global(button) {
          gap: 16px;

          :global(.preview) {
            width: 64px;
          }

          :global(.name) {
            flex: auto;
          }
        }
      }
    }
  }
</style>
