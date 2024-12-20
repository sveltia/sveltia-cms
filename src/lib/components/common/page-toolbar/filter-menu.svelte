<script>
  import { Menu, MenuButton, MenuItemCheckbox, MenuItemRadio } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';

  /**
   * @typedef {object} Props
   * @property {import('svelte/store').Writable<EntryListView | AssetListView>} currentView -
   * Current view details.
   * @property {string} aria-controls - The `aria-controls` attribute for the menu.
   * @property {string} [label] - Menu button label.
   * @property {boolean} [disabled] - Whether to disable the button.
   * @property {boolean} [multiple] - Whether to allow selecting multiple filter conditions.
   * @property {string} [noneLabel] - Label to be displayed on the None item.
   * @property {ViewFilter[]} [filters] - Filter conditions.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    currentView,
    'aria-controls': ariaControls,
    label = '',
    disabled = false,
    multiple = false,
    noneLabel = '',
    filters = [],
    /* eslint-enable prefer-const */
  } = $props();
</script>

<MenuButton variant="ghost" label={label || $_('filter')} {disabled} popupPosition="bottom-right">
  {#snippet popup()}
    <Menu aria-label={$_('filtering_options')} aria-controls={ariaControls}>
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
