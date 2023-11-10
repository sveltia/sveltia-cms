<script>
  import { Icon, Menu, MenuButton, MenuItemCheckbox, MenuItemRadio } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';
  import { writable } from 'svelte/store';

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
  export let currentView = writable({});
  /**
   * @type {ViewFilter[]}
   */
  export let filters = [];
</script>

<MenuButton variant="ghost" label={label || $_('filter_by')} {disabled}>
  <Icon slot="end-icon" name="arrow_drop_down" />
  <Menu slot="popup">
    {#if multiple}
      {#each filters as { label: _label, field, pattern }}
        {@const index = ($currentView.filters || []).findIndex(
          (f) => f.field === field && f.pattern === pattern,
        )}
        <MenuItemCheckbox
          label={_label}
          checked={index > -1}
          on:click={() => {
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
        on:click={() => {
          currentView.update((view) => ({
            ...view,
            filter: undefined,
          }));
        }}
      />
      {#each filters as { label: _label, field, pattern }}
        <MenuItemRadio
          label={_label}
          checked={$currentView.filter?.field === field && $currentView.filter?.pattern === pattern}
          on:click={() => {
            currentView.update((view) => ({
              ...view,
              filter: { field, pattern },
            }));
          }}
        />
      {/each}
    {/if}
  </Menu>
</MenuButton>
