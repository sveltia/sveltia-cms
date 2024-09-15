<script>
  import { Icon, Listbox, Option } from '@sveltia/ui';
  import { _, locale as appLocale } from 'svelte-i18n';
  import { goto } from '$lib/services/app/navigation';
  import { allAssetFolders, selectedAssetFolder } from '$lib/services/assets';
  import { getFolderLabelByCollection } from '$lib/services/assets/view';
  import { getCollection } from '$lib/services/contents';

  $: folders = [
    {
      collectionName: '*',
      internalPath: undefined,
      publicPath: undefined,
      entryRelative: false,
    },
    ...$allAssetFolders,
  ];
</script>

<div role="none" class="primary-sidebar">
  <Listbox aria-label={$_('asset_folders')} aria-controls="assets-container">
    {#each folders as { collectionName, internalPath, entryRelative } (collectionName)}
      {@const collection = collectionName ? getCollection(collectionName) : undefined}
      <!-- Can’t upload assets if collection assets are saved at entry-relative paths -->
      {@const uploadDisabled = entryRelative}
      {@const selected =
        (!internalPath && !$selectedAssetFolder) ||
        internalPath === $selectedAssetFolder?.internalPath}
      <Option
        {selected}
        label={$appLocale ? getFolderLabelByCollection(collectionName) : ''}
        onSelect={() => {
          goto(internalPath ? `/assets/${internalPath}` : '/assets');
        }}
        ondragover={(event) => {
          event.preventDefault();

          if (uploadDisabled) {
            return;
          }

          if (!internalPath || selected) {
            /** @type {DataTransfer} */ (event.dataTransfer).dropEffect = 'none';
          } else {
            /** @type {DataTransfer} */ (event.dataTransfer).dropEffect = 'move';
            /** @type {HTMLElement} */ (event.target).classList.add('dragover');
          }
        }}
        ondragleave={(event) => {
          event.preventDefault();

          if (uploadDisabled) {
            return;
          }

          /** @type {HTMLElement} */ (event.target).classList.remove('dragover');
        }}
        ondragend={(event) => {
          event.preventDefault();

          if (uploadDisabled) {
            return;
          }

          /** @type {HTMLElement} */ (event.target).classList.remove('dragover');
        }}
        ondrop={(event) => {
          event.preventDefault();

          if (uploadDisabled) {
            return;
          }

          /** @type {HTMLElement} */ (event.target).classList.remove('dragover');
          // @todo Move the assets while updating entries using the files, after showing a
          // confirmation dialog.
        }}
      >
        {#snippet startIcon()}
          <Icon name={collection?.icon || 'folder'} />
        {/snippet}
      </Option>
    {/each}
  </Listbox>
</div>
