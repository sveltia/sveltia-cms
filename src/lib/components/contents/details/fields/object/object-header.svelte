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
   * @property {string} controlId `aria-controls` ID.
   * @property {boolean} expanded Whether the item is expanded.
   * @property {() => void} [toggleExpanded] Function to toggle the item.
   * @property {Snippet | undefined} [centerContent] Center slot content.
   * @property {Snippet | undefined} [endContent] End slot content.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    label = '',
    controlId,
    expanded = $bindable(),
    toggleExpanded,
    centerContent = undefined,
    endContent = undefined,
    /* eslint-enable prefer-const */
  } = $props();
</script>

<div role="none" class="header">
  <div role="none" class="start">
    <Button
      size="small"
      iconic={!label}
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
      {#if label}
        <span role="none" class="type">
          {label}
        </span>
      {/if}
    </Button>
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

    .type {
      font-size: var(--sui-font-size-small);
      font-weight: var(--sui-font-weight-bold);
      color: var(--sui-secondary-foreground-color);
    }
  }
</style>
