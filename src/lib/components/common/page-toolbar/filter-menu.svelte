<script>
  import { _ } from '@sveltia/i18n';
  import { Menu, MenuButton, MenuItemCheckbox, MenuItemRadio } from '@sveltia/ui';

  import { getConditionKey, getViewConditions } from '$lib/services/common/view';

  /**
   * @import { AssetListView, EntryListView } from '$lib/types/private';
   * @import { ViewFilter } from '$lib/types/public';
   */

  /**
   * @typedef {object} Props
   * @property {{ current: EntryListView | AssetListView }} currentView Current view details.
   * @property {string} aria-controls The `aria-controls` attribute for the menu.
   * @property {string} [label] Menu button label.
   * @property {boolean} [disabled] Whether to disable the button.
   * @property {boolean} [multiple] Whether to allow selecting multiple filter conditions.
   * @property {string} [noneLabel] Label to be displayed on the None item.
   * @property {ViewFilter[]} [filters] Filter conditions.
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

<MenuButton variant="ghost" label={label || _('filter')} {disabled} popupPosition="bottom-right">
  {#snippet popup()}
    <Menu ariaLabel={_('filtering_options')} aria-controls={ariaControls}>
      {#if multiple}
        {#each filters as filter (getConditionKey(getViewConditions(filter)))}
          {@const { label: _label } = filter}
          {@const conditions = getViewConditions(filter)}
          {@const key = getConditionKey(conditions)}
          {@const index = (currentView.current.filters || []).findIndex(
            (f) => getConditionKey(f) === key,
          )}
          <MenuItemCheckbox
            label={_label}
            checked={index > -1}
            onChange={() => {
              const view = currentView.current;
              const updatedFilters = view.filters ? [...view.filters] : [];

              if (index > -1) {
                updatedFilters.splice(index, 1);
              } else {
                updatedFilters.push(conditions);
              }

              currentView.current = { ...view, filters: updatedFilters };
            }}
          />
        {/each}
      {:else}
        <MenuItemRadio
          label={noneLabel || _('sort_keys.none')}
          checked={!currentView.current.filter}
          onSelect={() => {
            currentView.current = {
              ...currentView.current,
              filter: undefined,
            };
          }}
        />
        {#each filters as filter (getConditionKey(getViewConditions(filter)))}
          {@const { label: _label } = filter}
          {@const conditions = getViewConditions(filter)}
          {@const key = getConditionKey(conditions)}
          <MenuItemRadio
            label={_label}
            checked={!!currentView.current.filter &&
              getConditionKey(currentView.current.filter) === key}
            onSelect={() => {
              currentView.current = {
                ...currentView.current,
                filter: conditions,
              };
            }}
          />
        {/each}
      {/if}
    </Menu>
  {/snippet}
</MenuButton>
