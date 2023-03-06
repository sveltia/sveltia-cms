<script>
  import { Button } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';
  import { selectedAssetFolderPath } from '$lib/services/assets';
  import { selectedCollection } from '$lib/services/contents';
  import { goto, selectedPageName } from '$lib/services/navigation';
</script>

<Button
  class="ternary iconic"
  iconName="library_books"
  iconLabel={$_('entries')}
  pressed={$selectedPageName === 'collections'}
  on:click={() => {
    goto(`/collections/${$selectedCollection.name}`);
  }}
/>
<Button
  class="ternary iconic"
  iconName="photo_library"
  iconLabel={$_('assets')}
  pressed={$selectedPageName === 'assets'}
  on:click={() => {
    goto($selectedAssetFolderPath ? `/assets/${$selectedAssetFolderPath}` : '/assets');
  }}
/>
<Button
  class="ternary iconic"
  iconName="rebase_edit"
  iconLabel={$_('editorial_workflow')}
  hidden={true}
  pressed={$selectedPageName === 'workflow'}
  on:click={() => {
    goto('/workflow');
  }}
/>
<Button
  class="ternary iconic"
  iconName="settings"
  iconLabel={$_('site_config')}
  hidden={true}
  pressed={$selectedPageName === 'config'}
  on:click={() => {
    goto('/config');
  }}
/>
