<script>
  import { Button, Icon } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';

  /**
   * @type {string}
   */
  export let label = '';
  /**
   * @type {string}
   */
  export let controlId;
  /**
   * @type {boolean}
   */
  export let expanded;
  /**
   * @type {() => void}
   */
  export let toggleExpanded;
  /**
   * @type {boolean}
   */
  export let removeButtonVisible = false;
  /**
   * @type {boolean}
   */
  export let removeButtonDisabled = false;
  /**
   * @type {() => void}
   */
  export let remove;
  /**
   * Slot content.
   * @type {import('svelte').Snippet | undefined}
   */
  export let children = undefined;
</script>

<div role="none" class="header">
  <div role="none">
    <Button
      size="small"
      aria-label={expanded ? $_('collapse') : $_('expand')}
      aria-expanded={expanded}
      aria-controls={controlId}
      onclick={() => {
        toggleExpanded();
      }}
    >
      {#snippet startIcon()}
        <Icon name={expanded ? 'expand_more' : 'chevron_right'} />
      {/snippet}
      {#if label}
        <span role="none" class="type">
          {label}
        </span>
      {/if}
    </Button>
  </div>
  <div role="none">
    {@render children?.()}
  </div>
  <div role="none">
    {#if removeButtonVisible}
      <Button
        size="small"
        iconic
        disabled={removeButtonDisabled}
        aria-label={$_('remove_this_item')}
        onclick={() => {
          remove();
        }}
      >
        {#snippet startIcon()}
          <Icon name="close" />
        {/snippet}
      </Button>
    {/if}
  </div>
</div>

<style lang="scss">
  .header {
    display: flex;
    align-items: center;
    gap: 8px;
    background-color: var(--sui-selected-background-color);

    & > div {
      display: flex;
      align-items: center;

      &:first-child {
        justify-content: flex-start;
        width: 40%;
      }

      &:nth-child(2) {
        width: 20%;
        justify-content: center;
      }

      &:last-child {
        width: 40%;
        justify-content: flex-end;
      }
    }

    :global(button) {
      padding: 0;
      height: 16px;
    }

    .type {
      font-size: var(--sui-font-size-small);
      font-weight: var(--sui-font-weight-bold);
      color: var(--sui-secondary-foreground-color);
    }
  }
</style>
