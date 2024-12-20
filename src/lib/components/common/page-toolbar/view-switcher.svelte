<script>
  import { Icon, SelectButton, SelectButtonGroup } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';

  /**
   * @typedef {object} Props
   * @property {boolean} [disabled] - Whether to disable the buttons.
   * @property {import('svelte/store').Writable<EntryListView | AssetListView |
   * SelectAssetsView>} currentView - Current view details.
   */

  /** @type {Props & Record<string, any>} */
  let {
    /* eslint-disable prefer-const */
    disabled = false,
    currentView,
    ...rest
    /* eslint-enable prefer-const */
  } = $props();
</script>

<div role="none" class="wrapper">
  <SelectButtonGroup {disabled} aria-label={$_('switch_view')} {...rest}>
    <SelectButton
      {disabled}
      selected={$currentView.type !== 'grid'}
      variant="ghost"
      iconic
      aria-label={$_('list_view')}
      onSelect={() => {
        currentView.update((view) => ({
          ...view,
          type: 'list',
        }));
      }}
    >
      {#snippet startIcon()}
        <Icon name="format_list_bulleted" />
      {/snippet}
    </SelectButton>
    <SelectButton
      {disabled}
      selected={$currentView.type === 'grid'}
      variant="ghost"
      iconic
      aria-label={$_('grid_view')}
      onSelect={() => {
        currentView.update((view) => ({
          ...view,
          type: 'grid',
        }));
      }}
    >
      {#snippet startIcon()}
        <Icon name="grid_view" />
      {/snippet}
    </SelectButton>
  </SelectButtonGroup>
</div>

<style lang="scss">
  .wrapper {
    display: contents;

    :global(button) {
      border-radius: var(--sui-button-medium-border-radius) !important;
    }
  }
</style>
