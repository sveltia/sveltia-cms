<script>
  import { Grid, RowGroup } from '@sveltia/ui';
</script>

<div class="basic-list-view">
  <Grid>
    <RowGroup>
      <slot />
    </RowGroup>
  </Grid>
</div>

<style lang="scss">
  .basic-list-view {
    display: contents;

    :global([role='grid']) {
      :global([role='row']) {
        width: 100%;
        height: 48px;
        cursor: pointer;
      }

      :global([role='row']:hover) {
        background-color: var(--highlight-background-color);
      }

      :global([role='gridcell']) {
        vertical-align: middle;
        overflow: hidden;
        text-overflow: ellipsis;
        height: 40px;
        padding: 0 8px;
        max-width: 100%;
        color: var(--secondary-foreground-color);
        white-space: nowrap;

        :global(.label) {
          overflow: hidden;
          text-overflow: ellipsis;
        }
      }

      :global([role='gridcell']:first-child) {
        padding-left: 16px;
      }

      :global([role='gridcell']:last-child) {
        padding-right: 16px;
      }

      :global([role='row'] [role='gridcell']) {
        border-width: 1px 0 0;
        border-color: var(--control-border-color);
      }

      :global([role='row']:last-child [role='gridcell']) {
        border-width: 1px 0;
      }

      :global([role='gridcell'].checkbox) {
        width: 16px;
      }

      :global([role='gridcell'].title) {
        width: 100%; // flex: auto
        color: var(--primary-foreground-color);
      }

      :global([role='gridcell'].image) {
        width: 32px;

        :global(img) {
          background-color: var(--primary-accent-color-foreground);
        }

        :global(img),
        :global(video) {
          width: 32px;
          height: 32px;
          border-radius: var(--control--medium--border-radius);
        }
      }
    }
  }
</style>
