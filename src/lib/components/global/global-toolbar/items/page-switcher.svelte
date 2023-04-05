<script>
  import { Button, Icon } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';
  import { selectedAssetFolderPath } from '$lib/services/assets';
  import { selectedCollection } from '$lib/services/contents';
  import { goto, selectedPageName } from '$lib/services/navigation';
</script>

<Button
  class="ternary iconic"
  pressed={$selectedPageName === 'collections'}
  on:click={() => {
    goto(`/collections/${$selectedCollection.name}`);
  }}
>
  <Icon slot="start-icon" name="library_books" label={$_('entries')} />
</Button>
<Button
  class="ternary iconic"
  pressed={$selectedPageName === 'assets'}
  on:click={() => {
    goto($selectedAssetFolderPath ? `/assets/${$selectedAssetFolderPath}` : '/assets');
  }}
>
  <Icon slot="start-icon" name="photo_library" label={$_('assets')} />
</Button>
<Button
  class="ternary iconic"
  hidden={true}
  pressed={$selectedPageName === 'workflow'}
  on:click={() => {
    goto('/workflow');
  }}
>
  <Icon slot="start-icon" name="rebase_edit" label={$_('editorial_workflow')} />
</Button>
<Button
  class="ternary iconic"
  hidden={true}
  pressed={$selectedPageName === 'config'}
  on:click={() => {
    goto('/config');
  }}
>
  <Icon slot="start-icon" name="settings" label={$_('site_config')} />
</Button>
