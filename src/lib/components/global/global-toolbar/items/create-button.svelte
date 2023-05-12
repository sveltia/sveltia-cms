<script>
  import { Icon, Menu, MenuButton, MenuItem, Separator } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';
  import FilePicker from '$lib/components/assets/shared/file-picker.svelte';
  import { uploadingAssets } from '$lib/services/assets';
  import { siteConfig } from '$lib/services/config';
  import { goto } from '$lib/services/navigation';

  let filePicker;
</script>

<MenuButton class="ghost iconic" popupPosition="bottom-right">
  <Icon slot="start-icon" name="add" label={$_('create')} />
  <Menu slot="popup">
    {#each $siteConfig.collections as collection (collection.name)}
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
    <Separator />
    <MenuItem
      label={$_('assets')}
      on:click={() => {
        goto(`/assets`);
        filePicker.open();
      }}
    />
  </Menu>
</MenuButton>

<FilePicker
  bind:this={filePicker}
  on:change={({ target }) => {
    $uploadingAssets = { folder: $siteConfig.media_folder, files: [...target.files] };
  }}
/>
