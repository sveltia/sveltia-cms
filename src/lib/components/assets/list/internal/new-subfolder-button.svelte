<!--
  @component
  New Folder button for a repository folder, which opens the New Folder dialog. Only rendered when
  the folder can be browsed by subfolder.
-->
<script>
  import { _ } from '@sveltia/i18n';
  import { Button, Icon } from '@sveltia/ui';

  import { canCreateAsset, selectedAssetFolder } from '$lib/services/assets/folders';
  import { canBrowseSubfolders } from '$lib/services/assets/subfolders';
  import { showNewSubfolderDialog } from '$lib/services/assets/view';
  import { env } from '$lib/services/user/env.svelte';
  import { openAuthoring } from '$lib/services/workflow/open-authoring';

  const folder = $derived(selectedAssetFolder.current);
  // Creating a folder commits straight to the configured branch rather than going through review,
  // so it’s not something an Open Authoring contributor can do, just like uploading
  const disabled = $derived(openAuthoring.current || !canCreateAsset(folder));
</script>

{#if canBrowseSubfolders(folder)}
  <!-- The ghost button becomes a floating button on a small screen, where it needs a surface -->
  <Button
    variant={env.isSmallScreen ? 'secondary' : 'ghost'}
    iconic
    {disabled}
    aria-label={_('new_folder')}
    onclick={() => {
      showNewSubfolderDialog.current = true;
    }}
  >
    {#snippet startIcon()}
      <Icon name="create_new_folder" />
    {/snippet}
  </Button>
{/if}
