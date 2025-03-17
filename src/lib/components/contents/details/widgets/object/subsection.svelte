<script>
  import { waitForVisibility } from '@sveltia/utils/element';

  /**
   * @import { Snippet } from 'svelte';
   */

  /**
   * @typedef {object} Props
   * @property {string} [label] Subsection label.
   * @property {Snippet} children Slot content.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    label,
    children,
    /* eslint-enable prefer-const */
  } = $props();

  const sectionId = $props.id();
  const headerId = `${sectionId}-header`;
  /** @type {HTMLElement | undefined} */
  let wrapper = $state();
</script>

<div
  role="group"
  class="subsection"
  aria-labelledby={label ? headerId : undefined}
  bind:this={wrapper}
>
  {#if label}
    <div role="none" id={headerId} class="header">
      {label}
    </div>
  {/if}
  <div class="items">
    {#await waitForVisibility(wrapper) then}
      {@render children?.()}
    {/await}
  </div>
</div>

<style lang="scss">
  .subsection {
    margin: 16px auto;
    border: 2px solid var(--sui-secondary-border-color);
    border-radius: var(--sui-control-medium-border-radius);

    :global(.title) {
      font-size: inherit;
      font-weight: var(--sui-font-weight-normal);
    }
  }

  .header {
    display: flex;
    align-items: center;
    height: 24px;
    padding-inline: 8px;
    color: var(--sui-secondary-foreground-color);
    background-color: var(--sui-secondary-border-color);
    font-size: var(--sui-font-size-small);
    font-weight: var(--sui-font-weight-bold);
  }

  .items {
    padding: 8px 16px;

    &:empty {
      display: none;
    }
  }
</style>
