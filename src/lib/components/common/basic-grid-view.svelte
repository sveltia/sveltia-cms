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
      display: block;
      position: relative;
      overflow: hidden;
      padding: 0;
      height: auto;
      text-align: left;
      cursor: pointer;

      &:focus-visible {
        outline-color: transparent;

        :global(.preview) {
          outline-offset: -2px;
          outline-width: 2px;
          outline-style: solid;
          outline-color: var(--sui-primary-accent-color-light);
        }
      }

      :global(.table-cell) {
        display: block;
      }

      :global(.checkbox) {
        position: absolute;
        inset: 8px auto auto 8px;
        z-index: 2;
      }

      :global(.title) {
        :global(span) {
          display: -webkit-box;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 2;
          overflow: hidden;
          margin: 12px 8px 0;
          height: 40px;
          line-height: 1.5;
        }
      }
    }
  }
</style>
