<script>
  import { Icon } from '@sveltia/ui';

  /**
   * @typedef {object} Props
   * @property {string} id - Alert ID referenced by `aria-errormessage`.
   * @property {import('svelte').Snippet} children - Slot content.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    id,
    children,
    /* eslint-enable prefer-const */
  } = $props();
</script>

<div role="alert" {id} class="validation" aria-live="polite">
  <div role="none">
    <Icon name="error" />
    {@render children()}
  </div>
</div>

<style lang="scss">
  .validation {
    color: var(--sui-error-foreground-color) !important;
    font-size: var(--sui-font-size-small);

    div {
      display: flex;
      align-items: center;
      gap: 4px;
      margin: 4px 0;

      :global(.icon) {
        flex: none;
        font-size: 16px; /* !hardcoded */
      }
    }
  }
</style>
