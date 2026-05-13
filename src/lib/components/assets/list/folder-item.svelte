<script>
  import { GridCell, GridRow, Icon, TruncatedText } from '@sveltia/ui';

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
    <span class="dir-preview {viewType}">
      <span role="none">
        <Icon name="folder" />
      </span>
    </span>
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

  .dir-preview {
    display: block;
    &.grid {
      padding: 12px;
    }

    & > span {
      display: flex;
      align-items: center;
      justify-content: center;
      aspect-ratio: 1 / 1;

      :global(.icon) {
        font-size: 48px;
        color: var(--sui-secondary-foreground-color);
        opacity: 0.6;
      }
    }

    &.grid > span {
      border: 1px solid var(--sui-control-border-color);
      border-radius: var(--sui-control-medium-border-radius);
      background-color: var(--sui-secondary-background-color);
    }

    &.list > span {
      width: 48px;
      aspect-ratio: unset;
      height: 48px;
      flex: none;

      :global(.icon) {
        font-size: 24px;
      }
    }
  }
</style>
