<!--
  @component
  Radio menu items of the Filter and Group menus: a None item and one item for each condition. The
  checked one is applied to the view, or cleared with the None item.
-->
<script>
  import { _ } from '@sveltia/i18n';
  import { MenuItemRadio } from '@sveltia/ui';

  import { getConditionKey, getViewConditions } from '$lib/services/common/view';

  /**
   * @import { AssetListView, EntryListView } from '$lib/types/private';
   * @import { ViewFilter, ViewGroup } from '$lib/types/public';
   */

  /**
   * @typedef {object} Props
   * @property {{ current: EntryListView | AssetListView }} currentView Current view details.
   * @property {'filter' | 'group'} viewKey View property holding the selected conditions.
   * @property {undefined | null} noneValue Value the view property is set to by the None item.
   * @property {string} [noneLabel] Label to be displayed on the None item.
   * @property {(ViewFilter | ViewGroup)[]} [options] Filter or group options.
   */

  /** @type {Props} */
  let { currentView, viewKey, noneValue, noneLabel = '', options = [] } = $props();

  const selected = $derived(currentView.current[viewKey]);
</script>

<MenuItemRadio
  label={noneLabel || _('sort_keys.none')}
  checked={!selected}
  onSelect={() => {
    currentView.current = { ...currentView.current, [viewKey]: noneValue };
  }}
/>
{#each options as option (getConditionKey(getViewConditions(option)))}
  {@const conditions = getViewConditions(option)}
  <MenuItemRadio
    label={option.label}
    checked={!!selected && getConditionKey(selected) === getConditionKey(conditions)}
    onSelect={() => {
      currentView.current = { ...currentView.current, [viewKey]: conditions };
    }}
  />
{/each}
