<script>
  import { _ } from '@sveltia/i18n';
  import { Button } from '@sveltia/ui';

  import ExpandIcon from '$lib/components/common/expand-icon.svelte';

  /**
   * @import { Snippet } from 'svelte';
   */

  /**
   * @typedef {object} Props
   * @property {string} [label] Item label.
   * @property {number} [position] 1-based position of the item in its list, shown before the
   * label. Omitted for an Object field.
   * @property {string} controlId `aria-controls` ID.
   * @property {boolean} expanded Whether the item is expanded.
   * @property {boolean} [expandable] Whether the item can be expanded and collapsed. If `false`,
   * the label is displayed without the expander button, as there is nothing to show or hide.
   * Default: `true`.
   * @property {() => void} [toggleExpanded] Function to toggle the item.
   * @property {Snippet | undefined} [centerContent] Center slot content.
   * @property {Snippet | undefined} [endContent] End slot content.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    label = '',
    position = undefined,
    controlId,
    expanded = $bindable(),
    expandable = true,
    toggleExpanded,
    centerContent = undefined,
    endContent = undefined,
    /* eslint-enable prefer-const */
  } = $props();
</script>

{#snippet itemLabel()}
  {#if position !== undefined}
    <span role="none" class="position">{position}</span>
  {/if}
  {#if label}
    <span role="none" class="type">{label}</span>
  {/if}
{/snippet}

<div role="none" class="header">
  <div role="none" class="start">
    {#if expandable}
      <Button
        size="small"
        iconic={!label && position === undefined}
        aria-label={expanded ? _('collapse') : _('expand')}
        aria-expanded={expanded}
        aria-controls={controlId}
        onclick={() => {
          expanded = !expanded;
          toggleExpanded?.();
        }}
      >
        {#snippet startIcon()}
          <ExpandIcon {expanded} />
        {/snippet}
        {@render itemLabel()}
      </Button>
    {:else}
      <span role="none" class="label">
        {@render itemLabel()}
      </span>
    {/if}
  </div>
  <div role="none" class="center">
    {@render centerContent?.()}
  </div>
  <div role="none" class="end">
    {@render endContent?.()}
  </div>
</div>

<style>
  .header {
    display: flex;
    align-items: center;
    gap: 8px;
    height: 28px;
    background-color: var(--sui-secondary-border-color);

    & > div {
      display: flex;
      align-items: center;
    }

    .start {
      justify-content: flex-start;
      width: 40%;
    }

    .center {
      justify-content: center;
      width: 20%;
    }

    .end {
      justify-content: flex-end;
      width: 40%;
    }

    /* Make the expander button full-width when there is no other content */
    &:has(.center:empty):has(.end:empty) {
      .start {
        width: 100%;

        :global(button) {
          justify-content: flex-start;
          padding: var(--sui-button-small-padding);
          width: -moz-available;
          width: -webkit-fill-available;
          width: stretch;
          aspect-ratio: auto;
        }
      }

      .center,
      .end {
        display: none;
      }
    }

    .label {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: var(--sui-button-small-padding);
    }

    .position {
      min-width: 1.5em;
      font-size: var(--sui-font-size-small);
      font-weight: var(--sui-font-weight-bold);
      font-variant-numeric: tabular-nums;
      color: var(--sui-secondary-foreground-color);
      text-align: center;
    }

    .type {
      font-size: var(--sui-font-size-small);
      font-weight: var(--sui-font-weight-bold);
      color: var(--sui-secondary-foreground-color);
    }
  }
</style>
