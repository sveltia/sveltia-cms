<script>
  import { Icon } from '@sveltia/ui';

  /**
   * @import { ViewType } from '$lib/types/private';
   */

  /**
   * @typedef {object} Props
   * @property {ViewType} viewType ViewType.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    viewType,
    /* eslint-enable prefer-const */
  } = $props();
</script>

<span class="dir-preview {viewType}">
  <span role="none">
    <Icon name="folder" />
  </span>
</span>

<style>
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
      width: 100%;
      height: 100%;
    }

    &.grid > span {
      border: 1px solid var(--sui-control-border-color);
      border-radius: var(--sui-control-medium-border-radius);
      background-color: var(--sui-secondary-background-color);

      :global(.icon) {
        font-size: 48px;
        color: var(--sui-secondary-foreground-color);
        opacity: 0.6;
      }
    }

    &.list :global(.icon) {
      font-size: 36px;
    }
  }
</style>
