<script>
  import { _ } from '@sveltia/i18n';
  import { Button, Icon, SelectButton, SelectButtonGroup } from '@sveltia/ui';

  import { env } from '$lib/services/user/env.svelte';

  /**
   * @import { AssetListView, EntryListView, SelectAssetsView, ViewType } from '$lib/types/private';
   */

  /**
   * @typedef {object} Props
   * @property {boolean} [disabled] Whether to disable the buttons.
   * @property {{ current: EntryListView | AssetListView | SelectAssetsView }} currentView Current
   * view details.
   * @property {ViewType[]} [types] View types to offer, in the order of the buttons, the first one
   * being the default. Default: list and grid. The table view is only offered on a large screen,
   * where it fits.
   */

  /** @type {Props & Record<string, any>} */
  let {
    /* eslint-disable prefer-const */
    disabled = false,
    currentView,
    types = ['list', 'grid'],
    ...rest
    /* eslint-enable prefer-const */
  } = $props();

  /**
   * Icon of each view type.
   * @type {Record<ViewType, string>}
   */
  const ICONS = { table: 'table', list: 'format_list_bulleted', grid: 'grid_view' };

  // The first type is the default one, which applies until the user picks a view, and also to a
  // saved view that isn’t offered anymore, e.g. the grid view of a collection without thumbnails
  const selectedType = $derived(
    currentView.current.type && types.includes(currentView.current.type)
      ? currentView.current.type
      : types[0],
  );
  const isGridView = $derived(selectedType === 'grid');
  // A smaller screen only switches between the list and grid views; the table view is shown as a
  // list there
  const hasCompactToggle = $derived(types.includes('list') && types.includes('grid'));

  /**
   * Switch to the given view type.
   * @param {ViewType} type View type.
   */
  const switchView = (type) => {
    currentView.current = { ...currentView.current, type };
  };
</script>

<div role="none" class="wrapper">
  {#if env.isLargeScreen}
    {#if types.length > 1}
      <SelectButtonGroup {disabled} ariaLabel={_('switch_view')} {...rest}>
        {#each types as type (type)}
          <SelectButton
            {disabled}
            selected={selectedType === type}
            variant="ghost"
            iconic
            aria-label={_(`${type}_view`)}
            onSelect={() => {
              switchView(type);
            }}
          >
            {#snippet startIcon()}
              <Icon name={ICONS[type]} />
            {/snippet}
          </SelectButton>
        {/each}
      </SelectButtonGroup>
    {/if}
  {:else if hasCompactToggle}
    <Button
      {disabled}
      variant="ghost"
      iconic
      aria-label={_(isGridView ? 'switch_to_list_view' : 'switch_to_grid_view')}
      onclick={() => {
        switchView(isGridView ? 'list' : 'grid');
      }}
    >
      {#snippet startIcon()}
        <Icon name={isGridView ? ICONS.list : ICONS.grid} />
      {/snippet}
    </Button>
  {/if}
</div>

<style>
  .wrapper {
    display: contents;

    :global {
      .select-button-group button {
        border-radius: var(--sui-button-medium-border-radius) !important;
      }
    }
  }
</style>
