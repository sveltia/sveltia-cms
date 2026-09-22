<!--
  @component
  New Folder button for a cloud storage service, which opens the New Folder dialog. Only rendered
  when the service can create a folder.
-->
<script>
  import { _ } from '@sveltia/i18n';
  import { Button, Icon } from '@sveltia/ui';

  import { selectedCloudService, showNewExternalFolderDialog } from '$lib/services/assets/external';
  import { browsingExternalFolders } from '$lib/services/assets/external/view';
  import { env } from '$lib/services/user/env.svelte';
</script>

{#if browsingExternalFolders.current && selectedCloudService.current?.createFolder}
  <!-- The ghost button becomes a floating button on a small screen, where it needs a surface -->
  <Button
    variant={env.isSmallScreen ? 'secondary' : 'ghost'}
    iconic
    aria-label={_('new_folder')}
    onclick={() => {
      showNewExternalFolderDialog.current = true;
    }}
  >
    {#snippet startIcon()}
      <Icon name="create_new_folder" />
    {/snippet}
  </Button>
{/if}
