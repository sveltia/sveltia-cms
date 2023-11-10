<script>
  import { Listbox } from '@sveltia/ui';

  export let viewType = 'grid';
</script>

<div class="wrapper">
  <Listbox class={viewType} on:change>
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
      height: 100%;

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
    }

    :global(.listbox.grid) {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
      height: auto;
      max-height: 100%;

      :global(.option) {
        :global(button) {
          :global(.preview) {
            width: 100%;
          }

          :global(.name:not(:only-child)) {
            position: absolute;
            left: -99999px;
          }
        }
      }
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
            display: -webkit-box;
            -webkit-box-orient: vertical;
            -webkit-line-clamp: 2;
            overflow: hidden;
            white-space: normal;
            line-height: var(--sui-line-height-compact);
          }
        }
      }
    }
  }
</style>
