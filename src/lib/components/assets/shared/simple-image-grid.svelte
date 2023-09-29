<script>
  import { Listbox } from '@sveltia/ui';

  export let viewType = 'grid';
</script>

<div class="wrapper">
  <Listbox class={viewType} on:select>
    <slot />
  </Listbox>
</div>

<style lang="scss">
  .wrapper {
    display: contents;

    :global(.listbox) {
      gap: 4px;
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

          :global(img),
          :global(video) {
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
          :global(img),
          :global(video) {
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

          :global(img),
          :global(video) {
            width: 48px;
          }

          :global(.name) {
            flex: auto;
          }
        }
      }
    }
  }
</style>
