<script>
  import { Icon, Menu, MenuButton, MenuItemCheckbox, MenuItemRadio } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';

  export let label = '';
  export let disabled = false;
  /**
   * @type {boolean}
   */
  export let multiple = false;
  /**
   * @type {string}
   */
  export let noneLabel = '';
  /**
   * @type {import('svelte/store').Writable<EntryListView | AssetListView>}
   */
  export let currentView;
  /**
   * @type {ViewFilter[]}
   */
  export let filters = [];
</script>

<MenuButton variant="ghost" label={label || $_('filter')} {disabled} popupPosition="bottom-right">
  {#snippet endIcon()}
    <Icon name="arrow_drop_down" />
  {/snippet}
  {#snippet popup()}
    <Menu aria-label={$_('filtering_options')} aria-controls={$$restProps['aria-controls']}>
      {#if multiple}
        {#each filters as { label: _label, field, pattern }}
          {@const index = ($currentView.filters || []).findIndex(
            (f) => f.field === field && f.pattern === pattern,
          )}
          <MenuItemCheckbox
            label={_label}
            checked={index > -1}
            onChange={() => {
              currentView.update((view) => {
                const updatedFilters = view.filters ? [...view.filters] : [];

                if (index > -1) {
                  updatedFilters.splice(index, 1);
                } else {
                  updatedFilters.push({ field, pattern });
                }

                return { ...view, filters: updatedFilters };
              });
            }}
          />
        {/each}
      {:else}
        <MenuItemRadio
          label={noneLabel || $_('sort_keys.none')}
          checked={!$currentView.filter}
          onSelect={() => {
            currentView.update((view) => ({
              ...view,
              filter: undefined,
            }));
          }}
        />
        {#each filters as { label: _label, field, pattern }}
          <MenuItemRadio
            label={_label}
            checked={$currentView.filter?.field === field &&
              $currentView.filter?.pattern === pattern}
            onSelect={() => {
              currentView.update((view) => ({
                ...view,
                filter: { field, pattern },
              }));
            }}
          />
        {/each}
      {/if}
    </Menu>
  {/snippet}
</MenuButton>
