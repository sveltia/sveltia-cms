<script>
  import { MenuButton, MenuItem, Separator } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';
  import FilePicker from '$lib/components/assets/shared/file-picker.svelte';
  import { uploadingAssets } from '$lib/services/assets';
  import { siteConfig } from '$lib/services/config';
  import { goto } from '$lib/services/navigation';

  let filePicker;
</script>

<MenuButton class="ternary iconic" iconName="add" iconLabel={$_('create')} position="bottom-right">
  {#each $siteConfig.collections as { name, label, folder, hide = false, create = false } (name)}
    {#if folder && !hide}
      <MenuItem
        {label}
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
</MenuButton>

<FilePicker
  bind:this={filePicker}
  on:change={({ target }) => {
    $uploadingAssets = { folder: $siteConfig.media_folder, files: [...target.files] };
  }}
/>
