<script>
  /**
   * @import { Snippet } from 'svelte';
   */

  /**
   * @typedef {object} Props
   * @property {Snippet} [children] Slot content.
   */

  /** @type {Props & Record<string, any>} */
  let {
    /* eslint-disable prefer-const */
    children = undefined,
    ...rest
    /* eslint-enable prefer-const */
  } = $props();
</script>

<section role="group" class="field" {...rest}>
  {@render children?.()}
</section>

<style lang="scss">
  section {
    padding: var(--field-editor-padding);

    &:not(:last-child) {
      border-width: 0 0 1px;
      border-color: var(--sui-secondary-border-color);
    }

    :global {
      & > * {
        margin-inline: auto !important;
        max-width: 768px;
      }

      & > header {
        display: flex;
        align-items: center;
        margin: 0 -8px 8px;
        height: var(--sui-button-small-height);

        h4 {
          margin-inline: 8px 0;
          font-size: var(--sui-font-size-small);
          font-weight: var(--sui-font-weight-bold);
          color: var(--sui-secondary-foreground-color);
        }

        .required {
          margin: 2px 0 0 2px;
          color: var(--sui-error-foreground-color);
          font-size: var(--sui-font-size-large);
        }
      }
    }
  }
</style>
