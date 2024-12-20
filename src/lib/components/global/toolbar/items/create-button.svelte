<script>
  import { Divider, Icon, Menu, MenuButton, MenuItem } from '@sveltia/ui';
  import { sleep } from '@sveltia/utils/misc';
  import { _ } from 'svelte-i18n';
  import { goto } from '$lib/services/app/navigation';
  import { showUploadAssetsDialog } from '$lib/services/assets/view';
  import { siteConfig } from '$lib/services/config';

  const folderCollections = $derived(
    ($siteConfig?.collections ?? []).filter(
      ({ folder, create = false, hide = false, divider = false }) =>
        typeof folder === 'string' && create && !hide && !divider,
    ),
  );
</script>

<MenuButton
  variant="ghost"
  iconic
  popupPosition="bottom-right"
  aria-label={$_('create_entry_or_assets')}
>
  {#snippet endIcon()}
    <Icon name="add" />
  {/snippet}
  {#snippet popup()}
    <Menu aria-label={$_('create_entry_or_assets')}>
      {#if folderCollections.length}
        {#each folderCollections as { name, label, label_singular: labelSingular } (name)}
          <MenuItem
            label={labelSingular || label || name}
            onclick={() => {
              goto(`/collections/${name}/new`);
            }}
          />
        {/each}
        <Divider />
      {/if}
      <MenuItem
        label={$_('assets')}
        onclick={async () => {
          goto('/assets');
          await sleep(100);
          $showUploadAssetsDialog = true;
        }}
      />
    </Menu>
  {/snippet}
</MenuButton>
