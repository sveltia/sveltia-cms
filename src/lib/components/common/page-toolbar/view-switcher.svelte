<script>
  import { Button, Icon, SelectButton, SelectButtonGroup } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';
  import { isLargeScreen } from '$lib/services/user/env';

  /**
   * @import { Writable } from 'svelte/store';
   * @import { AssetListView, EntryListView, SelectAssetsView } from '$lib/types/private';
   */

  /**
   * @typedef {object} Props
   * @property {boolean} [disabled] Whether to disable the buttons.
   * @property {Writable<EntryListView | AssetListView | SelectAssetsView>} currentView Current view
   * details.
   */

  /** @type {Props & Record<string, any>} */
  let {
    /* eslint-disable prefer-const */
    disabled = false,
    currentView,
    ...rest
    /* eslint-enable prefer-const */
  } = $props();

  const isGridView = $derived($currentView.type === 'grid');
</script>

<div role="none" class="wrapper">
  {#if $isLargeScreen}
    <SelectButtonGroup {disabled} aria-label={$_('switch_view')} {...rest}>
      <SelectButton
        {disabled}
        selected={!isGridView}
        variant="ghost"
        iconic
        aria-label={$_('list_view')}
        onSelect={() => {
          currentView.update((view) => ({ ...view, type: 'list' }));
        }}
      >
        {#snippet startIcon()}
          <Icon name="format_list_bulleted" />
        {/snippet}
      </SelectButton>
      <SelectButton
        {disabled}
        selected={isGridView}
        variant="ghost"
        iconic
        aria-label={$_('grid_view')}
        onSelect={() => {
          currentView.update((view) => ({ ...view, type: 'grid' }));
        }}
      >
        {#snippet startIcon()}
          <Icon name="grid_view" />
        {/snippet}
      </SelectButton>
    </SelectButtonGroup>
  {:else}
    <Button
      {disabled}
      variant="ghost"
      iconic
      aria-label={$_(isGridView ? 'switch_to_list_view' : 'switch_to_grid_view')}
      onclick={() => {
        currentView.update((view) => ({ ...view, type: isGridView ? 'list' : 'grid' }));
      }}
    >
      {#snippet startIcon()}
        <Icon name={isGridView ? 'format_list_bulleted' : 'grid_view'} />
      {/snippet}
    </Button>
  {/if}
</div>

<style lang="scss">
  .wrapper {
    display: contents;

    :global {
      .select-button-group button {
        border-radius: var(--sui-button-medium-border-radius) !important;
      }
    }
  }
</style>
