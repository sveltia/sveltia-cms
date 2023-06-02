<script>
  import { Dialog } from '@sveltia/ui';
  import { createEventDispatcher } from 'svelte';
  import { _ } from 'svelte-i18n';
  import { listedAssets } from '$lib/services/assets/view';
  import { deleteAssets } from '$lib/services/assets/data';

  export let open = false;
  /**
   * @type {Asset[]}
   */
  export let assets = [];

  const dispatch = createEventDispatcher();
</script>

<Dialog
  bind:open
  title={assets.length === 1 ? $_('delete_file') : $_('delete_files')}
  okLabel={$_('delete')}
  on:ok={() => {
    deleteAssets(assets);
    dispatch('delete');
  }}
>
  {#if assets.length === 1}
    {$_('confirm_deleting_selected_file')}
  {:else if assets.length === $listedAssets.length}
    {$_('confirm_deleting_all_files')}
  {:else}
    {$_('confirm_deleting_selected_files', { values: { number: assets.length } })}
  {/if}
</Dialog>
