<script>
  import { ConfirmationDialog } from '@sveltia/ui';
  import { createEventDispatcher } from 'svelte';
  import { _ } from 'svelte-i18n';
  import { listedAssets } from '$lib/services/assets/view';
  import { deleteAssets } from '$lib/services/assets/data';

  export let open = false;
  /**
   * @type {string}
   */
  export let description = '';
  /**
   * @type {Asset[]}
   */
  export let assets = [];

  const dispatch = createEventDispatcher();
</script>

<ConfirmationDialog
  bind:open
  title={assets.length === 1 ? $_('delete_asset') : $_('delete_assets')}
  okLabel={$_('delete')}
  on:ok={() => {
    deleteAssets(assets);
    dispatch('delete');
  }}
>
  {#if description}
    {description}
  {:else if assets.length === 1}
    {$_('confirm_deleting_selected_asset')}
  {:else if assets.length === $listedAssets.length}
    {$_('confirm_deleting_all_assets')}
  {:else}
    {$_('confirm_deleting_selected_assets', { values: { count: assets.length } })}
  {/if}
</ConfirmationDialog>
