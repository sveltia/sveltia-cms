<script>
  import { Table, TableBody } from '@sveltia/ui';
</script>

<div class="basic-grid-view">
  <Table aria-multiselectable="true">
    <TableBody>
      <slot />
    </TableBody>
  </Table>
</div>

<style lang="scss">
  .basic-grid-view {
    display: contents;

    :global(.table-body) {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(var(--grid-size, 200px), 1fr));
      gap: 16px;
      border-width: 0;
    }

    :global([role='row']) {
      position: relative;
      overflow: hidden;
      border-width: 1px;
      border-style: solid;
      border-color: var(--secondary-border-color);
      border-radius: var(--control--medium--border-radius);
      padding: 0;
      height: auto;
      aspect-ratio: 1 / 1;
      text-align: left;
      cursor: pointer;

      :global(.table-cell) {
        display: block;
        position: absolute;
      }

      :global(.checkbox) {
        inset: 16px auto auto 16px;
        z-index: 2;
      }

      :global(.title) {
        inset: auto 0 0 0;
        z-index: 1;
        padding: 16px 16px 16px 16px;
        background-color: hsl(var(--background-color-4-hsl) / 80%);

        :global(span) {
          display: -webkit-box;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 2;
          overflow: hidden;
          height: 40px;
          line-height: 1.5;
        }
      }

      :global(.image) {
        inset: 0;
        z-index: 1;
      }
    }

    :global([role='row'][aria-selected='true']) {
      border-color: var(--primary-accent-color);
    }
  }
</style>
