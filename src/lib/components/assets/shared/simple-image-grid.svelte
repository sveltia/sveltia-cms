<script>
  import { Listbox } from '@sveltia/ui';
</script>

<div class="wrapper">
  <Listbox class="grid" on:select>
    <slot />
  </Listbox>
</div>

<style lang="scss">
  .wrapper {
    display: contents;

    :global(.listbox) {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
      gap: 8px;
      overflow-y: auto;
      border-width: 0;
      padding: 16px;

      :global(.option) {
        :global(button) {
          border-radius: 0;
          padding: 0;
          width: 100%;
          height: auto;
          transition: none;

          :global(img) {
            width: 100%;
            height: 100%;
            aspect-ratio: 1 / 1;
            object-fit: contain;
          }
        }

        :global(button[aria-selected='true']) {
          outline-width: 4px;
          outline-style: solid;
          outline-color: var(--primary-accent-color);

          :global(.icon) {
            display: none;
          }
        }
      }
    }
  }
</style>
