<!--
  @component
  Show a section of a sidebar panel, e.g. for a locale, headed with its label the way the Validation
  panel does. A section without a heading, e.g. for the only value in a panel, keeps its label for
  assistive technology.
-->
<script>
  /**
   * @import { Snippet } from 'svelte';
   */

  /**
   * @typedef {object} Props
   * @property {string} label Label of the section.
   * @property {boolean} [showLabel] Whether to show the label as the section heading.
   * @property {Snippet<[string]>} children Section content, given the ID of the label element to
   * label a field with.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    label,
    showLabel = true,
    children,
    /* eslint-enable prefer-const */
  } = $props();

  const id = $props.id();
  const labelId = `${id}-label`;
</script>

<!-- Only a headed section is a group of its own; the only value in a panel is the panel’s -->
<section
  role={showLabel ? 'group' : 'none'}
  class="section"
  aria-labelledby={showLabel ? labelId : undefined}
>
  {#if showLabel}
    <h4 id={labelId}>{label}</h4>
  {:else}
    <span id={labelId} hidden>{label}</span>
  {/if}
  <div role="none" class="content">
    {@render children(labelId)}
  </div>
</section>

<style>
  .section {
    padding: 4px;

    &:not(:first-child) {
      border-top: 2px solid var(--sui-secondary-background-color);
    }
  }

  h4 {
    margin: 0 !important;
    padding: 12px;
  }

  .content {
    padding: 4px 8px 8px;
  }
</style>
