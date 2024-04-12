<script>
  import { Divider, Icon, Menu, MenuButton, MenuItem } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';
  import { goto } from '$lib/services/app/navigation';
  import { showUploadAssetsDialog } from '$lib/services/assets/view';
  import { siteConfig } from '$lib/services/config';
  import { sleep } from '$lib/services/utils/misc';
</script>

<MenuButton
  variant="ghost"
  iconic
  popupPosition="bottom-right"
  aria-label={$_('create_entry_or_asset')}
>
  <Icon slot="start-icon" name="add" />
  <Menu slot="popup" aria-label={$_('create_entry_or_asset')}>
    {#each $siteConfig?.collections ?? [] as collection (collection.name)}
      {@const {
        name,
        label,
        label_singular: labelSingular,
        folder,
        hide = false,
        create = false,
      } = collection}
      {#if folder && !hide}
        <MenuItem
          label={labelSingular || label || name}
          disabled={!create}
          on:click={() => {
            goto(`/collections/${name}/new`);
          }}
        />
      {/if}
    {/each}
    <Divider />
    <MenuItem
      label={$_('asset')}
      on:click={async () => {
        goto(`/assets`);
        await sleep(100);
        $showUploadAssetsDialog = true;
      }}
    />
  </Menu>
</MenuButton>
