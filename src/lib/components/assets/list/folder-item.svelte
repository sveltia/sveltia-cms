<script>
  import { GridCell, GridRow, TruncatedText } from '@sveltia/ui';

  import FolderPreview from '$lib/components/assets/shared/folder-preview.svelte';
  import { isMediumScreen, isSmallScreen } from '$lib/services/user/env';

  /**
   * @import { ViewType } from '$lib/types/private';
   */

  /**
   * @typedef {object} Props
   * @property {string} title Title.
   * @property {() => void} onclick onClick.
   * @property {ViewType} viewType ViewType.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    title,
    onclick,
    viewType,
    /* eslint-enable prefer-const */
  } = $props();
</script>

<GridRow {onclick}>
  {#if !($isSmallScreen || $isMediumScreen)}
    <GridCell class="checkbox" />
  {/if}
  <GridCell class="image">
    <FolderPreview {viewType} />
  </GridCell>
  {#if !$isSmallScreen || viewType === 'list'}
    <GridCell class="title">
      <div role="none" class="label">
        <TruncatedText lines={2}>
          {title}
        </TruncatedText>
      </div>
    </GridCell>
  {/if}
</GridRow>

<style lang="scss">
  .label {
    word-break: break-all;
  }
</style>
